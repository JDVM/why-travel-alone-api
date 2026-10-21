# Deploying Why Travel Alone

This runbook covers both repositories: the API (this repo) and the web app
([JDVM/why-travel-alone](https://github.com/JDVM/why-travel-alone)). Both ship
as container images, so they run on any platform that runs containers.

## What runs where

```
Browser ──HTTPS──> web (nginx, static React build)    https://app.example.com
   │
   └─────HTTPS──> api (Node/Express container)         https://api.example.com
                     ├── MySQL 8 (managed, TLS)
                     ├── SMTP provider (verification and password-reset emails)
                     └── Sentry (optional error reporting)
```

You need:

- **A container host.** For example Render, Fly.io, Railway, DigitalOcean App Platform, AWS App Runner or ECS, Google Cloud Run, or a VM running `docker compose`. It must terminate HTTPS and support health checks and a pre-deploy (release) command.
- **Managed MySQL 8**, with automated daily backups and point-in-time recovery, in the same region as the API.
- **An SMTP provider** (Postmark, Amazon SES, Mailgun, SendGrid, …) with a sending domain you control.
- **Two hostnames** (e.g. `app.` and `api.`) with TLS certificates. Most hosts issue these automatically.
- **Optional: Sentry**, one project for the API and one for the web app.

## Configuration

### API (runtime environment variables)

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | yes | `production` (set in the image). |
| `PORT` | no | Defaults to 8080 in the image. Most hosts set it. |
| `APP_SECRET` | yes | At least 32 random characters: `openssl rand -hex 32`. Keys the email tags in the logs. (`JWT_SECRET`, its old name, still works.) |
| `COOKIE_SECURE` | no | Leave unset (the session cookie is HTTPS-only). `false` only for a plain-http test setup that isn't localhost. |
| `COOKIE_DOMAIN` | no | Leave unset: the cookie belongs to the API's host, which is what you want. |
| `CORS_ORIGIN` | yes | The web app's exact origin, e.g. `https://app.example.com` (comma-separate several). |
| `APP_URL` | yes | The web app's URL, used in email links. Must be `https://`. |
| `TRUST_PROXY` | yes, behind a proxy | Number of proxies in front of the API, usually `1`. Without it, every client shares one rate limit. |
| `DB_HOST`, `DB_PORT` | yes | Database address. |
| `DB_LOCAL_DBNAME`, `DB_LOCAL_USER`, `DB_LOCAL_PASSWORD` | yes | Database name and credentials (the names are historical; they're used everywhere). |
| `DB_SSL`, `DB_SSL_CA` | recommended | `DB_SSL=true` encrypts and verifies the database connection. `DB_SSL_CA` is the provider's CA bundle (file path or PEM text) if it has its own. |
| `DB_POOL_MAX` | no | Connections per API instance, default 10. Keep `DB_POOL_MAX × instances` below the database's connection limit. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | yes | From your SMTP provider. Port 587 uses STARTTLS (required). |
| `SMTP_SECURE` | no | `true` for port 465. |
| `MAIL_FROM` | yes | e.g. `Why Travel Alone <no-reply@example.com>`, on your sending domain. |
| `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE` | no | Error reporting. Set `SENTRY_RELEASE` to the git commit. |
| `LOG_LEVEL` | no | Default `info`. |
| `INVITATIONS_PER_DAY` | no | Most invitations one account can send in 24 hours, default 20. Limits spam; hitting it is logged as `invitations.daily_limit`. |

The API refuses to start, with a list of what's missing, if a required
production setting is absent.

### Web app (build arguments)

The React app reads its settings when the image is built, so build one image
per environment.

| Build argument | Required | Notes |
| --- | --- | --- |
| `REACT_APP_API_BASE_URL` | yes | e.g. `https://api.example.com`. |
| `REACT_APP_SENTRY_DSN` | no | The web app's Sentry project. |
| `REACT_APP_SENTRY_ENVIRONMENT`, `REACT_APP_SENTRY_RELEASE` | no | As for the API. |

Runtime environment variables for the web container, used in its Content-Security-Policy:

| Variable | Required | Notes |
| --- | --- | --- |
| `API_ORIGIN` | yes | Same origin as `REACT_APP_API_BASE_URL`. Without it, the browser blocks API calls. |
| `SENTRY_ORIGIN` | with Sentry | The ingest host from the DSN, e.g. `https://o123.ingest.us.sentry.io`. |

### Secrets

Keep `APP_SECRET`, `DB_LOCAL_PASSWORD`, `SMTP_PASS` and the DSNs in the host's
secret store, never in the repository or the image. (`.dockerignore` keeps
`.env` files out of builds.) Use separate values for staging and production.

To rotate:

- **`APP_SECRET`:** set a new value and redeploy. Nobody is signed out; only new log lines get different email tags.
- **Sign everyone out** (e.g. after a suspected breach): `DELETE FROM sessions;`.
- **Database or SMTP password:** create the new credential, update the secret, redeploy, then revoke the old one.

## First deployment

1. Create the MySQL database and a user with full privileges on that database only (migrations need to create and alter tables). Turn on automated backups and point-in-time recovery.
2. Set up the sending domain at the SMTP provider, including SPF, DKIM and DMARC DNS records, so emails don't land in spam.
3. Create the API service from this repo's `Dockerfile`, with the environment above. Health check path: `/health`.
4. Set its pre-deploy (release) command to `npm run migrate`. On a VM, run it yourself: `docker run --rm --env-file api.env <api image> npm run migrate`.
5. Deploy the API and check `https://api.example.com/health` returns `{"status":"ok"}`.
6. Create the web service from the web repo's `Dockerfile`, with `REACT_APP_API_BASE_URL` and `API_ORIGIN`. Health check path: `/healthz`.
7. Smoke test in a browser:
   - sign up and confirm the email arrives and the link works
   - request a password reset
   - create a trip and invite a second test account
   - delete the test accounts
8. Work through the [launch checklist](#launch-checklist).

The migrations also add the travel styles and destinations users pick from.
**Never run `npm run seed` against production.** The seeds delete data and
create demo logins with a published password. They refuse to run when
`NODE_ENV=production` and aren't included in the image.

## Every release

1. Merge to `main` only with CI green. CI runs the tests and builds and smoke-tests both images.
2. Build the images and tag them with the git commit.
3. Run `npm run migrate` with the new API image, before the new code takes traffic.
4. Deploy the API, then the web app.
5. Check `/health`, `/healthz`, Sentry and the error rate in the logs.

**Migrations must work with the API version that's still running**, because
for a few minutes the old code runs against the new schema. Add columns and
tables in one release, and remove them in a later one.

### Rolling back

- **Code:** redeploy the previous image tag. This is safe when the migrations followed the rule above.
- **Schema:** prefer a new, forward migration that fixes the problem. `npm run migrate:rollback` undoes the last batch, but some `down()` steps can't restore deleted data.
- **Data:** restore from a backup (below). This is a last resort, because everything since the backup is lost.

## Backups and restores

- **Primary:** the database provider's automated backups and point-in-time recovery. Keep them for 30 days (the retention stated in the privacy policy).
- **Secondary, off-site:** `scripts/backup-db.sh` writes a compressed `mysqldump` (consistent, without locking the tables) and deletes files older than `BACKUP_KEEP_DAYS` (default 30). Run it daily from a scheduled job with the API's `DB_*` variables and copy the file to separate storage (another provider or account), encrypted.
  ```sh
  BACKUP_DIR=/var/backups/wta scripts/backup-db.sh
  ```
- **Restore drill, every quarter and before launch:**
  1. Create an empty scratch database.
  2. Restore into it:
     ```sh
     DB_LOCAL_DBNAME=wta_restore_check RESTORE_CONFIRM=wta_restore_check \
       scripts/restore-db.sh /var/backups/wta/wta-20261021T030000Z.sql.gz
     ```
  3. Point a staging copy of the API at it, log in, and spot-check a few trips.
  4. Drop the scratch database.

  The script refuses to run unless `RESTORE_CONFIRM` names the target database.

Backups hold personal data: keep them encrypted, access-restricted, and no
longer than the retention period. Deleted accounts remain in backups until
those backups expire, as the privacy policy says.

## HTTPS, proxies and headers

- **Same site for the web app and the API.** Logins use an httpOnly session cookie that belongs to the API's host. Browsers only send it on the web app's API calls when both are on the same site, meaning the same registrable domain: `app.example.com` and `api.example.com` work, while `myapp.netlify.app` and `myapi.onrender.com` do not. Give both services hostnames under your own domain.
- **Requests that change something** must come from `CORS_ORIGIN`. The API checks the browser's `Origin` header, on top of the cookie's SameSite setting, to block cross-site request forgery.
- **TLS** is terminated by the host's load balancer.
  - The API sends HSTS and the other helmet headers.
  - The web container sends a strict Content-Security-Policy (no inline scripts, API calls only to `API_ORIGIN`), HSTS, `X-Frame-Options: DENY` and a no-referrer-leak policy.
- **`TRUST_PROXY`** must match the number of proxies in front of the API, so rate limiting sees each client's real IP. Too high a value would let clients fake their IP in `X-Forwarded-For`.
- **`CORS_ORIGIN`** must be the web app's exact origin. The API rejects browser calls from anywhere else.

## Monitoring

- **Uptime checks:** `GET https://api.example.com/health` (it also checks the database) and `GET https://app.example.com/healthz`. Alert after 2–3 failures.
- **Logs:** the API writes one JSON object per line to stdout. Send them to the host's log store and keep them for 30 days (the privacy policy's retention). Each request has an `X-Request-Id`, also on its log lines. Useful alerts:
  - a rise in `"level":50` (errors)
  - `"event":"auth.rate_limited"` spikes (password guessing)
  - `"event":"auth.login_failed"` bursts for one `emailTag`
- **Sentry**, if used:
  - In each project's settings, turn on "Prevent Storing of IP Addresses" and set data retention to 90 days (the privacy policy's figure).
  - Set an alert for new issues.

## Scaling

- **One API instance** handles a launch comfortably. Before running more than one, move the rate-limit counters to a shared store such as Redis (`rate-limit-redis`). They're in memory today, so each instance would allow its own 10 login attempts.
- **Database connections:** `DB_POOL_MAX × instances` must stay below the database's connection limit.
- **Web container:** it's stateless static files, so run as many as needed, or put a CDN in front. Files under `/static/` are cached for good; `index.html` is never cached.

## Launch checklist

- [ ] **Legal:**
  - A lawyer has reviewed the Privacy Policy and Terms.
  - Every `[bracketed]` placeholder is filled in.
  - `DraftNotice` is removed from the web app (`src/pages/Legal/legal.tsx`).
  - `LEGAL_VERSION` (web) and `TERMS_VERSION` (`config.js`) are equal.
- [ ] **Processors:** data processing agreements are in place with the host, database, SMTP and Sentry providers, and the privacy policy lists them with their regions.
- [ ] **Accounts:** a production `APP_SECRET` is generated and stored as a secret; no development values are reused.
- [ ] **Network:** `CORS_ORIGIN`, `APP_URL`, `TRUST_PROXY`, `REACT_APP_API_BASE_URL` and `API_ORIGIN` are set to the real addresses.
- [ ] **Database:** TLS on (`DB_SSL=true`), automated backups and point-in-time recovery on, and a restore drill done.
- [ ] **Email:** SPF, DKIM and DMARC pass. Verification and reset emails arrive in the inbox, not spam.
- [ ] **Monitoring:**
  - Uptime checks and alerting are configured.
  - Sentry projects are set not to store IPs.
  - Log retention is 30 days.
- [ ] **Clean slate:** test accounts created during the smoke test are deleted.

## Trying it locally

`docker-compose.yml` runs the whole stack the way production does: MySQL, the
migration step, the API with `NODE_ENV=production`, and Mailpit to catch the
emails.

```sh
APP_SECRET=$(openssl rand -hex 32) docker compose up --build
# with the web app checked out next to this repo:
APP_SECRET=$(openssl rand -hex 32) docker compose --profile web up --build
```

- API: http://localhost:8080
- Web app: http://localhost:3000
- Emails: http://localhost:8025
