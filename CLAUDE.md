# Why Travel Alone: API

Express + Knex + MySQL 8 (CommonJS, Node 22 per `.nvmrc`). Serves the web app in [why-travel-alone](https://github.com/JDVM/why-travel-alone), which is checked out **next to this repo** (`../why-travel-alone`); Docker Compose and CI rely on that layout.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | API with reload. Needs `.env` (see `.env.example`); won't start without an `APP_SECRET` of 32+ characters |
| `npm test` | Node's test runner against a real MySQL test database (below) |
| `npm run migrate` / `migrate:rollback` / `migrate:status` | Knex migrations |
| `npm run seed` | Development seeds (they refuse to run in production) |

### Tests

The tests wipe and re-seed their database, so they only run against `DB_TEST_DBNAME`, which must differ from `DB_LOCAL_DBNAME`:

```sh
mysql -e "CREATE DATABASE wta_test"   # once, and grant your DB user access
echo "DB_TEST_DBNAME=wta_test" >> .env
npm test
```

Add a test with every change; CI runs them against MySQL 8, plus `npm audit --omit=dev --audit-level=high`.

### Full stack (production-like)

```sh
APP_SECRET=$(openssl rand -hex 32) TRUST_PROXY=1 docker compose --profile web up -d --build
```

- This runs MySQL, the migration step, the API with `NODE_ENV=production`, Mailpit (http://localhost:8025) and the web app from `../why-travel-alone` (http://localhost:3000).
- Use `localhost`, not `127.0.0.1`: the session cookie depends on it.
- Rate limits are in memory, so repeated local runs can hit "Too many attempts". `docker restart why-travel-alone-api-api-1` resets them.
- The browser tests live in the web repo (`npm run e2e` there).

## Layout

- `server.js` starts `app.js`, which builds the app (middleware, rate limits, routes) so tests can create their own instance.
- `config.js`: settings and startup checks (`configErrors`, `appSecret`, `corsOrigins`, `trustProxy`, `TERMS_VERSION`).
- `routes/`: one router per area (auth, account, profile, travelers, trips, invitations, destinations, typesOfTravel).
- `middleware/`:
  - `authenticate`: the session cookie.
  - `trustedOrigin`: CSRF; non-GET requests need an allowed `Origin`.
  - `requireVerifiedEmail`
  - `errorHandler`
- `utils/`: sessions, account tokens (email verification and reset), validation, traveler shaping, error reporting.
- `DB_Setup/migrations`, `DB_Setup/seeds`: Knex.
- `DEPLOYMENT.md`: environment variables, releases, backups, scaling and the launch checklist. Keep it current when settings change.
- `.claude/agents/`: specialist guides (express, knex, mysql, auth, owasp-top10). Read the relevant one before larger changes.

## Conventions

- **Sessions:**
  - Sign-in is the `wta_session` cookie: httpOnly, Secure (unless `COOKIE_SECURE=false`), SameSite=Lax.
  - Only the sha256 of the session id is stored (`sessions` table).
  - Sessions expire after 14 days idle or 30 days at most.
  - A password reset or account deletion ends all of the account's sessions. There are no JWTs.
- **The web app and API must be same-site** (e.g. `app.` and `api.` subdomains of one domain), with `CORS_ORIGIN` set to the app's exact origin.
- **Privacy:**
  - `has_kids` and `special_considerations` go only to the traveler themselves and to owners of trips they're on.
  - Special considerations need recorded consent.
  - Never log emails, passwords, session ids, headers or bodies: logs carry account ids, and `emailTag` for failed logins.
- **Migrations:** add new files only; **never rename or edit an applied migration**. Knex records filenames, so a rename breaks existing databases. Keep the existing `<n>-<timestamp>_name.js` pattern.
- **Errors:** respond `{ error: "message" }` with a fitting status; the web app shows that message. Unexpected errors go through `errorHandler` (logged, and reported to Sentry when configured).
- **Rate limits** (`app.js`) are in memory. Before running more than one API instance, move them to a shared store such as Redis (`rate-limit-redis`); see `DEPLOYMENT.md`.
- **Comments** explain why, in plain sentences. Match the surrounding code's style.

## Workflow

- One pull request per change, with a short summary and what was tested. Merge once CI passes ("merge each when verified").
- A change spanning both repos uses the **same branch name** in each: each repo's CI runs the browser tests against the other's branch of that name (else `main`). Merge this repo's PR first, then the web app's.
- `TERMS_VERSION` here must equal `LEGAL_VERSION` in the web app (`src/pages/Legal/legal.tsx`).

## Still to do

- Shared rate-limit store (Redis), only when scaling past one instance.
- The launch checklist in `DEPLOYMENT.md` (legal review, processors, real addresses, backups drill, email DNS, monitoring).
