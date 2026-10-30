# Multi-brand QA Scanner

Internal, password-protected web app for running QA scans of the retail sites
(Goldsmiths, Mappin & Webb, Watches of Switzerland). One tab per brand; each
scan renders pages in headless Chromium and reports:

- **Broken images** — detected by rendering (`img.decode()` / `naturalWidth`),
  not guessed from status codes
- **Broken links** — deduped and cached across pages per scan
- **Failed sub-resources** — 4xx/5xx or network failures while the page loads
- **Metadata gaps** — missing title / meta description / H1 / alt text
- **Semantic copy issues** — each page's title, description, schema.org data
  and visible copy is sent to the Anthropic API to flag contradictions (white
  vs yellow gold, automatic vs quartz, strap vs bracelet, …) and terminology
  inconsistencies

Results are stored per brand as JSON on disk, so opening a tab shows the last
run immediately and everyone sees the same shared results.

> **Note on the engine:** the Node + Playwright engine described in the brief
> was not present in this repository (the repo contains the Java/Selenium
> framework), so the engine was implemented here to the brief's spec with the
> same module layout — `src/sitemap.js`, `src/checks.js`, `src/semantic.js`,
> `src/links.js`, `src/scan.js`, `src/report.js`, `src/cli.js`. If you have an
> existing copy of these modules, they can be dropped in file-for-file.

## Setup

Requires Node 18+.

```sh
cd qa-scanner
npm install
npx playwright install --with-deps chromium
# If you lack sudo, --with-deps will fail on the system packages; then run
#   npx playwright install chromium
# and ask the host owner to run:  npx playwright install-deps chromium

cp .env.example .env
$EDITOR .env      # set DASHBOARD_PASSWORD and ANTHROPIC_API_KEY at minimum
```

Run it:

```sh
npm start
# → QA scanner listening on http://0.0.0.0:3000
```

Open `http://<host>:3000` from any machine on the office network, sign in with
the shared password, pick a brand tab, hit **Run scan**.

## Configuration

Everything is in `.env` (see `.env.example` for all options) and
`config/brands.json`.

### Brands are config, not code

`config/brands.json` — one block per site:

```json
{
  "id": "goldsmiths",
  "name": "Goldsmiths",
  "sitemapUrl": "https://www.goldsmiths.co.uk/sitemap.xml",
  "brandColour": "#8a7147",
  "logo": "/logos/goldsmiths.svg",
  "maxPages": 100,
  "concurrency": 2
}
```

Adding a brand = add a block here (plus drop a logo SVG/PNG into
`public/logos/`) and restart. No code changes. `maxPages`/`concurrency` are
optional per-brand overrides of the `.env` defaults.

**⚠️ Confirm the sitemap URLs** — the three URLs currently in `brands.json`
are best guesses (`/sitemap.xml` on each site) and need verifying/replacing
with the real ones. Sitemap indexes are auto-recursed; `.gz` sitemaps and
local files also work.

### Akamai allowlist — where the User-Agent is set

The crawler's User-Agent is defined in **`src/config.js`** (the `USER_AGENT`
constant at the top, overridable via `SCANNER_USER_AGENT` in `.env`). Default:

```
WoSG-QA-Scanner/1.0 (+internal-qa)
```

Every request the scanner makes uses it: page loads in Chromium, sub-resource
fetches, sitemap fetches and link checks. Match that exact string in your
Akamai bot allowlist (and/or allowlist the server's IP). The server also
prints it on startup.

### Politeness

Default scan concurrency is 2 pages in parallel (`SCAN_CONCURRENCY`), 4
parallel link checks (`LINK_CONCURRENCY`), and 100 pages per scan
(`MAX_PAGES`). Raise carefully — these hit production.

### Login wall

Shared password via `DASHBOARD_PASSWORD` (required — the server refuses to
start without one). Optional per-user logins via
`DASHBOARD_USERS=alice:pw1,bob:pw2`. Sessions are signed HttpOnly cookies;
no external auth service involved.

### Anthropic API key

`ANTHROPIC_API_KEY` in `.env`, server-side only — it is never sent to the
browser. If unset, semantic checks are skipped and everything else still runs.
`SEMANTIC_MODEL` defaults to `claude-opus-5`; `SEMANTIC_EFFORT` (low/medium/
high) trades depth against cost/latency per page. Refused/failed semantic
calls are logged and skipped, never fail a scan (the request also opts into
Anthropic's server-side fallback so classifier false-positives are retried on
a fallback model automatically).

## HTTP API

All endpoints require the session cookie (log in via `POST /login`).

| Method & path                     | Purpose |
|-----------------------------------|---------|
| `POST /api/brands/:id/scan`       | Start a scan for a brand (409 if already running) |
| `GET  /api/brands/:id/status`     | Scan state + progress (`{done,total,currentUrl}`) |
| `GET  /api/brands/:id/results`    | Latest stored results (JSON) |
| `GET  /api/brands/:id/report`     | Latest results as the HTML report fragment |
| `GET  /api/brands/:id/issues.csv` | Latest results as CSV |
| `GET  /api/brands`                | Brand list with state + last-scan summary |

## CLI (no web app)

```sh
node src/cli.js --brand goldsmiths
node src/cli.js --sitemap https://example.com/sitemap.xml --max-pages 50
node src/cli.js --urls https://a.com/p1,https://a.com/p2 --out out/ --no-semantic
```

Outputs `report.html`, `issues.csv`, `results.json` into `--out` (default
`out/`).

## Cloud hosting (alternative to the internal server)

The app is containerised (`Dockerfile`) and ships a Render blueprint
(`render.yaml` at the repo root). On [Render](https://render.com):
**New → Blueprint → select this repository**, set `DASHBOARD_PASSWORD` and
`ANTHROPIC_API_KEY` when prompted, and you get an always-on HTTPS URL.
Scan results persist on the attached disk. Note: cloud egress IPs are less
predictable than a VPS's, so rely on the User-Agent allowlist in Akamai
(see below). The same Dockerfile works on Railway, Fly.io, or any VPS with
Docker.

## Run as a service

### With root: systemd

Copy the checkout to e.g. `/opt/qa-scanner`, then:

```sh
sudo cp deploy/qa-scanner.service /etc/systemd/system/
sudo $EDITOR /etc/systemd/system/qa-scanner.service   # set User + paths
sudo systemctl daemon-reload
sudo systemctl enable --now qa-scanner
journalctl -u qa-scanner -f
```

### Without root: pm2

```sh
npm install -g pm2
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup      # follow its instructions; if you can't sudo, add
                 # "@reboot pm2 resurrect" to your crontab instead
```

Both survive logout; systemd (or the pm2 startup hook / crontab entry)
survives reboot.

## Storage

Latest results per brand live in `data/<brandId>/results.json` (override the
location with `DATA_DIR`). Only the most recent scan is kept.

## Still to confirm (from the brief)

- Real sitemap URLs for the three sites → `config/brands.json`
- Host details (sudo? open port?) → pick systemd vs pm2, set `PORT`
- Office-network reachability → app binds `0.0.0.0`; test `http://<host>:3000`
