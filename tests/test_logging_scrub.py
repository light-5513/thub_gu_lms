"""Tests for the sensitive log scrubber."""
import json
import logging
import io

from app.core.logging import (
    SENSITIVE_KEYS,
    SENSITIVE_MASK,
    _scrub_message,
    _scrub_value,
    JsonFormatter,
)


class TestScrubValue:
    def test_simple_dict(self):
        out = _scrub_value({"user": "alice", "password": "secret"})
        assert out == {"user": "alice", "password": "***"}

    def test_nested_dict(self):
        out = _scrub_value({"a": {"token": "abc", "safe": 1}})
        assert out == {"a": {"token": "***", "safe": 1}}

    def test_list_of_dicts(self):
        out = _scrub_value([{"password_hash": "x", "email": "a@b.com"}])
        assert out == [{"password_hash": "***", "email": "a@b.com"}]

    def test_case_insensitive(self):
        out = _scrub_value({"PASSWORD": "x", "Token": "y"})
        assert out == {"PASSWORD": "***", "Token": "***"}

    def test_non_sensitive_untouched(self):
        out = _scrub_value({"name": "alice", "email": "a@b.com"})
        assert out == {"name": "alice", "email": "a@b.com"}

    def test_plain_string_passthrough(self):
        assert _scrub_value("hello") == "hello"
        assert _scrub_value(42) == 42
        assert _scrub_value(None) is None

    def test_tuple(self):
        out = _scrub_value(("a", {"password": "x"}))
        assert out == ("a", {"password": "***"})


class TestScrubMessage:
    def test_unquoted_kv(self):
        assert _scrub_message("password=hunter2 token=abc") == "password=*** token=***"

    def test_quoted_kv(self):
        assert _scrub_message('{"password": "hunter2"}') == '{"password": ***}'

    def test_json_in_text(self):
        out = _scrub_message('payload: {"password": "hunter2", "token": "abc"}')
        assert out == 'payload: {"password": ***, "token": ***}'

    def test_authorization_bearer(self):
        out = _scrub_message("Authorization: Bearer eyJhbGc.payload")
        assert "eyJhbGc" not in out
        assert "***" in out

    def test_authorization_equals(self):
        out = _scrub_message("Authorization=Bearer eyJhbGc.payload")
        assert "eyJhbGc" not in out
        assert "***" in out

    def test_normal_message_unchanged(self):
        assert _scrub_message("User logged in successfully") == "User logged in successfully"

    def test_no_kv_unchanged(self):
        assert _scrub_message("hello world") == "hello world"

    def test_non_sensitive_key_unchanged(self):
        assert _scrub_message("user_id=123 name=alice") == "user_id=123 name=alice"

    def test_closing_brace_preserved(self):
        """Regression: kv scrubber should not eat the closing brace of a JSON object."""
        out = _scrub_message('{"password": "hunter2"}')
        assert out.endswith("}")

    def test_multiple_sensitive(self):
        out = _scrub_message("password=hunter2 current_password=secret mongodb_uri=mongodb://root:pw@host")
        # After scrubbing, the original sensitive values should not appear.
        # The key names themselves will still appear (they're not sensitive).
        assert "hunter2" not in out
        assert "secret" not in out or "current_password=***" in out  # 'secret' is a key, value should be ***
        # Confirm all three values were masked
        assert "password=***" in out
        assert "current_password=***" in out
        assert "mongodb_uri=***" in out


class TestJsonFormatter:
    def _make_logger(self) -> tuple[logging.Logger, io.StringIO]:
        buf = io.StringIO()
        handler = logging.StreamHandler(buf)
        handler.setFormatter(JsonFormatter())
        log = logging.getLogger("test_json_formatter")
        log.handlers = [handler]
        log.setLevel(logging.INFO)
        log.propagate = False
        return log, buf

    def test_no_secrets_in_output(self):
        log, buf = self._make_logger()
        SECRETS = {
            "password": "SUPER_SECRET_PASSWORD_123",
            "token": "SUPER_SECRET_TOKEN_456",
            "mongodb_uri": "mongodb://root:SUPER_SECRET_USER_PW_789@host/db",
        }
        log.info(f"login password={SECRETS['password']} token={SECRETS['token']}")
        log.info("db", extra={"password": SECRETS["password"], "user_id": "u1"})
        log.info(f"failed mongodb_uri={SECRETS['mongodb_uri']}")
        log.info("Authorization: Bearer SUPER_SECRET_JWT_999")

        out = buf.getvalue()
        for needle in SECRETS.values():
            assert needle not in out, f"LEAK: {needle}"
        assert "SUPER_SECRET_JWT_999" not in out

    def test_non_sensitive_preserved(self):
        log, buf = self._make_logger()
        log.info("User alice logged in")
        log.info("event", extra={"user_id": "u1", "action": "view"})

        out = buf.getvalue()
        assert "alice" in out
        assert "u1" in out
        assert "view" in out

    def test_output_is_valid_json(self):
        import json as _json
        log, buf = self._make_logger()
        log.info("test event", extra={"foo": "bar"})
        out = buf.getvalue()
        for line in out.strip().split("\n"):
            _json.loads(line)  # raises if invalid
