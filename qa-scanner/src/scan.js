// Scan orchestration: loads each page in headless Chromium, runs the in-page
// checks, verifies links (deduped/cached across pages), records failed
// sub-resources, and runs the semantic layer.
import { chromium } from 'playwright';
import { pLimit } from './util.js';
import { collectPageData, metadataIssues } from './checks.js';
import { LinkChecker } from './links.js';
import { analyzePage, semanticEnabled } from './semantic.js';
import { USER_AGENT, config } from './config.js';

export async function scanSite({
  urls,
  brand = null,
  concurrency = config.scanConcurrency,
  navTimeoutMs = config.navTimeoutMs,
  maxLinksPerPage = config.maxLinksPerPage,
  semantic = semanticEnabled(),
  onProgress = () => {},
}) {
  const startedAt = new Date().toISOString();
  const browser = await chromium.launch({
    headless: true,
    executablePath: config.chromiumPath || undefined,
  });
  const results = new Array(urls.length);
  try {
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1366, height: 900 },
    });
    const linkChecker = new LinkChecker();
    const limit = pLimit(Math.max(1, concurrency));
    let done = 0;

    await Promise.all(
      urls.map((url, i) =>
        limit(async () => {
          results[i] = await scanPage(context, url, {
            linkChecker,
            navTimeoutMs,
            maxLinksPerPage,
            semantic,
          });
          done++;
          onProgress({ done, total: urls.length, currentUrl: url });
        })
      )
    );
  } finally {
    await browser.close();
  }

  const summary = { high: 0, medium: 0, low: 0, total: 0, pagesWithIssues: 0 };
  for (const p of results) {
    if (p.issues.length > 0) summary.pagesWithIssues++;
    for (const i of p.issues) {
      summary[i.severity] = (summary[i.severity] || 0) + 1;
      summary.total++;
    }
  }

  return {
    brand,
    startedAt,
    finishedAt: new Date().toISOString(),
    totalPages: urls.length,
    semanticChecks: semantic,
    summary,
    pages: results,
  };
}

async function scanPage(context, url, { linkChecker, navTimeoutMs, maxLinksPerPage, semantic }) {
  const page = await context.newPage();
  const issues = [];
  const failedResources = new Map(); // url -> detail
  let status = null;

  page.on('response', (res) => {
    if (res.status() >= 400 && res.url() !== url) {
      failedResources.set(res.url(), `HTTP ${res.status()}`);
    }
  });
  page.on('requestfailed', (req) => {
    const err = req.failure()?.errorText || 'request failed';
    // ERR_ABORTED is usually the page itself cancelling a request, not a fault.
    if (err !== 'net::ERR_ABORTED' && req.url() !== url) {
      failedResources.set(req.url(), err);
    }
  });

  try {
    let resp;
    try {
      resp = await page.goto(url, { waitUntil: 'load', timeout: navTimeoutMs });
    } catch (e) {
      // Slow pages: settle for DOM ready before giving up entirely.
      resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: navTimeoutMs });
    }
    status = resp?.status() ?? null;
    if (status && status >= 400) {
      issues.push({ type: 'page-error', severity: 'high', message: `Page returned HTTP ${status}` });
    }
    await page.waitForTimeout(500);

    const data = await collectPageData(page);

    for (const img of data.brokenImages) {
      issues.push({
        type: 'broken-image',
        severity: 'high',
        message: 'Broken image (fails to render)',
        detail: img.src + (img.alt ? ` (alt: "${img.alt}")` : ''),
      });
    }

    issues.push(...metadataIssues(data.metadata));

    const linkResults = await Promise.all(
      data.links.slice(0, maxLinksPerPage).map((l) => linkChecker.check(l))
    );
    for (const r of linkResults) {
      if (!r.ok) {
        issues.push({
          type: 'broken-link',
          severity: r.status ? 'high' : 'medium',
          message: r.status ? `Broken link (HTTP ${r.status})` : 'Broken link (unreachable)',
          detail: r.url + (r.detail ? ` — ${r.detail}` : ''),
        });
      }
    }

    for (const [resUrl, detail] of failedResources) {
      issues.push({
        type: 'failed-resource',
        severity: 'medium',
        message: 'Sub-resource failed to load',
        detail: `${resUrl} — ${detail}`,
      });
    }

    if (semantic) {
      issues.push(...(await analyzePage({ url, ...data.semantic })));
    }
  } catch (e) {
    issues.push({
      type: 'page-error',
      severity: 'high',
      message: 'Failed to load page',
      detail: String(e?.message || e),
    });
  } finally {
    await page.close().catch(() => {});
  }

  return { url, status, scannedAt: new Date().toISOString(), issues };
}
