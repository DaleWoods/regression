// Persist each brand's most recent scan as JSON on disk so results survive
// restarts and everyone sees the same shared state.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/config.js';

function brandDir(brandId) {
  return path.join(config.dataDir, brandId);
}

function resultsPath(brandId) {
  return path.join(brandDir(brandId), 'results.json');
}

export function saveResults(brandId, results) {
  const dir = brandDir(brandId);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.results-${Date.now()}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(results, null, 2));
  fs.renameSync(tmp, resultsPath(brandId));
}

export function loadResults(brandId) {
  try {
    return JSON.parse(fs.readFileSync(resultsPath(brandId), 'utf8'));
  } catch {
    return null;
  }
}

export function resultsMeta(brandId) {
  const r = loadResults(brandId);
  if (!r) return null;
  return {
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
    totalPages: r.totalPages,
    summary: r.summary,
    semanticChecks: r.semanticChecks,
  };
}
