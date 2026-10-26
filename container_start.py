"""Start FastAPI and the WhatsApp Web API inside the same Render container."""

from __future__ import annotations

import hashlib
import hmac
import os
import signal
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parent
WHATSAPP_PORT = os.environ.get("WHATSAPP_API_PORT", "10001")
SHUTDOWN_TIMEOUT_SECONDS = 20
WHATSAPP_RESTART_DELAY_SECONDS = 5


def ensure_internal_secret(env: dict[str, str], key: str, purpose: bytes) -> None:
    """Keep the embedded API usable if Render hasn't applied optional key vars."""
    if env.get(key):
        return
    root_secret = env.get("SECRET_KEY") or env.get("JWT_SECRET")
    if not root_secret:
        raise RuntimeError(
            f"{key} is missing and neither SECRET_KEY nor JWT_SECRET is configured"
        )
    env[key] = hmac.new(
        root_secret.encode("utf-8"), b"thub-gu-lms:" + purpose, hashlib.sha256
    ).hexdigest()
    print(f"{key} is unset; derived a stable internal key from the app secret.", flush=True)


def stop_processes(processes: list[tuple[str, subprocess.Popen]]) -> None:
    for _name, process in processes:
        if process.poll() is None:
            try:
                os.killpg(process.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass

    deadline = time.monotonic() + SHUTDOWN_TIMEOUT_SECONDS
    for _name, process in processes:
        if process.poll() is None:
            remaining = max(0, deadline - time.monotonic())
            try:
                process.wait(timeout=remaining)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                process.wait()


def main() -> int:
    app_env = os.environ.copy()
    app_env["WHATSAPP_API_URL"] = f"http://127.0.0.1:{WHATSAPP_PORT}"
    ensure_internal_secret(app_env, "WHATSAPP_API_TOKEN", b"whatsapp-api-token")
    ensure_internal_secret(app_env, "WHATSAPP_OUTBOX_KEY", b"whatsapp-outbox")

    whatsapp_env = app_env.copy()
    whatsapp_env["PORT"] = WHATSAPP_PORT
    whatsapp_env["WHATSAPP_API_HOST"] = "127.0.0.1"
    whatsapp_env.setdefault("PUPPETEER_EXECUTABLE_PATH", "/usr/bin/chromium")

    processes: list[tuple[str, subprocess.Popen]] = []
    shutdown_requested = False

    def request_shutdown(_signum: int, _frame: object) -> None:
        nonlocal shutdown_requested
        shutdown_requested = True

    def start_whatsapp() -> subprocess.Popen:
        print("Starting embedded WhatsApp API.", flush=True)
        return subprocess.Popen(
            ["node", "whatsapp-api/server.js"],
            cwd=ROOT,
            env=whatsapp_env,
            start_new_session=True,
        )

    signal.signal(signal.SIGTERM, request_shutdown)
    signal.signal(signal.SIGINT, request_shutdown)

    try:
        api = subprocess.Popen(
            [sys.executable, "run.py"],
            cwd=ROOT,
            env=app_env,
            start_new_session=True,
        )
        processes.append(("LMS API", api))
        whatsapp = start_whatsapp()
        processes.append(("WhatsApp API", whatsapp))

        while not shutdown_requested:
            api_return_code = api.poll()
            if api_return_code is not None:
                print(
                    f"LMS API exited with status {api_return_code}; stopping the container.",
                    flush=True,
                )
                return 1 if api_return_code == 0 else api_return_code

            whatsapp_return_code = whatsapp.poll()
            if whatsapp_return_code is not None:
                print(
                    f"WhatsApp API exited with status {whatsapp_return_code}; "
                    f"restarting it in {WHATSAPP_RESTART_DELAY_SECONDS} seconds.",
                    flush=True,
                )
                time.sleep(WHATSAPP_RESTART_DELAY_SECONDS)
                if not shutdown_requested:
                    processes = [
                        (name, process)
                        for name, process in processes
                        if process.poll() is None
                    ]
                    whatsapp = start_whatsapp()
                    processes.append(("WhatsApp API", whatsapp))
            time.sleep(0.5)
        return 0
    finally:
        stop_processes(processes)


if __name__ == "__main__":
    raise SystemExit(main())
