// ── AveOne Inspector — Painel nativo do AveBrowser ───────────────────────────
// Adaptação de panel.js da extensão Chrome: troca chrome.devtools.* por APIs Electron.
// Todos os IDs do DOM usam prefixo "ao-" para não conflituar com o AveBrowser.

// ── Mock do chrome.runtime para o aveoneTestCors (apitester.js usa chrome.runtime.getURL) ──
window.chrome = window.chrome || {};
window.chrome.runtime = window.chrome.runtime || { getURL: () => 'avebrowser-extension' };

// ── Override aveoneSend: usa IPC em vez de fetch() para evitar bloqueio CORS ──
async function aveoneSend(method, url, headerLines, body, opts) {
  opts = opts || {};
  const headers = aveoneHeadersToObject(headerLines, opts.includeAuth !== false);
  const t0 = performance.now();
  try {
    const result = await window.ave.aveoneFetch({ method, url, headers, body: body || null });
    result.ms = Math.round(performance.now() - t0);
    return result;
  } catch (e) {
    return { ok: false, error: e.message, ms: Math.round(performance.now() - t0) };
  }
}

// ── Substituição de chrome.devtools.inspectedWindow.eval ──────────────────────
function aoInspectedEval(expr, callback) {
  const tab = typeof getActiveTab === 'function' ? getActiveTab() : null;
  if (!tab?.wv) { callback(null, { description: 'Nenhum site activo' }); return; }
  tab.wv.executeJavaScript(expr)
    .then(result => callback(result, null))
    .catch(e => callback(null, { description: e.message }));
}

// ── Substituição de chrome.notifications ──────────────────────────────────────
function aoNotify(title, message) {
  if (typeof showToast === 'function') showToast('🚨 ' + title.replace('🚨 AveOne Inspector — ', '') + ': ' + message.slice(0, 60));
}

function aoId(id) { return document.getElementById('ao-' + id); }

// ── Tabs do painel AveOne ─────────────────────────────────────────────────────
function aoInitTabs() {
  document.querySelectorAll('.ao-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ao-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.ao-tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('ao-tab-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'feed') aoRenderFeed();
    });
  });
}

// ── Feed unificado ────────────────────────────────────────────────────────────
const _aoFeed = [];
const _aoFeedIndex = new Map();
const _AO_FEED_MAX = 300;

function aoAddFeedItem(cls, source, title, detail, ruleId) {
  const key = source + '::' + (ruleId || title);
  const existing = _aoFeedIndex.get(key);
  if (existing) {
    existing.count = (existing.count || 1) + 1;
    existing.time = new Date();
  } else {
    const item = { time: new Date(), cls, source, title, detail: detail || '', count: 1 };
    _aoFeed.unshift(item);
    _aoFeedIndex.set(key, item);
    if (_aoFeed.length > _AO_FEED_MAX) {
      const removed = _aoFeed.pop();
      for (const [k, v] of _aoFeedIndex) { if (v === removed) { _aoFeedIndex.delete(k); break; } }
    }
  }
  const el = aoId('feed-count');
  if (el) { el.textContent = String(_aoFeed.length); el.className = 'ao-badge ' + (_aoFeed.length ? 'ao-badge-some' : 'ao-badge-0'); }
  if (document.getElementById('ao-tab-feed')?.classList.contains('active')) aoRenderFeed();
}

function aoRenderFeed() {
  const el = aoId('feed-list');
  if (!el) return;
  if (!_aoFeed.length) { el.innerHTML = '<div style="color:#7ee787;padding:10px">Nenhum achado ainda — navegue com o Network Monitor ligado ou escaneie algo.</div>'; return; }
  el.innerHTML = _aoFeed.map(it => `
    <div class="ao-feed-item ao-sev-${it.cls}">
      <span class="ao-feed-time">${it.time.toLocaleTimeString()}</span>
      <span class="ao-feed-source">[${escapeHTML(it.source)}]</span>
      <span class="ao-feed-sev">${it.cls.replace('verdict-','').toUpperCase()}</span>
      <span class="ao-feed-title">${escapeHTML(it.title)}</span>
      ${it.count > 1 ? `<span style="color:#6e7681"> (${it.count}x)</span>` : ''}
      ${it.detail ? `<div class="ao-sub-row">${escapeHTML(it.detail.slice(0,150))}</div>` : ''}
    </div>
  `).join('');
}

aoId('feed-clear')?.addEventListener('click', () => {
  _aoFeed.length = 0; _aoFeedIndex.clear();
  const el = aoId('feed-count'); if (el) { el.textContent = '0'; el.className = 'ao-badge ao-badge-0'; }
  aoRenderFeed();
});

// ── Renderização de findings ──────────────────────────────────────────────────
function aoRenderFindings(containerId, findings) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!findings.length) { el.innerHTML = '<div style="color:#7ee787">✅ Nenhum padrão suspeito encontrado.</div>'; return; }
  el.innerHTML = findings.map(f => `
    <div class="ao-finding ao-finding-${f.sev}">
      <span class="ao-sev-badge">${f.sev}</span><span class="ao-find-title">${escapeHTML(f.title)}</span>
      <div class="ao-find-desc">${escapeHTML(f.desc)}</div>
      <code class="ao-snippet">${escapeHTML(f.snippet)}</code>
      <div class="ao-fix">🔧 ${escapeHTML(f.fix)}</div>
    </div>
  `).join('');
}

function aoRenderJWTBoxes(text) {
  const matches = [...text.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*/g)];
  if (!matches.length) return '';
  const seen = new Set();
  let html = '';
  for (const m of matches) {
    const tok = m[0]; if (seen.has(tok)) continue; seen.add(tok);
    const d = decodeJWT(tok); if (!d) continue;
    html += `<div class="ao-jwt-box"><div class="ao-jwt-title">🔑 JWT decodificado</div>
      <pre>${escapeHTML(JSON.stringify(d.header, null, 2))}</pre>
      <pre>${escapeHTML(JSON.stringify(d.payload, null, 2))}</pre>
      ${d.issues.map(i => `<div class="ao-jwt-issue">⚠ ${escapeHTML(i)}</div>`).join('')}
    </div>`;
  }
  return html;
}

function aoMaybeNotify(findings, context) {
  (findings || []).forEach(f => aoAddFeedItem(f.sev, context, f.title, f.snippet, f.id));
  const toggle = aoId('notif-toggle'); if (toggle && !toggle.checked) return;
  const top = (findings || []).find(f => f.sev === 'CRITICAL' || f.sev === 'HIGH');
  if (!top) return;
  aoNotify('AveOne — ' + top.sev, top.title + (context ? ' — ' + context : ''));
}

function aoCodeHTML(rawText, type, findings) {
  let html;
  if (type === 'json') {
    try { html = renderJSONTree(JSON.parse(rawText)); } catch(e) { html = highlight(rawText, type); }
  } else { html = highlight(rawText, type); }
  html = markTokens(html, rawText);
  if (findings && findings.length) html = markFindings(html, rawText, findings);
  return html;
}

function aoRenderCode(containerId, rawText, type, findings) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = aoCodeHTML(rawText, type, findings);
}

// ── TAB Formatter ─────────────────────────────────────────────────────────────
let _aoLastFormatted = '', _aoLastType = 'text';

aoId('btn-format')?.addEventListener('click', () => {
  const raw = aoId('input-code')?.value; if (!raw?.trim()) return;
  const { type, formatted } = formatCode(raw);
  _aoLastFormatted = formatted; _aoLastType = type;
  const dt = aoId('detected-type'); if (dt) dt.textContent = 'Tipo: ' + type.toUpperCase();
  aoRenderCode('ao-output-code', formatted, type);
  const ff = aoId('findings-format'); if (ff) ff.innerHTML = '';
});

aoId('btn-scan')?.addEventListener('click', () => {
  const raw = aoId('input-code')?.value; if (!raw?.trim()) return;
  const findings = scanText(raw);
  aoRenderFindings('ao-findings-format', findings);
  aoMaybeNotify(findings, 'Formatter manual');
  const jwtHtml = aoRenderJWTBoxes(raw);
  const ff = aoId('findings-format');
  if (ff && jwtHtml) ff.innerHTML = jwtHtml + ff.innerHTML;
  if (_aoLastFormatted) aoRenderCode('ao-output-code', _aoLastFormatted, _aoLastType, findings);
});

aoId('btn-clear')?.addEventListener('click', () => {
  const ic = aoId('input-code'); if (ic) ic.value = '';
  const oc = aoId('output-code'); if (oc) oc.innerHTML = '';
  const ff = aoId('findings-format'); if (ff) ff.innerHTML = '';
  const dt = aoId('detected-type'); if (dt) dt.textContent = '';
});

// ── TAB Network Monitor ───────────────────────────────────────────────────────
let _aoNetActive = false;
let _aoNetRows = [];
const _aoPendingReqs = new Map();

aoId('net-toggle')?.addEventListener('change', e => { _aoNetActive = e.target.checked; });

const _AO_STATIC_EXT = /\.(js|mjs|css|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|mp4|mp3|map|wasm)(\?|#|$)/i;

// Padrões de URLs de telemetria/analytics/beacon — não são APIs reais, não vale testar
const _AO_NOISE_PATTERNS = [
  /\/api\/stats\//i,        // YouTube /api/stats/qoe, /api/stats/atr
  /[?&](\w+=)*[^&]{200}/,  // URLs com query strings > 200 chars são provavelmente telemetria
  /\/collect(\?|$)/i,
  /\/analytics(\?|\/)/i,
  /\/telemetry(\?|\/)/i,
  /\/beacon(\?|\/)/i,
  /\/log(\?|$)/i,
  /\/ping(\?|$)/i,
  /\/pixel(\?|\/)/i,
  /\/gen_204(\?|$)/i,
  /\/csi(\?|$)/i,
  /\/qoe(\?|$)/i,
  /\/atr(\?|$)/i,
  /\/bat\.bing\.com/i,
  /doubleclick\.net/i,
  /google-analytics\.com/i,
  /googletagmanager\.com/i,
  /googlesyndication\.com/i,
  /facebook\.com\/tr(\?|$)/i,
  /fbevents\.js/i,
  /clarity\.ms/i,
  /hotjar\.com/i,
  /newrelic\.com/i,
  /sentry\.io/i,
  /datadog/i,
  /segment\.io/i,
  /mixpanel\.com/i,
];

function aoIsApiLike(row) {
  if (_AO_STATIC_EXT.test(row.url.split('?')[0])) return false;
  const ct = (row.respHeaders || []).find(h => /^content-type$/i.test(h.name));
  if (ct && /text\/css|javascript|image\/|font\/|video\/|audio\//i.test(ct.value)) return false;
  return true;
}

// Escuta os eventos de captura do AveBrowser (já capturados pelo main.js)
window.ave.on('request-captured', entry => {
  if (!_aoNetActive) return;
  _aoPendingReqs.set(entry.id, {
    method: entry.method,
    url: entry.url,
    reqHeaders: Object.entries(entry.requestHeaders || {}).map(([name, value]) => ({ name, value })),
    body: '',
    ts: entry.ts
  });
});

window.ave.on('response-captured', data => {
  if (!_aoNetActive) return;
  const pending = _aoPendingReqs.get(data.id);
  if (!pending) return;
  _aoPendingReqs.delete(data.id);

  const respHeaders = Object.entries(data.responseHeaders || {}).map(([name, v]) => ({
    name, value: Array.isArray(v) ? v.join(', ') : v
  }));
  const headerText =
    pending.reqHeaders.map(h => `${h.name}: ${h.value}`).join('\n') + '\n\n' +
    respHeaders.map(h => `${h.name}: ${h.value}`).join('\n');

  const findings = scanText(headerText);
  const hostname = (() => { try { return new URL(pending.url).hostname; } catch(e) { return pending.url.slice(0,50); } })();
  aoMaybeNotify(findings, hostname);

  const row = {
    method: pending.method, url: pending.url, status: data.statusCode,
    findings, fullText: headerText, bodyType: 'text',
    reqHeaders: pending.reqHeaders, respHeaders, body: ''
  };
  row.apiLike = aoIsApiLike(row);
  _aoNetRows.push(row);
  aoRefreshApiSelect();
  aoRegisterDiscovery(row, _aoNetRows.length - 1);
  if (aoShouldAutoTest(row.url)) { _aoAutoTestQueue.push(row); aoProcessAutoTestQueue(); }
  aoRenderNetRow(row);
});

aoId('net-clear')?.addEventListener('click', () => {
  _aoNetRows = [];
  _aoAutoTestQueue = [];
  _aoAutoTested.clear(); // reset deduplication so re-navigation tests fresh
  const tb = aoId('net-tbody'); if (tb) tb.innerHTML = '';
  const no = aoId('net-output'); if (no) no.innerHTML = '';
  const fn = aoId('findings-network'); if (fn) fn.innerHTML = '';
  aoRefreshApiSelect();
  _aoDiscoveredHosts.clear(); _aoDiscoveredEndpoints.clear(); _aoDiscoveredHeaders.clear();
  aoRenderHostsDatalist(); aoRenderDiscoveredApis(); aoRenderDiscoveredHeaders();
});

aoId('net-api-only')?.addEventListener('change', () => { aoRerenderNetTable(); aoRefreshApiSelect(); });

function aoRenderNetRow(row) {
  const apiOnly = aoId('net-api-only')?.checked;
  if (apiOnly && !row.apiLike) return;
  const tb = aoId('net-tbody'); if (!tb) return;
  const tr = document.createElement('tr');
  const sevBadge = row.findings.length
    ? `<span class="ao-badge ao-badge-some">${row.findings.length}</span>`
    : `<span class="ao-badge ao-badge-0">0</span>`;
  tr.innerHTML = `<td>${escapeHTML(row.method)}</td><td title="${escapeHTML(row.url)}">${escapeHTML(row.url.slice(0,70))}</td><td>${row.status}</td><td>${sevBadge}</td>`;
  tr.addEventListener('click', () => {
    aoRenderCode('ao-net-output', formatCode(row.body || '').formatted, row.bodyType, row.findings);
    aoRenderFindings('ao-findings-network', row.findings);
    const jwtHtml = aoRenderJWTBoxes(row.fullText);
    const fn = aoId('findings-network'); if (fn && jwtHtml) fn.innerHTML = jwtHtml + fn.innerHTML;
  });
  tb.appendChild(tr);
}

function aoRerenderNetTable() {
  const tb = aoId('net-tbody'); if (tb) tb.innerHTML = '';
  _aoNetRows.forEach(aoRenderNetRow);
}

// ── Auto-descoberta ────────────────────────────────────────────────────────────
const _aoDiscoveredHosts = new Set();
const _aoDiscoveredEndpoints = new Map();
const _aoDiscoveredHeaders = new Map();

function aoRenderHostsDatalist() {
  const el = aoId('discovered-hosts');
  if (el) el.innerHTML = [..._aoDiscoveredHosts].map(h => `<option value="${escapeHTML(h)}">`).join('');
}

function aoRenderDiscoveredApis() {
  const el = aoId('discovered-apis-list'), cnt = aoId('discovered-apis-count');
  const entries = [..._aoDiscoveredEndpoints.values()];
  if (cnt) { cnt.textContent = String(entries.length); cnt.className = 'ao-badge ' + (entries.length ? 'ao-badge-some' : 'ao-badge-0'); }
  if (!el) return;
  if (!entries.length) { el.innerHTML = '<div class="ao-discover-empty">Nenhuma API capturada — ligue o Network Monitor.</div>'; return; }
  el.innerHTML = entries.map(info => `
    <div class="ao-discover-item" data-row-index="${info.rowIndex}">
      <span class="ao-di-label">${escapeHTML(info.method)} ${escapeHTML(info.path)} <span style="color:#6e7681">(${info.count}x)</span></span>
    </div>
  `).join('');
  el.querySelectorAll('.ao-discover-item').forEach(item => {
    item.addEventListener('click', () => {
      const sel = aoId('api-req-select'); if (!sel) return;
      sel.value = item.dataset.rowIndex; sel.dispatchEvent(new Event('change'));
      document.querySelector('.ao-tab-btn[data-tab="api"]')?.click();
    });
  });
}

function aoRenderDiscoveredHeaders() {
  const el = aoId('discovered-headers-list');
  const entries = [..._aoDiscoveredHeaders.values()];
  if (!el) return;
  if (!entries.length) { el.innerHTML = '<div class="ao-discover-empty">Nenhum header capturado.</div>'; return; }
  el.innerHTML = entries.map((h, i) => `
    <div class="ao-discover-item">
      <span class="ao-di-label"><b>${escapeHTML(h.name)}:</b> ${escapeHTML((h.value||'').slice(0,60))}</span>
      <button class="ao-di-copy" data-idx="${i}" title="Copiar">📋</button>
    </div>
  `).join('');
  el.querySelectorAll('.ao-di-copy').forEach((btn, i) => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const h = entries[i];
      navigator.clipboard.writeText(`${h.name}: ${h.value}`).catch(() => {});
      btn.textContent = '✅'; setTimeout(() => { btn.textContent = '📋'; }, 1200);
    });
  });
}

function aoRegisterDiscovery(row, rowIndex) {
  const host = (() => { try { return new URL(row.url).hostname.toLowerCase(); } catch(e) { return ''; } })();
  if (host && !_aoDiscoveredHosts.has(host)) {
    _aoDiscoveredHosts.add(host); aoRenderHostsDatalist();
    const di = aoId('auto-test-domain'); if (di && !di.value.trim()) di.value = host;
  }
  if (row.apiLike) {
    let pathname = row.url;
    try { pathname = new URL(row.url).pathname; } catch(e) {}
    const key = row.method + ' ' + pathname;
    if (_aoDiscoveredEndpoints.has(key)) {
      const cur = _aoDiscoveredEndpoints.get(key); cur.count++; cur.rowIndex = rowIndex;
    } else {
      _aoDiscoveredEndpoints.set(key, { rowIndex, method: row.method, path: pathname, count: 1 });
    }
    aoRenderDiscoveredApis();
  }
  (row.reqHeaders || []).forEach(h => _aoDiscoveredHeaders.set(h.name.toLowerCase(), { name: h.name, value: h.value }));
  aoRenderDiscoveredHeaders();
}

// ── TAB Página Atual ──────────────────────────────────────────────────────────
aoId('btn-scan-page')?.addEventListener('click', () => {
  const expr = `(function(){try{var scripts=Array.from(document.scripts).map(function(s){return s.src?'/* EXTERNAL: '+s.src+' */':s.textContent;}).join('\\n\\n');return document.documentElement.outerHTML+'\\n\\n'+scripts;}catch(e){return 'ERRO: '+e.message;}})()`;
  aoInspectedEval(expr, (result, isException) => {
    const po = aoId('page-output'); const fp = aoId('findings-page');
    if (isException || !result) { if (po) po.textContent = 'Não foi possível ler a página.'; return; }
    const findings = scanText(result);
    const pretty = prettyEmbeddedJSON(result.slice(0, 50000));
    aoRenderCode('ao-page-output', pretty, 'xml');
    aoRenderFindings('ao-findings-page', findings);
    aoMaybeNotify(findings, 'Página actual');
    const jwtHtml = aoRenderJWTBoxes(result);
    if (fp && jwtHtml) fp.innerHTML = jwtHtml + fp.innerHTML;
  });
});

// ── TAB API Tester ────────────────────────────────────────────────────────────
let _aoAutoTestQueue = [];
let _aoAutoTestRunning = false;
const _aoAutoTested = new Set(); // deduplication: URLs já testadas nesta sessão

function aoShouldAutoTest(url) {
  const toggle = aoId('auto-test-toggle'), domainInput = aoId('auto-test-domain');
  if (!toggle?.checked) return false;
  const domain = (domainInput?.value || '').trim().toLowerCase();
  if (!domain) return false;

  let host = '';
  try { host = new URL(url).hostname.toLowerCase(); } catch { return false; }
  if (host !== domain) return false;

  // Rejeitar URLs de telemetria/analytics/beacon — não são alvos válidos
  if (_AO_NOISE_PATTERNS.some(p => p.test(url))) return false;

  // Deduplicação: normalizar URL (ignorar query strings dinâmicas como timestamps)
  // Usa só scheme+host+path para não testar o mesmo endpoint com params diferentes
  let canonicalKey = url;
  try {
    const u = new URL(url);
    canonicalKey = u.origin + u.pathname; // ignora query string
  } catch {}
  if (_aoAutoTested.has(canonicalKey)) return false;
  _aoAutoTested.add(canonicalKey);
  return true;
}

async function aoProcessAutoTestQueue() {
  if (_aoAutoTestRunning) return;
  _aoAutoTestRunning = true;
  while (_aoAutoTestQueue.length) {
    const row = _aoAutoTestQueue.shift();
    const abLines = (aoId('account-b-headers')?.value || '').split('\n').map(l => l.trim()).filter(Boolean);
    const tests = [
      ['Broken Auth/BOLA', () => aveoneTestBrokenAuth(row, abLines)],
      ['IDOR',             () => aveoneTestIDOR(row, abLines)],
      ['Métodos',          () => aveoneTestMethods(row)],
      ['Mass Assignment',  () => aveoneTestMassAssignment(row)],
      ['CORS',             () => aveoneTestCors(row)]
    ];
    for (const [label, fn] of tests) {
      try {
        const result = await fn();

        // Se TODAS as sub-respostas falharam com erro de rede, não poluir o feed
        const allNetErr = [result.withAuth, result.noAuth, result.accountB, result.resPlus, result.resMinus]
          .filter(Boolean)
          .every(r => !r.ok && r.error && /ERR_|INVALID|FAILED|ABORTED|REFUSED/i.test(r.error));
        if (allNetErr) continue;

        const cls = result.verdict === 'critical' ? 'verdict-critical' : (result.verdict === 'warn' ? 'verdict-warn' : 'verdict-ok');
        aoAddFeedItem(cls, '🤖 Auto: ' + label, result.verdictMsg, row.method + ' ' + row.url);
        if (result.verdict === 'critical') aoNotify('CRITICAL', label + ': ' + result.verdictMsg.replace(/^🚨\s*/,''));
      } catch(e) {
        // Silenciar erros de rede no auto-test — não são vulnerabilidades
      }
    }
    await new Promise(r => setTimeout(r, 300));
  }
  _aoAutoTestRunning = false;
}

function aoPopulateReqSelect(selectId, placeholder) {
  const sel = document.getElementById(selectId); if (!sel) return;
  const current = sel.value;
  const apiOnly = aoId('net-api-only')?.checked;
  sel.innerHTML = `<option value="">${escapeHTML(placeholder)}</option>`;
  _aoNetRows.forEach((row, i) => {
    if (apiOnly && !row.apiLike) return;
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${row.method} ${row.url.slice(0,90)} [${row.status}]`;
    sel.appendChild(opt);
  });
  if (current && Number(current) < _aoNetRows.length) sel.value = current;
}

function aoRefreshApiSelect() {
  aoPopulateReqSelect('ao-api-req-select', '— selecione uma request capturada —');
  aoPopulateReqSelect('ao-format-req-select', '— carregar request capturada (opcional) —');
}

aoId('api-refresh')?.addEventListener('click', aoRefreshApiSelect);

aoId('format-req-select')?.addEventListener('change', () => {
  const sel = aoId('format-req-select'); if (!sel || sel.value === '') return;
  const row = _aoNetRows[Number(sel.value)]; if (!row) return;
  const ic = aoId('input-code'); if (ic) ic.value = row.fullText;
  aoId('btn-format')?.click(); aoId('btn-scan')?.click();
});

function aoSelectedRow() {
  const sel = aoId('api-req-select'); if (!sel || sel.value === '') return null;
  return _aoNetRows[Number(sel.value)] || null;
}

function aoRenderHttp(label, res) {
  if (!res?.ok) return `<div class="ao-sub-row"><b>${escapeHTML(label)}:</b> erro — ${escapeHTML(res?.error||'?')}</div>`;
  return `<div class="ao-sub-row"><b>${escapeHTML(label)}:</b> HTTP ${res.status} · ${res.ms}ms · ${(res.body||'').length} bytes</div>`;
}

function aoResultBox(result) {
  const cls = result.verdict === 'critical' ? 'ao-verdict-critical' : (result.verdict === 'warn' ? 'ao-verdict-warn' : 'ao-verdict-ok');
  let extra = '';
  if (result.type === 'auth') {
    extra = aoRenderHttp('Com auth (Conta A)', result.withAuth) + aoRenderHttp('Sem auth', result.noAuth);
    if (result.accountB) extra += aoRenderHttp('Conta B', result.accountB);
  } else if (result.type === 'idor') {
    if (result.plusUrl) {
      extra = `<div class="ao-sub-row">ID original: <b>${escapeHTML(result.originalId)}</b></div>` +
        aoRenderHttp('ID +1', result.resPlus) + aoRenderHttp('ID -1', result.resMinus);
    }
    if (result.crossAccount) extra += aoRenderHttp('Conta B (mesmo ID)', result.crossAccount);
  } else if (result.type === 'methods') {
    extra = '<table><tr><th>Método</th><th>Status</th><th>Bytes</th></tr>' +
      Object.entries(result.results).map(([m,r]) =>
        `<tr><td>${escapeHTML(m)}</td><td>${r.ok?r.status:'erro'}</td><td>${r.ok?(r.body||'').length:'-'}</td></tr>`
      ).join('') + '</table>';
  } else if (result.type === 'mass') {
    if (result.res) extra = aoRenderHttp('Resposta', result.res);
    if (result.reflected?.length) extra += `<div class="ao-sub-row">Campos refletidos: <b>${escapeHTML(result.reflected.join(', '))}</b></div>`;
  } else if (result.type === 'cors') {
    if (result.ourOrigin) extra += `<div class="ao-sub-row">Origem de teste: <b>${escapeHTML(result.ourOrigin)}</b></div>`;
    if (result.allowOrigin) extra += `<div class="ao-sub-row">Allow-Origin: <b>${escapeHTML(result.allowOrigin)}</b></div>`;
    if (result.res) extra += aoRenderHttp('Resposta', result.res);
  }
  return `<div class="ao-result-box ${cls}"><div class="ao-verdict-title">${escapeHTML(result.verdictMsg)}</div>${extra}</div>`;
}

async function aoRunTest(testFn, label) {
  const row = aoSelectedRow();
  const el = aoId('api-results');
  if (!el) return;
  if (!row) { el.innerHTML = '<div style="color:#ffa657">Selecione uma request primeiro.</div>'; return; }
  el.innerHTML = `<div style="color:#8aa0c8">⏳ ${escapeHTML(label)}...</div>`;
  const result = await testFn(row);
  el.innerHTML = aoResultBox(result);
  const cls = result.verdict === 'critical' ? 'ao-verdict-critical' : (result.verdict === 'warn' ? 'ao-verdict-warn' : 'ao-verdict-ok');
  aoAddFeedItem(cls, 'API Tester: ' + label, result.verdictMsg, row.method + ' ' + row.url);
  if (result.verdict === 'critical') aoNotify('CRITICAL', result.verdictMsg.replace(/^🚨\s*/,''));
}

aoId('api-test-auth')?.addEventListener('click', () => {
  const ab = (aoId('account-b-headers')?.value||'').split('\n').map(l=>l.trim()).filter(Boolean);
  aoRunTest(row => aveoneTestBrokenAuth(row, ab), 'Broken Auth/BOLA');
});
aoId('api-test-idor')?.addEventListener('click', () => {
  const ab = (aoId('account-b-headers')?.value||'').split('\n').map(l=>l.trim()).filter(Boolean);
  aoRunTest(row => aveoneTestIDOR(row, ab), 'IDOR');
});
aoId('api-test-methods')?.addEventListener('click', () => aoRunTest(aveoneTestMethods, 'Fuzzing de Métodos'));
aoId('api-test-mass')?.addEventListener('click', () => aoRunTest(aveoneTestMassAssignment, 'Mass Assignment'));
aoId('api-test-cors')?.addEventListener('click', () => aoRunTest(aveoneTestCors, 'CORS'));

aoId('api-req-select')?.addEventListener('change', () => {
  const row = aoSelectedRow(); if (!row) return;
  const rm = aoId('rep-method'); if (rm) rm.value = row.method;
  const ru = aoId('rep-url'); if (ru) ru.value = row.url;
  const rh = aoId('rep-headers'); if (rh) rh.value = aveoneHeaderArrayToLines(row.reqHeaders).join('\n');
  const rb = aoId('rep-body'); if (rb) rb.value = row.body || '';
});

// ── Repeater manual ───────────────────────────────────────────────────────────
aoId('rep-send')?.addEventListener('click', async () => {
  const method = aoId('rep-method')?.value || 'GET';
  const url = (aoId('rep-url')?.value || '').trim();
  const headerLines = (aoId('rep-headers')?.value || '').split('\n').filter(l => l.trim());
  const body = aoId('rep-body')?.value || '';
  const out = aoId('rep-output');
  if (!url || !out) { if (out) out.textContent = 'Informe uma URL.'; return; }
  out.textContent = '⏳ Enviando...';
  const res = await aveoneSend(method, url, headerLines, body, { includeAuth: true, includeCookies: true });
  if (!res.ok) { out.textContent = 'Erro: ' + res.error; return; }
  const headerDump = (res.headers || []).map(([k,v]) => `${k}: ${v}`).join('\n');
  const bodyType = detectType(res.body || '{}');
  const formattedBody = formatCode(res.body || '').formatted;
  out.innerHTML =
    `<div style="color:#00e5ff">HTTP ${res.status} · ${res.ms}ms</div>` +
    `<div style="color:#8aa0c8;margin:6px 0">${escapeHTML(headerDump)}</div>` +
    aoCodeHTML(formattedBody, bodyType);
  const findings = scanText(res.body || '');
  if (findings.length) {
    out.innerHTML += '<div class="ao-findings-area" style="margin-top:8px">' +
      findings.map(f => `<div class="ao-finding ao-finding-${f.sev}"><span class="ao-sev-badge">${f.sev}</span> <span class="ao-find-title">${escapeHTML(f.title)}</span></div>`).join('') +
      '</div>';
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────
aoInitTabs();
