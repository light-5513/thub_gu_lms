# Deployment Guide (no Docker)

Target: a single Linux VM (or Windows Server) running the API, worker and built frontend as native processes behind Nginx. MongoDB Atlas and Redis are managed services or separate hosts.

## 1. Topology

```
Internet ──► Nginx :443
              ├─ /            → frontend static files (dist/)
              └─ /api/        → uvicorn (127.0.0.1:8000)
                                  │
                                  ├── ARQ worker process(es)
                                  └── Redis (managed or localhost)
                                          └── MongoDB Atlas (cloud)
```

## 2. Provision

- **MongoDB Atlas**: create an M10+ cluster for production, a dedicated DB user, IP allow-listing for the server, and enable backups.
- **Redis**: managed (Upstash/ElastiCache) or `apt install redis-server` on the same VM; require a password if exposed.
- **Python 3.10+**, **Node 20+** on the build box.

## 3. Build the frontend

```bash
cd frontend
npm ci
npm run build          # outputs dist/
```

Ship `frontend/dist` to the server, e.g. `/var/www/lms`.

## 4. Install the backend

```bash
cd /opt/lms/backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## 5. Environment

Create `/opt/lms/.env` (mode 600), based on `.env.example`:

```env
APP_ENV=production
APP_URL=https://lms.example.com
API_URL=https://lms.example.com/api
MONGODB_URI=mongodb+srv://...
JWT_SECRET=<48-char random>
SECRET_KEY=<48-char random>
SMTP_USERNAME=...@gmail.com
SMTP_PASSWORD=<app password>
SMTP_FROM=...@gmail.com
REDIS_URL=redis://:password@127.0.0.1:6379/0
GITHUB_API_TOKEN=<optional>
```

In production (`APP_ENV != development`) auth cookies gain the `Secure` flag automatically.

## 6. Process managers

Use systemd units.

`/etc/systemd/system/lms-api.service`:

```ini
[Unit]
Description=LMS FastAPI
After=network.target

[Service]
WorkingDirectory=/opt/lms/backend
EnvironmentFile=/opt/lms/.env
ExecStart=/opt/lms/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 4
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/lms-worker.service`:

```ini
[Unit]
Description=LMS ARQ Worker
After=network.target redis-server.service

[Service]
WorkingDirectory=/opt/lms/backend
EnvironmentFile=/opt/lms/.env
ExecStart=/opt/lms/.venv/bin/arq app.workers.worker.WorkerSettings
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now lms-api lms-worker
```

## 7. Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name lms.example.com;

    ssl_certificate     /etc/letsencrypt/live/lms.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/lms.example.com/privkey.pem;

    client_max_body_size 12m;

    root /var/www/lms;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name lms.example.com;
    return 301 https://$host$request_uri;
}
```

## 8. Bootstrap data & go live

```bash
cd /opt/lms/backend
.venv/bin/python -m scripts.reset_db   # optional: wipe all data for a clean slate
curl -s https://lms.example.com/api/health
```

Expected: `{"api":"healthy","database":"healthy","redis":"healthy","worker":"healthy", ...}`.

Create your real super admin manually — no demo data is seeded.

## 9. Operations checklist

- [ ] TLS certificate auto-renewal (certbot timer)
- [ ] Atlas backups + PITR enabled
- [ ] Log rotation for systemd units (journald default is fine)
- [ ] Monitoring: poll `/api/health` externally; alert when database/worker unhealthy
- [ ] Rotate `JWT_SECRET`/`SECRET_KEY` per incident policy (invalidates all sessions)
- [ ] Keep SMTP App Password scoped to this integration only; rotate if leaked
- [ ] Scale: add more uvicorn workers vertically, more `lms-worker` replicas horizontally (ARQ balances via Redis)

## 10. Zero-downtime updates

```bash
cd /opt/lms && git pull
rsync -a --delete frontend/dist/ /var/www/lms/
systemctl restart lms-api lms-worker
```

Indexes and settings migrations run idempotently at startup.
