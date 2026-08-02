// One scan per brand at a time; state polled by the dashboard.
import { config } from '../src/config.js';
import { collectUrls } from '../src/sitemap.js';
import { scanSite } from '../src/scan.js';
import * as store from './store.js';

const states = new Map(); // brandId -> {status, startedAt, progress, error, finishedAt}

export function getState(brandId) {
  return states.get(brandId) || { status: 'idle' };
}

export function startScan(brand) {
  const current = states.get(brand.id);
  if (current?.status === 'running') {
    const err = new Error('A scan is already running for this brand');
    err.code = 'ALREADY_RUNNING';
    throw err;
  }

  const state = {
    status: 'running',
    startedAt: new Date().toISOString(),
    progress: { phase: 'collecting sitemap', done: 0, total: 0, currentUrl: null },
  };
  states.set(brand.id, state);

  (async () => {
    try {
      const urls = await collectUrls(brand.sitemapUrl, {
        limit: brand.maxPages ?? config.maxPages,
      });
      if (urls.length === 0) throw new Error('Sitemap produced no URLs');
      state.progress.total = urls.length;
      state.progress.phase = 'scanning';

      const results = await scanSite({
        urls,
        brand: { id: brand.id, name: brand.name },
        concurrency: brand.concurrency ?? config.scanConcurrency,
        onProgress: (p) => Object.assign(state.progress, p),
      });

      store.saveResults(brand.id, results);
      states.set(brand.id, { status: 'idle', finishedAt: results.finishedAt });
    } catch (e) {
      console.error(`[scan] ${brand.id} failed:`, e);
      states.set(brand.id, {
        status: 'error',
        error: String(e?.message || e),
        finishedAt: new Date().toISOString(),
      });
    }
  })();

  return state;
}
