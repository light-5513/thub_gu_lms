"""
LMS monolithic launcher.

Starts the FastAPI app (which now serves the built React frontend too) on
a single port. No Docker, no separate frontend dev server, no Redis worker
required — all background jobs fall back to inline execution.

Usage:
    python run.py                # default: 0.0.0.0:8000
    python run.py --port 9000    # custom port
    python run.py --host 127.0.0.1 --port 8000
    python run.py --reload       # dev: hot-reload

Environment (.env at repo root):
    MONGODB_URI        required for data persistence
    JWT_SECRET         required for auth tokens (set a strong value in prod)
    SECRET_KEY         required for session signing
    SMTP_USERNAME/PASSWORD   optional (emails queue inline if absent)
    FRONTEND_DIST_DIR  optional override for built frontend location
    PORT               defaults to 8000 (Render sets it automatically)
"""
import argparse
import atexit
import os
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path
from urllib.parse import urlparse

# Keep the backend importable when launching from the repository root.
ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
WHATSAPP_DIR = ROOT / "whatsapp-api"
sys.path.insert(0, str(BACKEND))

_whatsapp_proc = None
_whatsapp_stop = threading.Event()


def _load_dotenv_value(key):
    if os.environ.get(key):
        return os.environ[key]
    env_file = ROOT / ".env"
    if env_file.is_file():
        for line in env_file.read_text(encoding="utf-8", errors="ignore").splitlines():
            name, sep, value = line.partition("=")
            if sep and name.strip() == key:
                return value.strip().strip('"').strip("'")
    return ""


def _kill_tree(proc):
    if proc is None or proc.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
    else:
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass


def _port_in_use(port):
    with socket.socket() as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0


def start_whatsapp_api():
    """Launch the WhatsApp Web service next to the LMS and restart it if it exits."""
    if os.environ.get("LMS_WHATSAPP_MANAGED") == "1":
        return  # container_start.py supervises it in production
    if not (WHATSAPP_DIR / "server.js").is_file():
        return
    node = shutil.which("node")
    if not node:
        print("WhatsApp API: node not found on PATH; skipping (invitations by WhatsApp unavailable).")
        return
    if not (WHATSAPP_DIR / "node_modules").is_dir():
        print("WhatsApp API: dependencies missing; run `npm install` in whatsapp-api/. Skipping.")
        return

    api_url = _load_dotenv_value("WHATSAPP_API_URL") or "http://localhost:10000"
    port = urlparse(api_url).port or 10000
    if _port_in_use(port):
        print(f"WhatsApp API: port {port} already in use; assuming it is already running.")
        return

    env = os.environ.copy()
    env["PORT"] = str(port)
    env["WHATSAPP_API_HOST"] = "127.0.0.1"
    env.setdefault("WHATSAPP_AUTH_STRATEGY", "local")
    popen_kwargs = {}
    if os.name == "nt":
        popen_kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        popen_kwargs["start_new_session"] = True

    def supervise():
        global _whatsapp_proc
        while not _whatsapp_stop.is_set():
            _whatsapp_proc = subprocess.Popen(
                [node, "server.js"], cwd=WHATSAPP_DIR, env=env, **popen_kwargs
            )
            print(f"WhatsApp API: started on port {port} (pid {_whatsapp_proc.pid})")
            while _whatsapp_proc.poll() is None and not _whatsapp_stop.is_set():
                time.sleep(0.5)
            if _whatsapp_stop.is_set():
                break
            print(f"WhatsApp API: exited with status {_whatsapp_proc.returncode}; restarting in 5s.")
            _kill_tree(_whatsapp_proc)  # reap orphaned Chromium children
            _whatsapp_stop.wait(5)

    threading.Thread(target=supervise, name="whatsapp-supervisor", daemon=True).start()

    def shutdown():
        _whatsapp_stop.set()
        _kill_tree(_whatsapp_proc)

    atexit.register(shutdown)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="LMS monolithic launcher")
    parser.add_argument("--host", default="0.0.0.0", help="Bind host (default 0.0.0.0)")
    parser.add_argument("--no-whatsapp", action="store_true", help="Do not start the WhatsApp API service")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8000)), help="Bind port (default 8000; Render sets $PORT)")
    parser.add_argument("--reload", action="store_true", help="Enable hot-reload (dev)")
    parser.add_argument("--workers", type=int, default=1, help="Worker processes (default 1)")
    args = parser.parse_args()

    try:
        import uvicorn
    except ImportError:
        print("ERROR: uvicorn not installed. Run: pip install -r backend/requirements.txt")
        sys.exit(1)

    # Friendly banner
    print("=" * 60)
    print(f"  LMS — monolithic mode")
    print(f"  Backend:  http://{args.host}:{args.port}")
    print(f"  API:      http://{args.host}:{args.port}/api")
    print(f"  Health:   http://{args.host}:{args.port}/api/health")
    print(f"  Frontend: {'served from ' + str(ROOT / 'frontend' / 'dist') if (ROOT / 'frontend' / 'dist').is_dir() else 'NOT BUILT — run `npm run build` in frontend/'}")
    print("=" * 60)

    if not args.no_whatsapp:
        start_whatsapp_api()

    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        workers=args.workers if not args.reload else 1,
        app_dir=str(BACKEND),
    )
