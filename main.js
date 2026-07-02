// AveBrowser v2.0 — Electron main process
// Architecture: Electron shell  +  Go MITM proxy (127.0.0.1:7777)
//               +  Rust fuzzer CLI  +  Bash build/run scripts
//
// The Go proxy handles ALL traffic capture — onBeforeSendHeaders is no
// longer needed here. The renderer connects to ws://127.0.0.1:7778/ws
// for real-time request streaming.

const { app, BrowserWindow, ipcMain, session, shell, net, Menu, dialog, clipboard } = require('electron');
const path   = require('path');
const fs     = require('fs');
const { spawn, execFile } = require('child_process');
const http   = require('http');

// ── Config ────────────────────────────────────────────────────────────────────
const PARTITION    = 'persist:avebrowser';
const PROXY_PORT   = parseInt(process.env.AVE_PROXY_PORT   || '7777', 10);
const CONTROL_PORT = parseInt(process.env.AVE_CONTROL_PORT || '7778', 10);
const PROXY_ADDR   = `http://127.0.0.1:${PROXY_PORT}`;
const CONTROL_URL  = `http://127.0.0.1:${CONTROL_PORT}`;
const TOR_SOCKS    = '127.0.0.1';
const TOR_PORT     = 9050;
const TOR_CTRL     = 9051;

// Resolve binary path — works for both dev and packed ASAR
function binPath(name) {
  const candidates = [
    path.join(__dirname, 'bin', name),
    path.join(process.resourcesPath || '', 'bin', name),
    path.join(__dirname, '..', 'bin', name),
  ];
  return candidates.find(p => fs.existsSync(p)) || candidates[0];
}

let mainWindow    = null;
let proxyProcess  = null;
let torEnabled    = false;
let appInitialized = false;

// ── URL pattern matching (for userscripts) ────────────────────────────────────
function matchUrlPattern(pattern, url) {
  if (!pattern || pattern === '*' || pattern === '<all_urls>') return true;
  try {
    const re = '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*') + '$';
    return new RegExp(re).test(url);
  } catch { return false; }
}

// ── Go proxy lifecycle ────────────────────────────────────────────────────────

function proxyRunning() {
  return new Promise(resolve => {
    http.get(`${CONTROL_URL}/api/stats`, res => resolve(res.statusCode === 200))
        .on('error', () => resolve(false));
  });
}

async function startProxy() {
  if (await proxyRunning()) {
    console.log(`[main] Proxy already running on :${PROXY_PORT}`);
    return true;
  }
  const bin = binPath(process.platform === 'win32' ? 'ave-proxy.exe' : 'ave-proxy');
  if (!fs.existsSync(bin)) {
    console.warn('[main] ave-proxy binary not found — running without traffic capture.');
    console.warn('[main] Build it with: bash scripts/build.sh');
    return false;
  }
  proxyProcess = spawn(bin, [], {
    env: { ...process.env, AVE_PROXY_PORT: String(PROXY_PORT), AVE_CONTROL_PORT: String(CONTROL_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proxyProcess.stdout.on('data', d => console.log('[proxy]', d.toString().trim()));
  proxyProcess.stderr.on('data', d => console.error('[proxy]', d.toString().trim()));
  proxyProcess.on('exit', code => console.log('[proxy] exited', code));

  for (let i = 0; i < 20; i++) {
    if (await proxyRunning()) {
      console.log(`[main] Go proxy ready on :${PROXY_PORT}`);
      return true;
    }
    await new Promise(r => setTimeout(r, 250));
  }
  console.warn('[main] Proxy did not start in time — running without capture.');
  return false;
}

// ── Window ────────────────────────────────────────────────────────────────────

async function createWindow() {
  const proxyOk = await startProxy();

  mainWindow = new BrowserWindow({
    width: 1440, height: 920,
    minWidth: 960, minHeight: 640,
    frame: false, titleBarStyle: 'hidden',
    backgroundColor: '#07070f',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  Menu.setApplicationMenu(null);

  const ses = session.fromPartition(PARTITION);

  // Route ALL webview traffic through the Go MITM proxy
  // The proxy handles capture, TOR chaining, and replay.
  if (proxyOk) {
    await ses.setProxy({ proxyRules: PROXY_ADDR, proxyBypassRules: '<local>' });
    ses.setCertificateVerifyProc((req, cb) => cb(0));
    console.log(`[main] Webview proxy → ${PROXY_ADDR} (MITM capture active)`);
  } else {
    await ses.setProxy({ mode: 'direct' });
    console.log('[main] Direct connection (no proxy binary — install Go and run scripts/build.sh)');
  }
  torEnabled = false;

  if (appInitialized) return;
  appInitialized = true;

  // ── Permissions ─────────────────────────────────────────────────────────────
  ses.setPermissionRequestHandler((wc, permission, callback, details) => {
    const autoAllow = ['clipboard-read','clipboard-sanitized-write','media','mediaKeySystem','fullscreen','pointerLock','accessibility-events'];
    const autoDeny  = ['geolocation','notifications','push','midi','midiSysex','payment','background-sync','ambient-light-sensor','accelerometer','gyroscope','magnetometer','idle-detection','periodic-background-sync'];
    if (autoAllow.includes(permission)) { callback(true); return; }
    if (autoDeny.includes(permission)) {
      callback(false);
      const host = (() => { try { return new URL(details?.requestingUrl || '').hostname; } catch { return '?'; } })();
      mainWindow?.webContents.send('permission-denied-toast', permission, host);
      return;
    }
    dialog.showMessageBox(mainWindow, {
      type: 'question', buttons: ['Permitir','Bloquear'], defaultId: 1,
      title: 'Permissão', message: `O site pede: ${permission}`,
      detail: details?.requestingUrl || '',
    }).then(({ response }) => callback(response === 0));
  });

  // ── Downloads ───────────────────────────────────────────────────────────────
  ses.on('will-download', (event, item) => {
    mainWindow?.webContents.send('download-started', { filename: item.getFilename(), url: item.getURL(), total: item.getTotalBytes() });
    item.on('done', (e, state) => {
      mainWindow?.webContents.send('download-done', { filename: item.getFilename(), state, path: item.getSavePath() });
    });
  });

  // ── Context menu ────────────────────────────────────────────────────────────
  ipcMain.on('show-context-menu', (event, params) => {
    const send = (action, data) => event.sender.send('ctx-action', action, data || {});
    const tpl = [];
    if (params.linkURL) {
      tpl.push(
        { label: 'Abrir link em nova aba',     click: () => send('open-tab', { url: params.linkURL }) },
        { label: 'Copiar endereço do link',     click: () => clipboard.writeText(params.linkURL) },
        { label: 'Enviar ao Fuzzer',            click: () => send('fuzz-url', { url: params.linkURL }) },
        { type: 'separator' }
      );
    }
    if (params.mediaType === 'image' && params.srcURL) {
      tpl.push(
        { label: 'Abrir imagem em nova aba',   click: () => send('open-tab', { url: params.srcURL }) },
        { label: 'Copiar endereço da imagem',  click: () => clipboard.writeText(params.srcURL) },
        { type: 'separator' }
      );
    }
    if (params.selectionText) {
      const sel = params.selectionText.slice(0, 32) + (params.selectionText.length > 32 ? '…' : '');
      tpl.push(
        { label: 'Copiar',                     click: () => send('copy', {}) },
        { label: `Pesquisar "${sel}"`,          click: () => send('search', { text: params.selectionText }) },
        { type: 'separator' }
      );
    } else if (params.isEditable) {
      tpl.push(
        { label: 'Cortar',          click: () => send('cut', {}) },
        { label: 'Copiar',          click: () => send('copy', {}) },
        { label: 'Colar',           click: () => send('paste', {}) },
        { label: 'Selecionar tudo', click: () => send('select-all', {}) },
        { type: 'separator' }
      );
    }
    tpl.push(
      { label: 'Voltar',              enabled: !!params.canGoBack,    click: () => send('back', {}) },
      { label: 'Avançar',             enabled: !!params.canGoForward, click: () => send('forward', {}) },
      { label: 'Recarregar',          click: () => send('reload', {}) },
      { type: 'separator' },
      { label: 'Guardar página…',     click: () => send('save', {}) },
      { label: 'Imprimir…',           click: () => send('print', {}) },
      { type: 'separator' },
      { label: 'Ver código fonte',    click: () => send('view-source', {}) },
      { label: 'Inspecionar',         click: () => send('devtools', {}) },
    );
    Menu.buildFromTemplate(tpl).popup({ window: mainWindow });
  });

  // ── IPC: Window ─────────────────────────────────────────────────────────────
  ipcMain.handle('window-minimize', () => mainWindow.minimize());
  ipcMain.handle('window-maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
  ipcMain.handle('window-close',    () => mainWindow.close());
  ipcMain.handle('window-is-max',   () => mainWindow.isMaximized());

  // ── IPC: Navigation ─────────────────────────────────────────────────────────
  ipcMain.handle('open-external',  (_, url) => shell.openExternal(url));

  // ── IPC: Proxy passthrough ───────────────────────────────────────────────────
  // Renderer can call these to talk to the Go proxy API without CORS issues.
  ipcMain.handle('proxy-fetch', async (_, { path: apiPath, method = 'GET', body }) => {
    return new Promise((resolve) => {
      const options = {
        hostname: '127.0.0.1', port: CONTROL_PORT,
        path: apiPath, method,
        headers: { 'Content-Type': 'application/json' },
      };
      const req = http.request(options, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try { resolve({ ok: true, status: res.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ ok: true, status: res.statusCode, body: data }); }
        });
      });
      req.on('error', e => resolve({ ok: false, error: e.message }));
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  });

  // Proxy config info for renderer
  ipcMain.handle('proxy-info', () => ({ proxyPort: PROXY_PORT, controlPort: CONTROL_PORT }));

  // ── IPC: TOR ────────────────────────────────────────────────────────────────
  // Tell Go proxy to route through TOR — it handles the SOCKS5 chaining
  ipcMain.handle('tor-toggle', async (_, enable) => {
    const result = await new Promise(resolve => {
      const body = JSON.stringify({ enable, addr: `${TOR_SOCKS}:${TOR_PORT}` });
      const req = http.request({
        hostname: '127.0.0.1', port: CONTROL_PORT,
        path: '/api/tor', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      }, res => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ ok: false }); } });
      });
      req.on('error', () => resolve({ ok: false }));
      req.write(body); req.end();
    });
    torEnabled = result.tor ?? enable;

    // Still update the Electron session proxy for non-webview requests
    const s = session.fromPartition(PARTITION);
    if (torEnabled) {
      // Go proxy handles TOR chaining — Electron still routes through Go proxy
      await s.setProxy({ proxyRules: PROXY_ADDR, proxyBypassRules: '<local>' });
    } else {
      await s.setProxy({ proxyRules: PROXY_ADDR, proxyBypassRules: '<local>' });
    }
    return torEnabled;
  });

  ipcMain.handle('tor-status', () => torEnabled);
  ipcMain.handle('tor-new-ip', async () => {
    // Signal TOR control port for new circuit
    const net = require('net');
    return new Promise(resolve => {
      const client = net.createConnection({ host: TOR_SOCKS, port: TOR_CTRL });
      let buf = '', authed = false;
      client.setTimeout(4000);
      client.on('connect', () => client.write('AUTHENTICATE ""\r\n'));
      client.on('data', d => {
        buf += d.toString();
        if (!authed && buf.includes('250 OK')) { authed = true; buf = ''; client.write('SIGNAL NEWNYM\r\n'); }
        else if (authed && buf.includes('250 OK')) { client.end(); resolve(true); }
        else if (buf.includes('515') || buf.includes('551')) { client.end(); resolve(false); }
      });
      client.on('error', () => resolve(false));
      client.on('timeout', () => { client.destroy(); resolve(false); });
    });
  });
  ipcMain.handle('get-ip', async () => {
    const ses2 = session.fromPartition(PARTITION);
    try {
      const r = await ses2.fetch('https://api.ipify.org?format=json');
      const { ip } = await r.json();
      return ip;
    } catch { return '—'; }
  });

  // ── IPC: Fuzzer ─────────────────────────────────────────────────────────────
  ipcMain.handle('fuzzer-run', async (_, opts) => {
    const bin = binPath(process.platform === 'win32' ? 'avefuzz.exe' : 'avefuzz');
    if (!fs.existsSync(bin)) {
      return { ok: false, error: 'avefuzz binary not found. Run scripts/build.sh' };
    }
    return new Promise(resolve => {
      const args = [
        '-u', opts.url,
        '-w', opts.wordlist,
        '-X', opts.method || 'GET',
        '-c', String(opts.concurrency || 50),
        '-t', String(opts.timeout || 10),
        '--proxy', PROXY_ADDR,
        '-q',         // quiet mode — JSON output only
        '--show-errors',
      ];
      if (opts.data)        args.push('-d', opts.data);
      if (opts.headers)     opts.headers.forEach(h => args.push('-H', h));
      if (opts.matchCodes)  args.push('--mc', opts.matchCodes);
      if (opts.filterCodes) args.push('--fc', opts.filterCodes);
      if (opts.matchRegex)  args.push('--mr', opts.matchRegex);
      if (opts.filterRegex) args.push('--fr', opts.filterRegex);
      if (opts.output)      args.push('-o', opts.output);

      const proc = spawn(bin, args, { env: { ...process.env } });
      const lines = [];
      proc.stdout.on('data', d => {
        const text = d.toString();
        text.split('\n').filter(Boolean).forEach(line => {
          mainWindow?.webContents.send('fuzzer-line', line);
          lines.push(line);
        });
      });
      proc.stderr.on('data', d => mainWindow?.webContents.send('fuzzer-line', d.toString()));
      proc.on('exit', code => resolve({ ok: code === 0, lines, exitCode: code }));
      proc.on('error', e => resolve({ ok: false, error: e.message }));
    });
  });

  ipcMain.handle('fuzzer-stop', () => {
    // The fuzzer is spawned per-run — send SIGINT if still running
    // (tracked by renderer)
    return true;
  });

  // ── IPC: Cookies ────────────────────────────────────────────────────────────
  ipcMain.handle('get-cookies', async (_, url) => {
    const s = session.fromPartition(PARTITION);
    try { return await s.cookies.get(url ? { url } : {}); } catch { return []; }
  });
  ipcMain.handle('get-all-cookies', async () => {
    try { return await session.fromPartition(PARTITION).cookies.get({}); } catch { return []; }
  });
  ipcMain.handle('remove-cookie', async (_, url, name) => {
    try { await session.fromPartition(PARTITION).cookies.remove(url, name); return true; } catch { return false; }
  });

  // ── IPC: AveOne CORS-free fetch ─────────────────────────────────────────────
  const { net: electronNet } = require('electron');
  ipcMain.handle('aveone-fetch', (_, { method, url, headers, body }) => {
    const _SKIP = new Set(['host','content-length','connection','transfer-encoding',
      'accept-encoding','sec-ch-ua','sec-ch-ua-mobile','sec-ch-ua-platform',
      'sec-fetch-site','sec-fetch-mode','sec-fetch-dest','sec-fetch-user','upgrade','via','te']);
    return new Promise(resolve => {
      const t0 = Date.now();
      try {
        let safeUrl; try { safeUrl = new URL(url).toString(); } catch (e) { return resolve({ ok: false, error: 'URL inválida: ' + e.message, ms: 0 }); }
        const req = electronNet.request({ method: method || 'GET', url: safeUrl, useSessionCookies: true, partition: PARTITION });
        Object.entries(headers || {}).forEach(([k, v]) => {
          if (_SKIP.has(k.toLowerCase())) return;
          const sv = String(v).replace(/[\r\n\0]/g, ' ').trim();
          const sk = String(k).replace(/[\r\n\0:]/g, '').trim();
          if (sk && sv) try { req.setHeader(sk, sv); } catch {}
        });
        req.on('response', res => {
          const hdrs = []; Object.entries(res.headers).forEach(([k, v]) => hdrs.push([k, Array.isArray(v) ? v.join(', ') : v]));
          let data = '';
          res.on('data', chunk => { if (data.length < 500000) data += chunk.toString(); });
          res.on('end', () => resolve({ ok: true, status: res.statusCode, statusText: '', headers: hdrs, body: data, ms: Date.now() - t0 }));
          res.on('error', e => resolve({ ok: false, error: e.message, ms: Date.now() - t0 }));
        });
        req.on('error', e => resolve({ ok: false, error: e.message, ms: Date.now() - t0 }));
        if (body && !['GET','HEAD'].includes((method||'').toUpperCase())) try { req.write(String(body)); } catch {}
        req.end();
      } catch (e) { resolve({ ok: false, error: e.message, ms: Date.now() - t0 }); }
    });
  });

  // ── IPC: Dialog / FS ────────────────────────────────────────────────────────
  ipcMain.handle('dialog-open-folder', async () => {
    const r = await dialog.showOpenDialog(mainWindow, { title: 'Selecionar pasta', properties: ['openDirectory'], buttonLabel: 'Carregar' });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('dialog-open-file', async (_, opts) => {
    const r = await dialog.showOpenDialog(mainWindow, { title: opts?.title || 'Abrir', filters: opts?.filters || [], properties: ['openFile'] });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('fs-read', (_, p) => {
    try { return { ok: true, data: fs.readFileSync(p, 'utf8') }; }
    catch (e) { return { ok: false, error: e.message }; }
  });

  // ── IPC: Extension / Userscript / Plugin system ───────────────────────────
  const userData        = app.getPath('userData');
  const EXTS_FILE       = path.join(userData, 'ave-extensions.json');
  const USERSCRIPTS_DIR = path.join(userData, 'userscripts');
  const PLUGINS_DIR     = path.join(userData, 'plugins');
  [USERSCRIPTS_DIR, PLUGINS_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

  // Auto-reload extensions
  try {
    const saved = JSON.parse(fs.readFileSync(EXTS_FILE, 'utf8') || '[]');
    const ses2  = session.fromPartition(PARTITION);
    for (const p of saved) {
      if (fs.existsSync(p)) ses2.loadExtension(p, { allowFileAccess: true }).catch(e => console.warn('Ext load failed:', e.message));
    }
  } catch {}

  const safeName = id => id.replace(/[^a-z0-9_-]/gi, '_');
  const usrPath  = id => path.join(USERSCRIPTS_DIR, safeName(id) + '.json');
  const plugPath = id => path.join(PLUGINS_DIR,     safeName(id) + '.json');
  const readAll  = dir => {
    try {
      return fs.readdirSync(dir).filter(f => f.endsWith('.json'))
        .map(f => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { return null; } })
        .filter(Boolean).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } catch { return []; }
  };

  let extPopupWin = null;
  ipcMain.handle('ext-open-popup', async (_, { popupUrl, iconX, iconY, width, height }) => {
    try {
      if (extPopupWin && !extPopupWin.isDestroyed()) { extPopupWin.close(); extPopupWin = null; }
      const w = width || 380, h = height || 520;
      const bnd = mainWindow.getBounds();
      const px = Math.max(bnd.x, Math.min(bnd.x + bnd.width - w, bnd.x + iconX - w + 16));
      const py = bnd.y + iconY + 4;
      extPopupWin = new BrowserWindow({ width: w, height: h, x: px, y: py, frame: false, resizable: true, alwaysOnTop: true, skipTaskbar: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true, session: session.fromPartition(PARTITION) } });
      extPopupWin.loadURL(popupUrl);
      extPopupWin.on('blur', () => { try { if (!extPopupWin?.isDestroyed()) extPopupWin.close(); } catch {} extPopupWin = null; });
      extPopupWin.on('closed', () => { extPopupWin = null; });
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('ext-load', async (_, extPath) => {
    try {
      const ext = await session.fromPartition(PARTITION).loadExtension(extPath, { allowFileAccess: true });
      let saved = []; try { saved = JSON.parse(fs.readFileSync(EXTS_FILE, 'utf8') || '[]'); } catch {}
      if (!saved.includes(extPath)) { saved.push(extPath); fs.writeFileSync(EXTS_FILE, JSON.stringify(saved)); }
      return { ok: true, id: ext.id, name: ext.name, version: ext.version };
    } catch (e) { return { ok: false, error: e.message }; }
  });
  ipcMain.handle('ext-remove', async (_, id) => {
    try {
      const all  = session.fromPartition(PARTITION).getAllExtensions();
      const ext  = all.find(e => e.id === id);
      session.fromPartition(PARTITION).removeExtension(id);
      if (ext?.path) {
        let saved = []; try { saved = JSON.parse(fs.readFileSync(EXTS_FILE, 'utf8') || '[]'); } catch {}
        fs.writeFileSync(EXTS_FILE, JSON.stringify(saved.filter(p => p !== ext.path)));
      }
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  });
  ipcMain.handle('ext-list', () => {
    try {
      return session.fromPartition(PARTITION).getAllExtensions().map(e => {
        const mf = e.manifest || {}, action = mf.browser_action || mf.action || {};
        let iconMap = action.default_icon || mf.icons || {};
        if (typeof iconMap === 'string') iconMap = { '32': iconMap };
        const sizes = Object.keys(iconMap).map(Number).filter(n => !isNaN(n)).sort((a, b) => Math.abs(a-32) - Math.abs(b-32));
        const iconRelPath = sizes.length ? iconMap[String(sizes[0])] : null;
        let iconUrl = null;
        if (iconRelPath) { try {
          const buf = fs.readFileSync(path.join(e.path, iconRelPath));
          const fext = path.extname(iconRelPath).slice(1).toLowerCase();
          const mime = fext === 'svg' ? 'image/svg+xml' : fext === 'jpg' || fext === 'jpeg' ? 'image/jpeg' : 'image/png';
          iconUrl = `data:${mime};base64,${buf.toString('base64')}`;
        } catch {} }
        return { id: e.id, name: e.name, version: e.version, path: e.path, baseUrl: e.url, iconUrl,
          popupPath: action.default_popup || null, title: action.default_title || e.name };
      });
    } catch { return []; }
  });

  ipcMain.handle('us-list',         ()         => readAll(USERSCRIPTS_DIR));
  ipcMain.handle('us-delete',       (_, id)    => { try { const f = usrPath(id); if (fs.existsSync(f)) fs.unlinkSync(f); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } });
  ipcMain.handle('us-save',         (_, s)     => { try { if (!s.id) s.id = 'us_' + Date.now(); fs.writeFileSync(usrPath(s.id), JSON.stringify(s, null, 2)); return { ok: true, id: s.id }; } catch (e) { return { ok: false, error: e.message }; } });
  ipcMain.handle('us-get-for-url',  (_, url)   => readAll(USERSCRIPTS_DIR).filter(s => s.enabled && matchUrlPattern(s.match || '*', url)));
  ipcMain.handle('plugin-list',     ()         => readAll(PLUGINS_DIR));
  ipcMain.handle('plugin-delete',   (_, id)    => { try { const f = plugPath(id); if (fs.existsSync(f)) fs.unlinkSync(f); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } });
  ipcMain.handle('plugin-save',     (_, p)     => { try { if (!p.id) p.id = 'plg_' + Date.now(); fs.writeFileSync(plugPath(p.id), JSON.stringify(p, null, 2)); return { ok: true, id: p.id }; } catch (e) { return { ok: false, error: e.message }; } });

  // ── IPC: External tool launchers ──────────────────────────────────────────────
  ipcMain.handle('open-caido',  () => shell.openExternal('http://localhost:8080'));
  ipcMain.handle('open-aveone', () => shell.openExternal('http://localhost:3000'));

  // ── IPC: Chrome Web Store CRX installer ──────────────────────────────────────
  function cwsExtractId(input) {
    const m = String(input).match(/(?:detail\/[^/]*\/|^)([a-z]{32})(?:\/|$|\?|#|$)/);
    return m ? m[1] : null;
  }

  async function crxInstall(extId) {
    const os = require('os');
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const crxUrl = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=120.0.0.0&x=id%3D${extId}%26installsource%3Dondemand%26uc`;

    const resp = await net.fetch(crxUrl, { headers: { 'User-Agent': UA } });
    if (!resp.ok) throw new Error(`Falha no download: HTTP ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());

    // Locate ZIP payload inside CRX (look for PK\x03\x04 magic)
    let zipStart = -1;
    for (let i = 0; i < buf.length - 3; i++) {
      if (buf[i] === 0x50 && buf[i+1] === 0x4B && buf[i+2] === 0x03 && buf[i+3] === 0x04) {
        zipStart = i; break;
      }
    }
    if (zipStart === -1) throw new Error('CRX inválido: assinatura ZIP não encontrada');

    const tmpZip = path.join(os.tmpdir(), `ave-crx-${extId}.zip`);
    fs.writeFileSync(tmpZip, buf.slice(zipStart));

    const extDir = path.join(userData, 'crx-extensions', extId);
    fs.mkdirSync(extDir, { recursive: true });

    await new Promise((resolve, reject) => {
      const [cmd, args] = process.platform === 'win32'
        ? ['powershell', ['-NoProfile', '-NonInteractive', '-Command',
            `Expand-Archive -Force -LiteralPath '${tmpZip}' -DestinationPath '${extDir}'`]]
        : ['unzip', ['-o', tmpZip, '-d', extDir]];
      execFile(cmd, args, err => err ? reject(new Error(err.message)) : resolve());
    });

    try { fs.unlinkSync(tmpZip); } catch {}

    const ext = await session.fromPartition(PARTITION).loadExtension(extDir, { allowFileAccess: true });
    let saved = []; try { saved = JSON.parse(fs.readFileSync(EXTS_FILE, 'utf8') || '[]'); } catch {}
    if (!saved.includes(extDir)) { saved.push(extDir); fs.writeFileSync(EXTS_FILE, JSON.stringify(saved)); }
    return { ok: true, id: ext.id, name: ext.name, version: ext.version };
  }

  ipcMain.handle('ext-cws-id',     (_, url)   => cwsExtractId(url));
  ipcMain.handle('ext-install-crx', async (_, input) => {
    try {
      const id = cwsExtractId(input) || (/^[a-z]{32}$/.test(String(input).trim()) ? input.trim() : null);
      if (!id) return { ok: false, error: 'ID ou URL do Chrome Web Store inválido (ex: https://chromewebstore.google.com/detail/nome/abcdefghijklmnopqrstuvwxyz123456)' };
      return await crxInstall(id);
    } catch (e) { return { ok: false, error: e.message }; }
  });

  mainWindow.on('maximize',   () => mainWindow?.webContents.send('window-state', 'maximized'));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window-state', 'normal'));
  mainWindow.on('closed',     () => { mainWindow = null; });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('allow-insecure-localhost');
// proxy-server is set per-session in createWindow() only when ave-proxy is running

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (proxyProcess) { proxyProcess.kill('SIGTERM'); proxyProcess = null; }
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  if (proxyProcess) { proxyProcess.kill('SIGTERM'); proxyProcess = null; }
});
