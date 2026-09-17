# Environment Variables

Copy `.env.example` → `.env` and fill in values. `.env` is git-ignored and must **never** be committed, shared, or baked into images.

## Application

| Variable | Example | Purpose |
|---|---|---|
| `APP_NAME` | `LMS` | Product name used in emails/UI |
| `APP_ENV` | `development` | `development` enables Swagger + non-secure cookies; anything else hardens them |
| `APP_URL` | `http://localhost:3000` | Public frontend URL (used in email links) |
| `API_URL` | `http://localhost:8000` | Public API URL |

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
