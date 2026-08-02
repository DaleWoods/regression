// Dashboard: one tab per brand, run scans, poll progress, render the shared
// report fragment, export CSV.
let brands = [];
let activeId = null;
let pollTimer = null;

const $ = (id) => document.getElementById(id);

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (res.status === 401) {
    location.href = '/login.html';
    throw new Error('not authenticated');
  }
  return res;
}

async function loadBrands() {
  const res = await api('/api/brands');
  brands = await res.json();
  renderTabs();
  if (!activeId && brands.length) selectBrand(brands[0].id);
}

function renderTabs() {
  const nav = $('tabs');
  nav.innerHTML = '';
  for (const b of brands) {
    const btn = document.createElement('button');
    btn.className = 'tab' + (b.id === activeId ? ' active' : '');
    btn.style.setProperty('--tab-colour', b.brandColour);
    btn.innerHTML = `<img src="${b.logo}" alt=""> ${b.name}`;
    btn.addEventListener('click', () => selectBrand(b.id));
    nav.appendChild(btn);
  }
}

function brand() {
  return brands.find((b) => b.id === activeId);
}

function selectBrand(id) {
  activeId = id;
  const b = brand();
  document.documentElement.style.setProperty('--brand', b.brandColour);
  $('panel').hidden = false;
  $('brand-name').textContent = b.name;
  $('brand-logo').src = b.logo;
  $('export').href = `/api/brands/${b.id}/issues.csv`;
  renderTabs();
  refreshStatus();
  loadReport();
}

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleString() : '';
}

function applyStatus({ state, lastScan }) {
  const status = $('status');
  const run = $('run');
  const b = brand();
  b.state = state;
  b.lastScan = lastScan;

  if (state.status === 'running') {
    const p = state.progress || {};
    status.className = 'status running';
    status.textContent =
      p.phase === 'scanning' && p.total
        ? `Scanning ${p.done}/${p.total}…`
        : 'Collecting sitemap…';
    run.disabled = true;
  } else if (state.status === 'error') {
    status.className = 'status error';
    status.textContent = `Scan failed: ${state.error}`;
    run.disabled = false;
  } else {
    status.className = 'status';
    status.textContent = '';
    run.disabled = false;
  }

  $('scan-meta').textContent = lastScan
    ? `Last scan: ${fmtDate(lastScan.finishedAt)} · ${lastScan.totalPages} pages · ` +
      `${lastScan.summary.total} issues (semantic checks ${lastScan.semanticChecks ? 'on' : 'off'})`
    : 'No scan run yet.';
  $('export').style.display = lastScan ? '' : 'none';
}

async function refreshStatus() {
  const id = activeId;
  const res = await api(`/api/brands/${id}/status`);
  const data = await res.json();
  if (id !== activeId) return;
  const wasRunning = pollTimer !== null;
  applyStatus(data);

  clearTimeout(pollTimer);
  pollTimer = null;
  if (data.state.status === 'running') {
    pollTimer = setTimeout(refreshStatus, 2000);
  } else if (wasRunning) {
    loadReport(); // scan just finished — refresh results
  }
}

async function loadReport() {
  const id = activeId;
  const container = $('report');
  container.innerHTML = '<p class="loading">Loading…</p>';
  const res = await api(`/api/brands/${id}/report`);
  const html = await res.text();
  if (id !== activeId) return;
  container.innerHTML = res.ok
    ? html
    : '<p class="empty">No scan results yet — hit “Run scan”.</p>';
}

$('run').addEventListener('click', async () => {
  const res = await api(`/api/brands/${activeId}/scan`, { method: 'POST' });
  if (!res.ok && res.status !== 409) {
    const data = await res.json().catch(() => ({}));
    alert(`Could not start scan: ${data.error || res.status}`);
  }
  refreshStatus();
});

$('logout').addEventListener('click', async () => {
  await fetch('/logout', { method: 'POST' });
  location.href = '/login.html';
});

loadBrands();
