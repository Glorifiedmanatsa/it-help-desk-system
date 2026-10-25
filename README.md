# IT Help Desk Management System

A full-stack IT service management (ITSM) web app. Employees report IT problems, IT staff triage, assign and resolve them against response-time targets, and admins manage users and review SLA reports. Resolved tickets can be turned into a staff-only knowledge base.

**Stack:** React 19 · Vite 8 · Express 5 · PostgreSQL · Prisma 6 · JWT · Zod · Nodemailer · Vitest

> **Live demo:** not deployed yet. See [Deployment](#deployment) for the Render and Railway recipes.

## Screenshots

<!--
  Add PNGs to docs/screenshots/ with these names, then delete this comment and the line below.
  ![Ticket queue](docs/screenshots/ticket-list.png)
  ![Ticket detail](docs/screenshots/ticket-detail.png)
  ![Reports](docs/screenshots/reports.png)
  ![Knowledge base](docs/screenshots/knowledge-base.png)
  ![Sign in](docs/screenshots/sign-in.png)
-->

_Screenshots coming soon. The UI uses a left sidebar, a main work area and a right-hand information panel. Ticket pages show the key (e.g. `HD-0002`), status, priority and category badges, an activity feed, and a details panel with requester, assignee, SLA and dates._

## Features

| Area | What it does |
|---|---|
| **Roles** | Three roles: **Employee**, **IT staff** and **Admin**. Every API route checks the role on the server. The React route guards only improve the user experience. |
| **Tickets** | Employees create tickets with a category, a suggested urgency and up to 5 attachments (PDF/PNG/JPG/DOCX, 5 MB each). Tickets get readable IDs like `HD-0001`. The list can be filtered and sorted by status, priority, category and assignee, and searched by title or ticket number. Employees only ever see their own tickets. |
| **Workflow** | `Open → Assigned → In progress → Waiting on user / Resolved → Closed`. Illegal transitions are rejected by a single state-machine module (`server/src/services/workflow.js`). Resolving requires resolution notes. Only the submitter can close a ticket, or reopen it within 7 days of resolution. Only admins can reassign. |
| **Activity & history** | Every assignment, priority, status, comment and attachment change is written to `ticket_history`. It shows in an activity feed with *All / Comments / History* tabs. |
| **Comments** | Public replies, plus staff-only **internal notes**. Internal notes are hidden from employees in both the comments and the history. |
| **Priority & SLA** | Staff confirm the priority. First-response targets: Critical 1h, High 4h, Medium 1d, Low 3d. Breaches are flagged on lists and counted in reports. |
| **Email** | Sent on assignment, public comments and resolution. Without SMTP settings, emails are printed to the API console instead. |
| **Reports** (admin) | Average first-response and resolution times, overall and per priority. Counts by status, category and assignee for a date range. CSV export, optionally with one row per ticket. |
| **Knowledge base** (staff/admin) | "Save to knowledge base" on resolved or closed tickets pre-fills an article. Search across title, problem, solution and tags, with a category filter. Authors edit their own articles; admins can edit or delete any. Employees are always rejected. |
| **Admin** | List and search users, change roles, and deactivate or reactivate accounts. Admins can't demote or deactivate themselves. |
| **Responsive UI** | The sidebar collapses into a slide-out menu, the information panels stack below the content, and tables turn into cards on small screens. |

## Security

- Passwords hashed with **bcrypt** (12 rounds). Login takes the same time whether or not the email exists, and is rate-limited.
- **JWT** bearer auth. The user is reloaded on every request, so deactivation and role changes take effect immediately.
- **Zod** validation on every body, query and route parameter. Prisma uses parameterized queries.
- **Uploads:** an extension, MIME type and file-signature whitelist plus a size cap. Files are stored outside the web root under random names and served only after an access check.
- **Helmet** security headers, a CORS allow-list, a 100 KB JSON body limit, and protection against spreadsheet-formula injection in CSV exports.
- **Optimistic concurrency:** if two staff update the same ticket at once, the second gets a "refresh and try again" message instead of silently overwriting the first.
- **Secrets:** only `.env.example` files are committed. Real `.env` files, uploads and build output are ignored by Git.

## Architecture

```
Employee ─┐
Staff ────┼─> React SPA (Vite) ──JWT / REST (/api)──> Express API ──Prisma──> PostgreSQL
Admin ────┘                                               ├──> SMTP (Nodemailer, optional)
                                                          └──> uploads/ (attachments on disk)
```

- **Monorepo:** `client/` (React) and `server/` (Express) each have their own `package.json`. The root `package.json` runs both with `concurrently`.
- **Layered API:** routes (validation, auth) → services (business rules, transactions) → Prisma.
  - Every ticket write and its history rows happen in one transaction.
  - Email notifications are fire-and-forget, so a mail failure never fails a request.
- **Reports** use SQL aggregations (`$queryRaw` with bound parameters) rather than loading tickets into memory.
- In development, Vite proxies `/api` to the API on port 4000. In production the client calls `VITE_API_URL`.

```
server/
  prisma/schema.prisma           data model: users, tickets, ticket_comments, ticket_history, attachments, knowledge_articles
  prisma/migrations/             versioned SQL migrations
  prisma/seed.js                 demo users, sample tickets, one KB article (safe to re-run)
  src/routes/                    auth, users, tickets, knowledge, reports
  src/services/workflow.js       status state machine (pure, unit-tested)
  src/services/ticketService.js  ticket writes + history in transactions
  src/services/reportService.js  SQL aggregations for reports and CSV
  src/middleware/                auth/roles, validation, uploads, errors
  tests/                         Vitest + Supertest
client/
  src/components/                app shell (sidebar layout), badges, avatars, icons
  src/pages/                     one file per screen
  src/auth/                      auth context + route guard
  src/api.js                     fetch wrapper (JWT, errors, downloads)
```

## Getting started on Windows with PostgreSQL

These steps were tested on Windows 11 with **Node.js 22** and **PostgreSQL 18**. Any PostgreSQL from 16 up should work.

### 1. Prerequisites
- **Node.js 20.19 or newer** (22 LTS recommended): <https://nodejs.org>
- **PostgreSQL:** download the installer from <https://www.postgresql.org/download/windows/>.
  - Keep port **5432** and choose a password for the `postgres` superuser.
  - Stack Builder isn't needed.

### 2. Create the database user and database
Open **SQL Shell (psql)** from the Start menu, sign in as `postgres`, and run:

```sql
CREATE ROLE helpdesk LOGIN CREATEDB;
\password helpdesk
CREATE DATABASE helpdesk OWNER helpdesk;
```

`OWNER helpdesk` matters: since PostgreSQL 15, only the database owner can create tables in the `public` schema. `CREATEDB` is only needed for `db:reset` and `db:migrate`.

### 3. Install and configure
In PowerShell, from the project folder:

```powershell
npm run setup                                   # installs root, server and client dependencies
Copy-Item server\.env.example server\.env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # copy the output into JWT_SECRET
```

Then edit `server/.env`:
- Set `JWT_SECRET` to the value you just generated.
- Set `DATABASE_URL` to your user, password and port **5432**:

```
DATABASE_URL="postgresql://helpdesk:YOUR_PASSWORD@localhost:5432/helpdesk?schema=public"
```

If the password contains `@ : / # %` or other symbols, URL-encode them (e.g. `@` → `%40`). The `.env.example` uses port 5433, which is the Docker setup below.

### 4. Create the tables and demo data, then run

```powershell
npm run db:deploy    # applies migrations (prisma migrate deploy)
npm run db:seed      # demo accounts, 5 sample tickets, 1 knowledge-base article
npm run dev          # API on http://localhost:4000, web app on http://localhost:5173
```

Open **http://localhost:5173**. Stop with `Ctrl+C`.

### Alternative: PostgreSQL in Docker
With Docker Desktop installed, `npm run db:up` starts PostgreSQL 16 on port **5433**, which matches `.env.example`. Then run the same `db:deploy`, `db:seed` and `dev` steps.

## Demo accounts

After seeding, every account uses the password **`Password123!`**. These are for local demos only; change or remove them in any shared deployment.

| Role | Email |
|---|---|
| Admin | `admin@helpdesk.test` |
| IT staff | `staff@helpdesk.test`, `staff2@helpdesk.test` |
| Employee | `employee@helpdesk.test`, `employee2@helpdesk.test` |

The sign-in page has one-click buttons that fill these in. They show in development, or when `VITE_SHOW_DEMO_ACCOUNTS=true`.

The seed creates one ticket in each status, `HD-0001` to `HD-0005`. A good walkthrough:
1. As **employee**, close or reopen the resolved ticket, then submit a new ticket.
2. As **staff**, assign it, set its priority, add an internal note and resolve it.
3. As **admin**, open Users and Reports and export a CSV.

## Scripts

| Command (from the repo root) | What it does |
|---|---|
| `npm run setup` | Install all dependencies |
| `npm run dev` | Run the API and web app together |
| `npm test` | Run the API test suite |
| `npm run build` | Production build of the client into `client/dist` |
| `npm run db:deploy` | Apply pending migrations |
| `npm run db:seed` | Load demo data. Safe to re-run: existing users are untouched and sample tickets are added only once. |
| `npm run db:migrate` | Create a new migration after editing `schema.prisma` (development only) |
| `npm run db:reset --prefix server` | **Deletes all data**, then re-migrates and re-seeds |
| `npm run db:studio --prefix server` | Browse the data in Prisma Studio |

## Tests

`npm test` runs **53 tests** (Vitest + Supertest) in about 20 seconds. The database is mocked, so no PostgreSQL is needed. They cover:

- **Authentication:** missing, forged and deactivated-user tokens are rejected.
- **Role-based access:** the knowledge base rejects employees, only admins can delete articles, and admins can't remove their own admin role.
- **Workflow:** every legal and illegal status transition, who may close or reopen, the 7-day reopen window, required resolution notes, and when `first_response_at` is set.
- **SLA:** the priority fallback, breach detection before and after the first response.
- **Validation and CSV:** bad payloads, unknown filter values, CSV quoting and formula-injection protection.

## Deployment

### Option A: Render (Blueprint)
1. On Render, choose **New → Blueprint** and pick this repo. `render.yaml` creates `helpdesk-db` (PostgreSQL), `helpdesk-api` (web service) and `helpdesk-web` (static site).
2. Set the variables marked `sync: false`:
   - API `CLIENT_URL` = the static site URL
   - web `VITE_API_URL` = the API URL
   - the SMTP settings are optional
3. After the first deploy, run `npm run db:seed` from the API service's **Shell** tab.
4. Redeploy the static site whenever `VITE_API_URL` changes, because Vite builds it into the site.

Things to know about Render's free plan:
- Services sleep after about 15 minutes idle, and the first request afterwards takes 30–60 seconds.
- The disk is wiped on every deploy and restart, so attachments are lost.
- Free databases expire after 30 days.

Migrations run on every start (`npm run start:prod`).

### Option B: Railway
1. **API:** create a service with root `server`, build command `npm install`, start command `npm run start:prod`.
2. **Database:** add a PostgreSQL plugin and set `DATABASE_URL=${{Postgres.DATABASE_URL}}`. Also set `NODE_ENV=production`, `JWT_SECRET` and `CLIENT_URL`.
3. **Web:** create a second service with root `client`, build command `npm install && npm run build`, start command `npx vite preview --host 0.0.0.0 --port $PORT`, and `VITE_API_URL` set to the API URL.
4. For persistent attachments, add a Volume and set `UPLOAD_DIR` to it.

### API environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string. Add `?sslmode=require` for external hosted URLs. |
| `JWT_SECRET` | yes | At least 32 characters in production |
| `CLIENT_URL` | yes | Frontend origin(s) for CORS and email links, comma-separated |
| `PORT` | no | Default `4000` |
| `JWT_EXPIRES_IN` | no | Default `8h` |
| `UPLOAD_DIR` / `MAX_UPLOAD_MB` | no | Default `server/uploads` / `5` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | no | Without `SMTP_HOST`, emails are logged to the console |

## Design notes

- **First response** is the first action by IT staff other than the submitter: an assignment, priority change, status change or public comment. Internal notes don't count, because the employee can't see them.
- **SLA** uses the confirmed priority, or the suggested urgency until staff confirm one. Unanswered tickets count as breached once their target passes.
- **Report dates** are UTC calendar days, and `to` is inclusive.

## Known limitations

- **Not deployed yet**, so there's no public demo URL.
- **Attachments are stored on the local disk.** On free cloud plans they're lost on redeploy; production use needs a persistent disk or object storage such as S3 or R2.
- **API tests use a mocked database.** Real-database behaviour (migrations, SQL reports) was checked manually, not by automated integration tests. There are no front-end tests yet.
- **Priority filter:** it matches the *confirmed* priority, so tickets whose priority staff haven't confirmed yet (only a suggested urgency) don't appear under any priority.
- **Staff "My tickets"** shows tickets *assigned to* the signed-in staff member. Tickets a staff member submitted themselves are at `/my-tickets`, which has no sidebar link.
- **No password reset, SSO or email verification.** New self-registered accounts are employees and must be promoted by an admin.
- **Background jobs:** there are none, so there are no SLA-warning emails before a breach.
- **Deprecation warning:** Prisma 6 warns that the `package.json#prisma` seed setting is deprecated. It's harmless until an upgrade to Prisma 7.

## Out of scope (v1) / future work

Live chat, native mobile apps, AI classification, third-party integrations, employee access to the KB, and suggested articles while typing were out of scope for v1. Natural next steps:

- Object storage for attachments
- Password reset and SSO (Azure AD / Google Workspace)
- SLA-warning jobs
- Integration tests against a real PostgreSQL
- Front-end component tests
- Dark mode
