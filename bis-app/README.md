# Business Impact Scoring (BIS)

An application that replaces the manual WOSG weekly scoring process: it holds the scoring queue,
distributes tickets to the committee, collects scores natively (no more Microsoft Form), aggregates
them **exactly as the current spreadsheet does**, and writes the business score back to JIRA.

Built to `BIS App Requirements v0.2`. This repository contains **Phase 1 (Foundation)** plus the
Phase 2 JIRA and Microsoft Graph adapters, coded against the real APIs.

---

## Quick start

```bash
cd bis-app
npm install
npm run seed --workspace server -- --demo   # committee, categories, config + a demo round
npm run dev:server                          # API on :4000
npm run dev:web                             # UI on :5173
```

Open http://localhost:5173 and sign in as `nikita@example.com` (coordinator) or `matt@example.com`
(committee member). Local sign-in is email-only because `AUTH_MODE=dev`; every deployed environment
uses Entra ID SSO, and the server refuses to boot in `dev` auth mode when `NODE_ENV=production`.

The demo round is seeded with the worked examples from the requirements, so the dashboard shows
ECOM-1466 at 43 / 12.8 / ratio 2.69 (Medium), ECOM-1422 at 13 / ratio 1.00 (Low) and ECOM-915 with
std dev 18.4 (Pending discussion) on first run.

### Tests

```bash
npm test --workspace server        # 33 tests over the §10 calculation module
npm run typecheck                  # server + web
```

### Production build

```bash
npm run build                      # compiles the API and the React app
npm start                          # API serves the built UI from the same origin
```

---

## How it maps to the requirements

| Requirement | Where it lives |
|---|---|
| §5 domain model | `server/src/db/schema.sql`, `server/src/services/*` |
| §6 seven categories, stored as data | `categories` table, seeded from `domain/types.ts`, editable in Settings |
| §7 ticket card / distribution pack | `web/src/components/TicketCard.tsx`, `server/src/pack/pptx.ts`, `pack/pdf.ts` |
| §8 relevance & closure rules | `services/submissionService.ts` (server-enforced) |
| §9 impartiality & feedback view | `routes/rounds.ts`, `services/resultService.ts`, `web/src/pages/FeedbackPage.tsx` |
| §10 the maths | `server/src/domain/scoring.ts` + `scoring.test.ts` |
| §11 cadence | `app_config.cadence`, Settings → Cadence |
| §12.1 JIRA | `integrations/jira.ts`, `services/jiraService.ts` |
| §12.2 Graph mail | `integrations/graph.ts`, `services/emailService.ts` |
| §12.3 Entra SSO / Azure | `auth/entra.ts`, `auth/session.ts`, `docker-compose.yml` |
| §14 audit, RBAC, config-driven, idempotent writes | `services/auditService.ts`, `auth/middleware.ts`, `app_config`, `jira_writebacks` |

A section-by-section trace, including the deliberate decisions, is in
[`docs/requirements-traceability.md`](docs/requirements-traceability.md).

---

## The calculation (§10)

`server/src/domain/scoring.ts` is a pure module - no database, no clock, no I/O - and is the only
place the maths lives. Every threshold is configuration, not a literal.

- `bis_total` = sum of the seven category scores (0–70). A `0`, including Commercial "N/A",
  counts as 0; it is never excluded.
- A submission counts only when `relevance = Yes` and it is not archived. `Unsure` and both `No`
  answers are stored and reported, but never scored.
- `business_score` = `ROUND(AVERAGE(valid totals), 0)` - Excel's half-away-from-zero rounding, with
  binary-noise correction. This integer is what goes to JIRA.
- `std_dev` = sample standard deviation (STDEV.S); `null` below two responses, as in Excel.
- `discussion_required` = `std_dev > 16`.
- `priority_ratio` = `business_score ÷ effort`, computed **only** when discussion is not required and
  effort is present; bands at ≥ 6 High, ≥ 1.8 Medium, else Low.
- The status label reproduces the spreadsheet's precedence exactly:
  no responses → blank; under 5 → "Awaiting WOSG Responses"; any "can be closed" vote → "To Close?";
  no effort → "Awaiting RA effort"; discussion → "Pending discussion"; otherwise the priority band.
- ≥ 5 responses with no discussion required is flagged **Send for Est**.

The tests assert all three worked examples from §10.5, plus the boundary cases (exactly 5 responses,
ratio exactly 6 and exactly 1.8, threshold exactly 16, single response, N/A as zero).

### Effort mapping (residual question 1)

Whether "RA Effort" is Backend + Frontend or a single poker field was still open. It is a setting:
`Settings → Scoring → Effort mapping`, with `BACKEND_PLUS_FRONTEND` as the default (ECOM-1775 = 13 + 8
= 21). Switch it to `BACKEND_ONLY`, `FRONTEND_ONLY` or `MANUAL` when RA confirms - no code change.
A coordinator can also set a per-ticket manual override, which always wins.

### Status transition on write-back (residual question 2)

Default is **write the score only**. `Settings → JIRA → Transition on finalise` turns on the optional
transition and lets you name the target status.

### Category weighting (residual question 3)

Unweighted straight sum, as today. Each category carries a `weight`, and
`Settings → Scoring → Apply category weights` switches weighting on when wanted.

---

## Impartiality (§9)

- While a round is open, a committee member's API calls can only ever return their own submissions.
  Coordinators see everything, including who scored what, because they have to chase non-responders.
- After finalisation the whole committee can open the feedback view: per-category averages, the total,
  the spread and the discussion flag, plus the unattributed list of individual totals. No names.
- "This ticket isn't relevant today" is rejected server-side unless the submitter is the ticket's
  original requestor.
- Everything is written to an append-only audit log with who and when.

Role checks are middleware on the routes, not conditions in the UI - hiding a nav link is a courtesy,
the server is the enforcement.

---

## Configuration

Copy `.env.example` to `.env`. Business rules are **not** in there - they live in the database and are
edited in Settings (thresholds, categories, cadence, effort mapping, JIRA field ids, pack branding).

### Database

Production targets Azure Database for PostgreSQL. Local development defaults to a SQLite file so the
app runs with nothing installed. The schema is one SQL file valid on both dialects; both paths are
exercised by the same migration and seed scripts.

```bash
docker compose up -d                     # local Postgres on :5432
DB_DRIVER=postgres DATABASE_URL=postgres://bis:bis@localhost:5432/bis npm run migrate --workspace server
```

### JIRA

Use a service account and an API token. To resolve the real `customfield_XXXXX` ids, open
`Settings → JIRA → Resolve field ids from JIRA`; it calls `GET /rest/api/3/field` and reports the ids
for Business Score, Backend/Frontend Poker Score, Site Affected, Original Testing Environment and
Ticket Phase. Paste them into the settings form - they are stored as config, never hard-coded.

Write-back is idempotent: the key is round + ticket + score, so re-running after a partial failure
retries only what did not land, and re-running after success is a no-op. Failures are visible on the
round page and re-triggerable. Tickets below the minimum response count are skipped, not written -
they roll over.

### Email

Microsoft Graph with an app registration (`Mail.Send` application permission) sending as a shared
mailbox or the coordinator. With `GRAPH_SEND_ENABLED=false` messages are rendered and logged but not
sent, so the cadence can be rehearsed before go-live. Every send attempt lands in `email_log` with its
status.

---

## Deployment (Azure)

Build once and run the API - it serves the React bundle from the same origin, so one App Service is
enough.

| Setting | Value |
|---|---|
| `NODE_ENV` | `production` |
| `AUTH_MODE` | `entra` (the server refuses `dev` in production) |
| `DB_DRIVER` / `DATABASE_URL` | `postgres` / your Azure Database for PostgreSQL connection string |
| `DATABASE_SSL` | `true` |
| `SESSION_SECRET` | long random string |
| `SESSION_COOKIE_SECURE` | `true` |
| `ENTRA_*` | app registration, with `ENTRA_REDIRECT_URI` = `https://<host>/auth/callback` |

Migrations run on boot and are idempotent. Members are provisioned by a coordinator; an Entra user who
is not on the committee is refused rather than silently admitted.

---

## What is deliberately not here

- **AI-drafted ticket summaries** (Phase 2). The coordinator writes the executive summary and the four
  panels; the JIRA description is imported alongside them as raw material.
- **Cross-round trend analytics** (Phase 3). Finalised rounds are snapshotted into `ticket_results`
  precisely so that work has clean data to build on.
- **Historic import.** The process starts clean, as agreed.
- **RA's estimation tooling.** Effort is read from JIRA or entered by the coordinator.
- **A scheduler process.** Distribution and reminders are exposed as endpoints and driven from the
  round page; the cadence settings say when they should fire. Wiring them to Azure WebJobs / a timer
  trigger is a small, deliberate next step rather than an assumption baked into the app.
