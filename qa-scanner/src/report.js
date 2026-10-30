// Report rendering shared by the CLI (standalone report.html) and the
// dashboard (which fetches the same fragment + the same CSS from the server),
// plus CSV/JSON outputs.
import fs from 'node:fs';
import path from 'node:path';
import { escapeHtml } from './util.js';

export const REPORT_CSS = `
.qa-report { font-family: 'Helvetica Neue', Arial, sans-serif; color: #222; }
.qa-report a { color: inherit; }
.qa-summary { display: flex; gap: 12px; flex-wrap: wrap; margin: 0 0 20px; }
.qa-chip { padding: 8px 14px; border-radius: 6px; background: #f2f2f2; font-size: 14px; }
.qa-chip strong { font-size: 18px; display: block; }
.qa-chip.sev-high { background: #fbeaea; color: #a93226; }
.qa-chip.sev-medium { background: #fdf0e3; color: #ba6a1c; }
.qa-chip.sev-low { background: #f7f4e3; color: #8a7a1e; }
.qa-page { border: 1px solid #e2e2e2; border-radius: 8px; margin: 0 0 16px; overflow: hidden; }
.qa-page-header { padding: 10px 14px; background: #fafafa; border-bottom: 1px solid #e2e2e2;
  display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.qa-page-header .url { font-weight: 600; font-size: 14px; word-break: break-all; }
.qa-page-header .count { font-size: 12px; color: #666; white-space: nowrap; }
.qa-page.clean .qa-page-header { border-bottom: none; }
.qa-issues { width: 100%; border-collapse: collapse; font-size: 13px; }
.qa-issues th, .qa-issues td { text-align: left; padding: 8px 12px; border-top: 1px solid #eee;
  vertical-align: top; }
.qa-issues th { background: #fff; color: #888; font-weight: 600; font-size: 11px;
  text-transform: uppercase; letter-spacing: .05em; border-top: none; }
.qa-issues td.detail { color: #666; word-break: break-all; white-space: pre-wrap; max-width: 480px; }
.sev { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px;
  font-weight: 700; text-transform: uppercase; }
.sev-high { background: #c0392b; color: #fff; }
.sev-medium { background: #e67e22; color: #fff; }
.sev-low { background: #c9b458; color: #fff; }
.qa-clean-note { margin: 16px 0; color: #2e7d32; font-size: 14px; }
.qa-meta { color: #888; font-size: 12px; margin-bottom: 16px; }
`;

const SEV_ORDER = { high: 0, medium: 1, low: 2 };

export function renderReportBody(results) {
  const s = results.summary;
  const pagesSorted = [...results.pages].sort(
    (a, b) => b.issues.length - a.issues.length
  );
  const withIssues = pagesSorted.filter((p) => p.issues.length > 0);
  const cleanCount = results.pages.length - withIssues.length;

  let html = `<div class="qa-report">`;
  html += `<div class="qa-meta">Scanned ${results.totalPages} page(s) · started ${escapeHtml(
    results.startedAt
  )} · finished ${escapeHtml(results.finishedAt)} · semantic checks ${
    results.semanticChecks ? 'on' : 'off'
  }</div>`;
  html += `<div class="qa-summary">
    <div class="qa-chip"><strong>${s.total}</strong>total issues</div>
    <div class="qa-chip sev-high"><strong>${s.high}</strong>high</div>
    <div class="qa-chip sev-medium"><strong>${s.medium}</strong>medium</div>
    <div class="qa-chip sev-low"><strong>${s.low}</strong>low</div>
    <div class="qa-chip"><strong>${s.pagesWithIssues}</strong>pages with issues</div>
  </div>`;

  for (const p of withIssues) {
    const issues = [...p.issues].sort(
      (a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9)
    );
    html += `<div class="qa-page">
      <div class="qa-page-header">
        <span class="url"><a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">${escapeHtml(
      p.url
    )}</a></span>
        <span class="count">${issues.length} issue(s)${p.status ? ` · HTTP ${p.status}` : ''}</span>
      </div>
      <table class="qa-issues">
        <tr><th>Severity</th><th>Type</th><th>Issue</th><th>Detail</th></tr>`;
    for (const i of issues) {
      html += `<tr>
        <td><span class="sev sev-${escapeHtml(i.severity)}">${escapeHtml(i.severity)}</span></td>
        <td>${escapeHtml(i.type)}</td>
        <td>${escapeHtml(i.message)}</td>
        <td class="detail">${escapeHtml(i.detail || '')}</td>
      </tr>`;
    }
    html += `</table></div>`;
  }

  if (cleanCount > 0) {
    html += `<p class="qa-clean-note">✓ ${cleanCount} page(s) with no issues.</p>`;
  }
  html += `</div>`;
  return html;
}

export function renderReportHtml(results) {
  const title = results.brand?.name
    ? `QA report — ${results.brand.name}`
    : 'QA report';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>body{margin:24px;background:#fff}${REPORT_CSS}</style>
</head>
<body>
<h1 style="font-family:Arial,sans-serif">${escapeHtml(title)}</h1>
${renderReportBody(results)}
</body>
</html>`;
}

function csvField(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(results) {
  const rows = [['page', 'severity', 'type', 'message', 'detail']];
  for (const p of results.pages) {
    for (const i of p.issues) {
      rows.push([p.url, i.severity, i.type, i.message, i.detail || '']);
    }
  }
  return rows.map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n';
}

export function writeReports(results, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'report.html'), renderReportHtml(results));
  fs.writeFileSync(path.join(outDir, 'issues.csv'), toCsv(results));
  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(results, null, 2));
  return {
    html: path.join(outDir, 'report.html'),
    csv: path.join(outDir, 'issues.csv'),
    json: path.join(outDir, 'results.json'),
  };
}
