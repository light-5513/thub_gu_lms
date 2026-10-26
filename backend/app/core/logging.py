"""Structured logging with request correlation and sensitive-field scrubbing."""

import json
import logging
import sys
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

SENSITIVE_KEYS = {
    "password",
    "token",
    "access_token",
    "refresh_token",
    "secret",
    "smtp_password",
    "mongodb_uri",
    "reset_token",
    "authorization",
    "current_password",
    "new_password",
    "temporary_password",
    "temp_password",
    "hash",
    "password_hash",
    "secret_key",
    "jwt_secret",
}
SENSITIVE_MASK = "***"


def _scrub_value(value: Any) -> Any:
    """Recursively replace values whose key matches SENSITIVE_KEYS."""
    if isinstance(value, dict):
        out = {}
        for k, v in value.items():
            if k.lower() in SENSITIVE_KEYS:
                out[k] = SENSITIVE_MASK
            else:
                out[k] = _scrub_value(v)
        return out
    if isinstance(value, (list, tuple)):
        cleaned = [_scrub_value(v) for v in value]
        return type(value)(cleaned)
    return value


def _scrub_message(msg: str) -> str:
    """Best-effort scrub of inline key=value / 'key': 'value' pairs in log messages.
    Handles unquoted (`password=secret`), quoted (`"password": "secret"`), and
    embedded JSON / dict repr (`payload={"password": "x"}`).
    Also handles Authorization header-style (`Authorization: Bearer xyz`)."""
    if not isinstance(msg, str) or ("=" not in msg and ":" not in msg):
        return msg
    import re

    # Handle Authorization header BEFORE the general kv scrub so the token
    # is consumed in one shot (otherwise the kv scrub would mask "Bearer" only).
    auth_pattern = re.compile(r"(?P<k>[Aa]uthorization)\s*[:=]\s*[A-Za-z]+\s+[^\s,;]+")
    try:
        msg = auth_pattern.sub(lambda m: f"{m.group('k')}: {SENSITIVE_MASK}", msg)
    except Exception:
        pass

    msg = _scrub_embedded_json(msg)

    # Pass: key=value and 'key': 'value' style. Value stops at common boundary
    # characters (whitespace, comma, closing brace/bracket) to avoid consuming
    # trailing JSON delimiters.
    kv_pattern = re.compile(
        r"""(['"]?(?P<k>[A-Za-z_][A-Za-z0-9_]*)['"]?\s*[:=]\s*)(?P<v>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\[[^\]]*\]|[^\s,;}\]]+)""",
        re.VERBOSE,
    )

    def _kv_replace(m: "re.Match[str]") -> str:
        key = m.group("k").lower()
        if key in SENSITIVE_KEYS:
            return f"{m.group(1)}{SENSITIVE_MASK}"
        return m.group(0)

    try:
        msg = kv_pattern.sub(_kv_replace, msg)
    except Exception:
        return msg

    return msg


def _scrub_embedded_json(msg: str) -> str:
    """If the message contains an embedded JSON object, mask values whose key
    is sensitive. Operates by string substitution so non-JSON text is untouched."""
    # Find every {...} span (non-greedy) and try to parse it.
    # We use a simple bracket matcher since regex can't balance.
    out = []
    i = 0
    n = len(msg)
    while i < n:
        c = msg[i]
        if c == "{":
            # Find matching closing brace
            depth = 1
            j = i + 1
            in_str = False
            esc = False
            while j < n and depth > 0:
                ch = msg[j]
                if in_str:
                    if esc:
                        esc = False
                    elif ch == "\\":
                        esc = True
                    elif ch == '"':
                        in_str = False
                else:
                    if ch == '"':
                        in_str = True
                    elif ch == "{":
                        depth += 1
                    elif ch == "}":
                        depth -= 1
                j += 1
            if depth == 0:
                span = msg[i:j]
                scrubbed = _scrub_embedded_json_object(span)
                out.append(scrubbed)
                i = j
                continue
        out.append(c)
        i += 1
    return "".join(out)


def _scrub_embedded_json_object(span: str) -> str:
    """Mask sensitive values inside a { ... } span using simple string find.
    Tries to parse first; if it fails, falls back to regex on the span.
    """
    import re

    # We don't want to change quoting, just replace sensitive values.
    pattern = re.compile(
        r"""(['"]?(?P<k>[A-Za-z_][A-Za-z0-9_]*)['"]?\s*:\s*)(?P<v>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\[[^\]]*\]|-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?|true|false|null)""",
        re.VERBOSE,
    )

    def _replace(m: "re.Match[str]") -> str:
        key = m.group("k").lower()
        if key in SENSITIVE_KEYS:
            return f"{m.group(1)}{SENSITIVE_MASK}"
        return m.group(0)

    try:
        return pattern.sub(_replace, span)
    except Exception:
        return span


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "service": getattr(record, "service", "api"),
            "event": _scrub_message(record.getMessage()),
            "logger": record.name,
            "request_id": request_id_var.get("-"),
        }
        if hasattr(record, "duration_ms"):
            entry["duration_ms"] = record.duration_ms
        if hasattr(record, "user_id"):
            entry["user_id"] = str(record.user_id)
        # Scrub any structured extras passed via logger.log(..., extra={...})
        extras = {
            k: v
            for k, v in record.__dict__.items()
            if k
            not in {
                "name",
                "msg",
                "args",
                "levelname",
                "levelno",
                "pathname",
                "filename",
                "module",
                "exc_info",
                "exc_text",
                "stack_info",
                "lineno",
                "funcName",
                "created",
                "msecs",
                "relativeCreated",
                "thread",
                "threadName",
                "processName",
                "process",
                "message",
                "asctime",
                "service",
            }
        }
        if extras:
            entry["extra"] = _scrub_value(extras)
        return json.dumps(entry, default=str)


def setup_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.INFO)
    for name in ("uvicorn", "uvicorn.access", "uvicorn.error", "motor", "pymongo"):
        logging.getLogger(name).handlers = [handler]
    for name in ("uvicorn.access",):
        logging.getLogger(name).propagate = False


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
