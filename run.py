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
import sys
from pathlib import Path

# Repo root is the current dir; `app` package lives here at the top level.
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="LMS monolithic launcher")
    parser.add_argument("--host", default="0.0.0.0", help="Bind host (default 0.0.0.0)")
    import os
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8000)), help="Bind port (default 8000; Render sets $PORT)")
    parser.add_argument("--reload", action="store_true", help="Enable hot-reload (dev)")
    parser.add_argument("--workers", type=int, default=1, help="Worker processes (default 1)")
    args = parser.parse_args()

    try:
        import uvicorn
    except ImportError:
        print("ERROR: uvicorn not installed. Run: pip install -r requirements.txt")
        sys.exit(1)

    # Friendly banner
    print("=" * 60)
    print(f"  LMS — monolithic mode")
    print(f"  Backend:  http://{args.host}:{args.port}")
    print(f"  API:      http://{args.host}:{args.port}/api")
    print(f"  Health:   http://{args.host}:{args.port}/api/health")
    print(f"  Frontend: {'served from ' + str(ROOT / 'frontend' / 'dist') if (ROOT / 'frontend' / 'dist').is_dir() else 'NOT BUILT — run `npm run build` in frontend/'}")
    print("=" * 60)

    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        workers=args.workers if not args.reload else 1,
        app_dir=str(ROOT),
    )