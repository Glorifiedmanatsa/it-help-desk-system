# IT Help Desk Management System

A web app for reporting IT problems and tracking them to resolution. Employees submit tickets, IT staff triage, assign and resolve them, and admins manage users and view SLA reports. Resolved tickets can be turned into a staff-only knowledge base.

**Stack:** React 19 (Vite) · Express 5 · PostgreSQL · Prisma · JWT auth · Nodemailer

```
Employee ─┐
Staff ────┼─> React client ──JWT/REST──> Express API ──> PostgreSQL
Admin ────┘                                   ├──> SMTP email
                                              └──> uploads/ (attachments)
```

## Features

| Area | What it does |
|---|---|
| **Tickets** | Create with up to 5 attachments (PDF/PNG/JPG/DOCX, 5MB each). IDs like `HD-0001`. Filter and sort by status, priority, category and assignee. Employees see only their own tickets. |
| **Workflow** | `Open → Assigned → In progress → Waiting on user / Resolved → Closed`. Only legal transitions are allowed, and all of them go through one service (`server/src/services/workflow.js`). Resolving requires notes. Only the submitter can close a ticket, or reopen it within 7 days of resolution. Only admins can reassign. |
| **History** | Every assignment, priority, status, comment and attachment change is written to `ticket_history` and shown as a timeline. |
| **Comments** | Public replies plus staff-only internal notes, which are hidden from employees in both the comments and the timeline. |
| **Priority & SLA** | The employee suggests an urgency and staff confirm the priority. The first-response SLA targets are Critical 1h, High 4h, Medium 1d, Low 3d. Breaches get a badge on lists and are counted in reports. |
| **Email** | Sent on assignment, public comments and resolution. Without SMTP settings, emails are printed to the API console instead. |
| **Reports** (admin) | Average first-response and resolution times, overall and per priority. Counts by status, category and assignee for a date range. CSV export, optionally with one row per ticket. |
| **Knowledge base** (staff/admin) | "Save to knowledge base" on resolved or closed tickets pre-fills the article. Full-text search across title, problem, solution and tags, with a category filter. Creators edit their own articles; admins can edit or delete any. Employees are always rejected (FR26). |
| **Security** | bcrypt password hashing. JWT auth that re-checks the user on every request, so deactivation takes effect immediately. Role middleware on every route. Zod validation. Prisma parameterized queries. Upload whitelist plus file-signature check. Helmet, CORS allow-list, login rate limiting, and CSV formula-injection guard. |

## Demo accounts

After seeding, all accounts use the password **`Password123!`**:

| Role | Email |
|---|---|
| Admin | `admin@helpdesk.test` |
| IT staff | `staff@helpdesk.test`, `staff2@helpdesk.test` |
| Employee | `employee@helpdesk.test`, `employee2@helpdesk.test` |

## Local development

**Prerequisites:** Node.js 20.19+ (22 recommended), and Docker Desktop for the database.

```bash
npm run setup            # installs root, server/ and client/ dependencies
cp server/.env.example server/.env   # then set JWT_SECRET to a long random string
npm run db:up            # starts PostgreSQL in Docker on localhost:5433
npm run db:deploy        # applies migrations
npm run db:seed          # demo users, sample tickets, one KB article
npm run dev              # API on :4000, React on http://localhost:5173
```

The React dev server proxies `/api` to the API, so `client/.env` isn't needed locally.

**Already have PostgreSQL installed instead of Docker?** Create a database and user, then point `DATABASE_URL` in `server/.env` at it, e.g. `postgresql://helpdesk:helpdesk@localhost:5432/helpdesk?schema=public`. Skip `npm run db:up`.

### Useful scripts

| Command | What it does |
|---|---|
| `npm test` | API tests: workflow transitions, RBAC, KB employee rejection, validation, SLA and CSV |
| `npm run db:migrate` | Create a new migration after editing `server/prisma/schema.prisma` (commit the generated folder) |
| `npm run db:reset --prefix server` | Drop, re-migrate and re-seed the local database |
| `npm run db:studio --prefix server` | Browse the data in Prisma Studio |
| `npm run build` | Production build of the client into `client/dist` |

## Project structure

```
server/
  prisma/schema.prisma        data model (users, tickets, comments, history, attachments, knowledge_articles)
  prisma/migrations/          versioned SQL migrations
  prisma/seed.js              demo data
  src/routes/                 auth, users, tickets, knowledge, reports
  src/services/workflow.js    the status state machine (pure, unit-tested)
  src/services/ticketService.js  ticket writes + history in transactions
  src/services/reportService.js  SQL aggregations for reports/CSV
  src/middleware/             auth/roles, validation, uploads, errors
  tests/                      vitest + supertest
client/
  src/pages/                  one file per screen
  src/auth/                   auth context + route guard
  src/api.js                  fetch wrapper (JWT, errors, downloads)
```

## Deployment

### Option A — Render (recommended first)

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, pick the repo. `render.yaml` creates `helpdesk-db` (PostgreSQL), `helpdesk-api` (web service) and `helpdesk-web` (static site).
3. When prompted for the unset variables:
   - `helpdesk-api` → `CLIENT_URL` = the static site URL, e.g. `https://helpdesk-web.onrender.com`
   - `helpdesk-web` → `VITE_API_URL` = the API URL, e.g. `https://helpdesk-api.onrender.com`
   - SMTP settings are optional. Without them, emails only go to the API logs.
4. After the first deploy, seed demo data from the API service's **Shell** tab: `npm run db:seed`.
5. If you change `VITE_API_URL` later, redeploy the static site, because Vite bakes it in at build time.

**Render gotchas**

- **Cold starts:** free web services sleep after ~15 minutes idle. The first request afterwards takes **30–60 seconds**. The UI shows a "server may be waking up" message if a request fails during that time.
- **Attachments are ephemeral on the free plan.** The disk is wiped on every deploy and restart. For persistent files, upgrade the API to a paid instance, add a **Disk** mounted at e.g. `/var/data`, and set `UPLOAD_DIR=/var/data/uploads`. Alternatively, move attachments to S3-compatible storage (see Future work).
- **SSL:** the Blueprint uses Render's *internal* database URL, which needs no SSL settings. If you connect from outside Render (e.g. running migrations from your PC), use the *external* URL and append `?sslmode=require`.
- **Migrations** run on every start (`npm run start:prod` → `prisma migrate deploy && node src/index.js`). `prisma` is a production dependency on purpose, so it's available at runtime.
- **CORS:** `CLIENT_URL` must exactly match the static site's origin (no trailing slash). Separate multiple origins with commas.
- **Free PostgreSQL expires** after 30 days on Render. Upgrade it or move to Railway (below).

### Option B — Railway (fallback)

The same repo and migrations work. Only the environment variables change.

1. **New Project → Deploy from GitHub repo**, then add a **PostgreSQL** database to the project.
2. **API service:** set Root Directory to `server`, Build Command to `npm install` and Start Command to `npm run start:prod`. Add these variables:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (reference variable)
   - `NODE_ENV=production`, `JWT_SECRET=<48+ random chars>`, `CLIENT_URL=<web URL>`
   - Generate a public domain under Settings → Networking.
3. **Web service:** add a second service from the same repo. Set Root Directory to `client`, Build Command to `npm install && npm run build`, and Start Command to `npx vite preview --host 0.0.0.0 --port $PORT`. Set `VITE_API_URL=<API URL>`.
4. Seed once: `railway run --service <api> npm run db:seed`, or use the service shell.
5. For persistent attachments, add a **Volume** to the API service mounted at `/data` and set `UPLOAD_DIR=/data/uploads`.

### Production environment variables (API)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string (`?sslmode=require` for external URLs) |
| `JWT_SECRET` | yes | ≥ 32 characters in production |
| `CLIENT_URL` | yes | Frontend origin(s) for CORS and email links |
| `JWT_EXPIRES_IN` | no | Default `8h` |
| `UPLOAD_DIR` | no | Default `server/uploads` |
| `MAX_UPLOAD_MB` | no | Default `5` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | no | Without `SMTP_HOST`, emails are logged |

## Design notes

- **First response** is set by the first action from IT staff who aren't the submitter: an assignment, priority change, status change or public comment. Internal notes don't count, because the employee can't see them.
- **SLA** uses the confirmed priority, or the suggested urgency until staff confirm one. Tickets with no response yet count as breached once their target passes.
- **Concurrency:** ticket updates are conditional on the status and assignee that were read, so two staff acting at once get a "refresh and try again" error instead of silently overwriting each other.
- **Report dates** are interpreted as UTC calendar days, and `to` is inclusive.

## Out of scope (v1) / future work

Live chat, native mobile apps, AI classification, third-party integrations, employee access to the KB, and suggested articles while typing are out of scope for v1. Other natural next steps:

- Attachments in S3/R2 object storage instead of local disk
- Password reset by email; SSO (Azure AD / Google Workspace)
- Background job to email staff about tickets close to breaching their SLA
- Dark mode
