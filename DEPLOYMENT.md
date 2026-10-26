# Deployment Guide (native processes)

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
Set `FRONTEND_DIST_DIR=/var/www/lms` in the environment so the API can serve
the deployed build.

## 4. Install the backend

```bash
cd /opt/lms/backend
python3 -m venv ../.venv
../.venv/bin/pip install -r requirements.txt
```

## 5. Environment

Create `/opt/lms/.env` (mode 600), based on `.env.example`:

```env
APP_ENV=production
APP_URL=https://lms.example.com
API_URL=https://lms.example.com
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
Set `APP_URL` to the URL that students and admins open; WhatsApp invitation
messages and reset emails use it for links.

## 6. WhatsApp invitation service

The Invitations page can send each setup link through email, WhatsApp, or both. Bulk invitations accept pasted rows or uploaded CSV/XLSX files; CSV and Excel sample templates are available beside the upload control. Uploading prepares rows for review and does not send until confirmed.
Email uses the LMS SMTP configuration; WhatsApp uses the Node service in
`whatsapp-api/`.
Run it beside the LMS API and set `WHATSAPP_API_URL` and `WHATSAPP_API_TOKEN`
on the Python service. The Node service needs the same MongoDB database so it
can persist the linked-device session in GridFS and track invitation delivery.
It also needs a private `WHATSAPP_OUTBOX_KEY` to encrypt queued invitation
links until they are delivered.

For local development, install the service dependencies and start the API:

```bash
cd whatsapp-api
npm install
MONGODB_URI='mongodb+srv://...' MONGODB_DATABASE=lms WHATSAPP_API_TOKEN=local-secret WHATSAPP_OUTBOX_KEY=local-encryption-secret npm start
```

Set `WHATSAPP_API_URL=http://localhost:10000` and
`WHATSAPP_API_TOKEN=local-secret` in the LMS environment. Open **Admin →
Invitations**, scan the displayed QR from WhatsApp → Linked devices, and wait
for the connection status to show ready. Enter each recipient's phone number
in international format.

The Render blueprint adds a private `lms-whatsapp-api` service and connects it
to the LMS with generated API and outbox-encryption keys. It also copies
`MONGODB_URI` and `MONGODB_DATABASE` from the LMS service so both use the same
database. It uses a paid
`standard` compute plan because a WhatsApp Web browser needs an always-on
service; the service stores its login session in MongoDB, so it does not need
a Render disk. Keep both services in the same Render region. After deployment,
open the Invitations page and scan the QR to link the sender account. The
private service plan adds a Render charge.

Invitations are accepted into a durable encrypted outbox. The page reports
queued, sent, or failed delivery status and refreshes while invitations are
pending. The WhatsApp service sends one queued message at a time.

The library is an unofficial WhatsApp Web client. WhatsApp can change its web
protocol or restrict accounts using unofficial clients; use this only for
messages recipients expect and are authorized to receive.

## 7. Process managers

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

## 8. Nginx

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

## 9. Bootstrap data & go live

```bash
cd /opt/lms/backend
curl -fsS https://lms.example.com/api/ready
```

Expected: `{"ready":true}` with HTTP 200. A database outage returns HTTP 503.
`/api/health` also reports the optional Redis and worker status; those may be
`unhealthy` or `unknown` in a single-process deployment without a worker.

Create the first super admin with `backend/scripts/create_admin.py` (run as
`python -m scripts.create_admin EMAIL PASSWORD` from `backend/`). No demo data
is seeded. Do not run `scripts.reset_db` as part of deployment: it drops every
collection in the configured database.

## 10. Operations checklist

- [ ] TLS certificate auto-renewal (certbot timer)
- [ ] Atlas backups + PITR enabled
- [ ] Log rotation for systemd units (journald default is fine)
- [ ] Monitoring: poll `/api/ready` externally; alert on HTTP 503. Monitor optional worker status separately via `/api/health` if it is deployed.
- [ ] Rotate `JWT_SECRET`/`SECRET_KEY` per incident policy (invalidates all sessions)
- [ ] Keep SMTP App Password scoped to this integration only; rotate if leaked
- [ ] Scale: add more uvicorn workers vertically, more `lms-worker` replicas horizontally (ARQ balances via Redis)

## 11. Updates

```bash
cd /opt/lms && git pull
rsync -a --delete frontend/dist/ /var/www/lms/
systemctl restart lms-api lms-worker
```

Indexes and settings migrations run idempotently at startup.
