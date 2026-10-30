// Sitemap collection: accepts a sitemap URL, a sitemap index (auto-recurses),
// a local file path, or a plain list of URLs (array / newline-separated file).
import fs from 'node:fs';
import zlib from 'node:zlib';
import { USER_AGENT } from './config.js';
import { decodeXmlEntities } from './util.js';

const MAX_DEPTH = 5;

async function fetchBody(url, timeoutMs = 30000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/xml,text/xml,text/plain,*/*' },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const gzipped =
      url.endsWith('.gz') ||
      (res.headers.get('content-type') || '').includes('gzip') ||
      (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b);
    return (gzipped ? zlib.gunzipSync(buf) : buf).toString('utf8');
  } finally {
    clearTimeout(timer);
  }
}

function extractLocs(xml) {
  const locs = [];
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(xml))) locs.push(decodeXmlEntities(m[1].trim()));
  return locs;
}

function parseText(text) {
  if (/<sitemapindex[\s>]/i.test(text)) return { type: 'index', locs: extractLocs(text) };
  if (/<urlset[\s>]/i.test(text)) return { type: 'urlset', locs: extractLocs(text) };
  // Fall back to a plain newline-separated URL list.
  const urls = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^https?:\/\//i.test(l));
  return { type: 'urlset', locs: urls };
}

/**
 * Collect page URLs from a sitemap source.
 * @param {string|string[]} source sitemap URL, sitemap index URL, local file
 *   path, or an array of page URLs.
 * @param {{limit?: number}} options truncate to at most `limit` URLs.
 */
export async function collectUrls(source, { limit = Infinity } = {}) {
  if (Array.isArray(source)) return dedupe(source).slice(0, limit);

  const urls = [];
  const seenSitemaps = new Set();

  async function walk(src, depth) {
    if (urls.length >= limit || depth > MAX_DEPTH || seenSitemaps.has(src)) return;
    seenSitemaps.add(src);
    const text = /^https?:\/\//i.test(src)
      ? await fetchBody(src)
      : fs.readFileSync(src, 'utf8');
    const { type, locs } = parseText(text);
    if (type === 'index') {
      for (const child of locs) {
        if (urls.length >= limit) break;
        await walk(child, depth + 1);
      }
    } else {
      for (const loc of locs) {
        if (urls.length >= limit) break;
        urls.push(loc);
      }
    }
  }

  await walk(source, 0);
  return dedupe(urls).slice(0, limit);
}

function dedupe(arr) {
  return [...new Set(arr)];
}
