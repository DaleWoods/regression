import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

// ── Crawler identity ──────────────────────────────────────────────────────
// Every request the scanner makes (page loads in Chromium, sub-resource
// fetches, and link checks) is sent with this User-Agent. Match this exact
// string in the Akamai bot allowlist. Override via SCANNER_USER_AGENT in .env.
export const USER_AGENT =
  process.env.SCANNER_USER_AGENT || 'WoSG-QA-Scanner/1.0 (+internal-qa)';

function int(value, fallback) {
  const n = parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseUsers(raw) {
  return raw
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf(':');
      return idx > 0
        ? { username: pair.slice(0, idx), password: pair.slice(idx + 1) }
        : null;
    })
    .filter(Boolean);
}

export const config = {
  host: process.env.HOST || '0.0.0.0',
  port: int(process.env.PORT, 3000),

  password: process.env.DASHBOARD_PASSWORD || '',
  users: parseUsers(process.env.DASHBOARD_USERS || ''),
  sessionSecret: process.env.SESSION_SECRET || '',
  authDisabled: process.env.AUTH_DISABLED === '1',

  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  semanticModel: process.env.SEMANTIC_MODEL || 'claude-opus-5',
  semanticEffort: process.env.SEMANTIC_EFFORT || 'medium',

  scanConcurrency: int(process.env.SCAN_CONCURRENCY, 2),
  linkConcurrency: int(process.env.LINK_CONCURRENCY, 4),
  maxPages: int(process.env.MAX_PAGES, 100),
  maxLinksPerPage: int(process.env.MAX_LINKS_PER_PAGE, 150),
  navTimeoutMs: int(process.env.NAV_TIMEOUT_MS, 45000),
  // Optional: absolute path to a Chromium binary, for hosts where
  // `npx playwright install` can't be used and a system Chromium exists.
  chromiumPath: process.env.CHROMIUM_PATH || '',

  dataDir: process.env.DATA_DIR || path.join(ROOT, 'data'),
};

// Brands live in config/brands.json — adding a site is a config edit, not a
// code change. Each entry: { id, name, sitemapUrl, brandColour, logo } plus
// optional per-brand overrides { maxPages, concurrency }.
export function loadBrands() {
  const file = path.join(ROOT, 'config', 'brands.json');
  const brands = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const b of brands) {
    if (!b.id || !b.name || !b.sitemapUrl) {
      throw new Error(`brands.json entry missing id/name/sitemapUrl: ${JSON.stringify(b)}`);
    }
  }
  return brands;
}

export function findBrand(id) {
  return loadBrands().find((b) => b.id === id) || null;
}
