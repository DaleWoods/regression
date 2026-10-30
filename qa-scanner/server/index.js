// HTTP API + dashboard host. Binds to 0.0.0.0 (configurable) so colleagues on
// the office network can reach it. The Anthropic API key never leaves the
// server — the browser only ever sees rendered results.
import path from 'node:path';
import express from 'express';
import { config, loadBrands, findBrand, ROOT, USER_AGENT } from '../src/config.js';
import { renderReportBody, toCsv, REPORT_CSS } from '../src/report.js';
import {
  authMiddleware,
  checkCredentials,
  setSessionCookie,
  clearSessionCookie,
} from './auth.js';
import * as store from './store.js';
import * as scans from './scan-manager.js';

if (!config.password && config.users.length === 0 && !config.authDisabled) {
  console.error(
    'Refusing to start: set DASHBOARD_PASSWORD (or DASHBOARD_USERS) in .env.\n' +
      'For local development only, AUTH_DISABLED=1 skips the login wall.'
  );
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
app.use(express.json());

const publicDir = path.join(ROOT, 'public');

// ── Unauthenticated: login page + login endpoint ──────────────────────────
app.get('/login.html', (req, res) => res.sendFile(path.join(publicDir, 'login.html')));
app.post('/login', (req, res) => {
  const { username = '', password = '' } = req.body || {};
  const user = checkCredentials(username, password);
  if (!user) return res.status(401).json({ error: 'Wrong password' });
  setSessionCookie(res, user);
  res.json({ ok: true });
});
app.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

// ── Everything below requires a session ───────────────────────────────────
app.use(authMiddleware);

// The dashboard reuses the exact report styling the standalone report uses.
app.get('/report.css', (req, res) => res.type('text/css').send(REPORT_CSS));
app.use(express.static(publicDir));

app.get('/api/brands', (req, res) => {
  res.json(
    loadBrands().map((b) => ({
      id: b.id,
      name: b.name,
      brandColour: b.brandColour,
      logo: b.logo,
      state: scans.getState(b.id),
      lastScan: store.resultsMeta(b.id),
    }))
  );
});

function withBrand(handler) {
  return (req, res) => {
    const brand = findBrand(req.params.id);
    if (!brand) return res.status(404).json({ error: `unknown brand "${req.params.id}"` });
    return handler(brand, req, res);
  };
}

app.post(
  '/api/brands/:id/scan',
  withBrand((brand, req, res) => {
    try {
      const state = scans.startScan(brand);
      res.status(202).json({ ok: true, state });
    } catch (e) {
      if (e.code === 'ALREADY_RUNNING') return res.status(409).json({ error: e.message });
      res.status(500).json({ error: String(e?.message || e) });
    }
  })
);

app.get(
  '/api/brands/:id/status',
  withBrand((brand, req, res) => {
    res.json({ state: scans.getState(brand.id), lastScan: store.resultsMeta(brand.id) });
  })
);

app.get(
  '/api/brands/:id/results',
  withBrand((brand, req, res) => {
    const results = store.loadResults(brand.id);
    if (!results) return res.status(404).json({ error: 'no results yet' });
    res.json(results);
  })
);

app.get(
  '/api/brands/:id/report',
  withBrand((brand, req, res) => {
    const results = store.loadResults(brand.id);
    if (!results) return res.status(404).send('<p class="qa-report">No scan results yet.</p>');
    res.type('text/html').send(renderReportBody(results));
  })
);

app.get(
  '/api/brands/:id/issues.csv',
  withBrand((brand, req, res) => {
    const results = store.loadResults(brand.id);
    if (!results) return res.status(404).json({ error: 'no results yet' });
    res
      .type('text/csv')
      .setHeader('Content-Disposition', `attachment; filename="${brand.id}-issues.csv"`)
      .send(toCsv(results));
  })
);

app.listen(config.port, config.host, () => {
  console.log(`QA scanner listening on http://${config.host}:${config.port}`);
  console.log(`Crawler User-Agent (for the Akamai allowlist): ${USER_AGENT}`);
  if (config.authDisabled) console.warn('WARNING: login wall disabled (AUTH_DISABLED=1)');
});
