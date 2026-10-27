# Environment Variables

Copy `.env.example` → `.env` and fill in values. `.env` is git-ignored and must **never** be committed, shared, or baked into images.

## Application

| Variable | Example | Purpose |
|---|---|---|
| `APP_NAME` | `LMS` | Product name used in messages/UI |
| `APP_ENV` | `development` | `development` enables Swagger + non-secure cookies; anything else hardens them |
| `APP_URL` | `http://localhost:8000` | Public frontend URL (used in invitation and reset links); use port 3000 only with the Vite development server |
| `API_URL` | `http://localhost:8000` | Public API origin |

## MongoDB Atlas

| Variable | Example | Purpose |
|---|---|---|
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority` | Atlas connection string. **Required** |
| `MONGODB_DATABASE` | `lms` | Database name |

Create the user with read/write on this database only. Never URL-encode issues — keep special chars in passwords percent-encoded inside the URI.

## Secrets & tokens

| Variable | Example | Purpose |
|---|---|---|
| `SECRET_KEY` | 32+ random bytes | General-purpose app secret |
| `JWT_SECRET` | 32+ random bytes | JWT signing key — use ≥32 characters (HS256 requirement) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token lifetime |

Generate secrets:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

## Gmail SMTP

Use a Google account's **App Password** (2-Step Verification must be enabled): Google Account → Security → App passwords.

| Variable | Example |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USERNAME` | `lms-notifications@yourdomain.com` (the full Gmail address) |
| `SMTP_PASSWORD` | the 16-character App Password (**not** the login password) |
| `SMTP_FROM` | same as SMTP_USERNAME usually |
| `SMTP_USE_TLS` | `true` |

If unset, emails are skipped and logged as failed (`email_logs`) — flows still work.

## WhatsApp invitations

Invitations can be sent by email, WhatsApp, or both. The Render Docker container starts the Node service in `whatsapp-api/` alongside the LMS API. It runs `whatsapp-web.js`, uses an internal loopback URL, and stores its linked-device session in MongoDB GridFS. The Node API starts with the LMS; both channels are selected by default in Invitations, and Chromium is initialized when an admin clicks **Connect WhatsApp** or queues a WhatsApp invitation. Locally, you can run the Node service separately. Email uses the existing SMTP/Resend configuration and worker queue. Delivery status for both channels is saved on the invitation record.

| Variable | Example | Purpose |
|---|---|---|
| `WHATSAPP_API_URL` | `http://localhost:10000` | Local WhatsApp API base URL; the combined Render container sets its loopback URL automatically |
| `WHATSAPP_API_PORT` | `10001` | Internal WhatsApp API port used by the combined Render container |
| `WHATSAPP_API_TOKEN` | generated secret | Authenticates requests from the LMS API to the WhatsApp service |
| `WHATSAPP_OUTBOX_KEY` | private random secret | Encrypts invitation links while they wait in the Node service's MongoDB outbox |
| `WHATSAPP_START_TIMEOUT_MS` | `150000` | Maximum wait for the first WhatsApp QR code or ready state before restarting the embedded Node API |
| `WHATSAPP_MONGODB_URI` | optional | Node-specific MongoDB URI override; useful when Windows Node cannot resolve the Atlas `mongodb+srv` record |

For local use, start the Node service with the same `MONGODB_URI` and `MONGODB_DATABASE` as the LMS, then set all three variables above. Open **Admin → Invitations**, click **Connect WhatsApp**, and scan the QR code with the WhatsApp account that should send the links. The page reports when the client is ready. Use international phone numbers with country codes, such as `+919876543210`.

The linked-device session is sensitive and is stored in the configured MongoDB database. The `whatsapp-web.js` project describes itself as an unofficial WhatsApp Web client; WhatsApp may change the web protocol or restrict accounts using unofficial clients.

## Redis / worker

| Variable | Example | Purpose |
|---|---|---|
| `REDIS_URL` | `redis://localhost:6379/0` | Queue + rate limiting + worker heartbeat |

Optional for the API in development (in-memory fallbacks). Required for real background processing and accurate worker health.

## Coding platforms

| Variable | Default | Notes |
|---|---|---|
| `GITHUB_API_TOKEN` | — | Optional personal access token; raises GitHub REST limit from 60 to 5,000 req/hr |
| `LEETCODE_API_URL` | `https://leetcode.com/graphql` | Unofficial public GraphQL endpoint |
| `CODECHEF_API_URL` | `https://www.codechef.com/users/` | Profile page base (no official API) |
| `CODEFORCES_API_URL` | `https://codeforces.com/api` | Official public API (~1 req/s per IP) |
| `ATCODER_API_URL` | `https://kenkoooo.com/atcoder/atcoder-api/v3` | Community API by kenkoooo |

See [CODING_INTEGRATIONS.md](CODING_INTEGRATIONS.md) for limits and behavior.

## Rules of thumb

1. Every value here is injectable; nothing is hardcoded in source.
2. Frontend needs no secrets — it calls `/api/*` through the Vite dev proxy or your reverse proxy in production.
3. Rotate `JWT_SECRET` to invalidate all sessions fleet-wide.
