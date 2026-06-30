const { app, BrowserWindow, ipcMain, session, shell, Menu, dialog, net: electronNet, clipboard } = require('electron');
const path = require('path');
const fs   = require('fs');
const netModule = require('net');

// Match a URL against a glob pattern (e.g. *://example.com/*)
function matchUrlPattern(pattern, url) {
  if (!pattern || pattern === '*' || pattern === '<all_urls>') return true;
  try {
    const re = '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*') + '$';
    return new RegExp(re).test(url);
  } catch { return false; }
}

// Fix SSL and rendering issues on Windows
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('allow-insecure-localhost');

const CAIDO_URL   = 'http://localhost:8080';
const AVEONE_URL  = 'https://www.aveone.com.br/app';
const PARTITION   = 'persist:avebrowser';
const TOR_SOCKS   = '127.0.0.1';
const TOR_PORT    = 9050;
const TOR_CTRL    = 9051;

let mainWindow    = null;
let torEnabled    = false;
const capturedRequests = [];
let captureEnabled = true;

// ── TOR control: send SIGNAL NEWNYM to rotate IP ─────────────────────────────
function torNewCircuit() {
  return new Promise((resolve) => {
    const client = netModule.createConnection({ host: TOR_SOCKS, port: TOR_CTRL });
    let buf = '';
    let authed = false;
    client.setTimeout(4000);
    client.on('connect', () => client.write('AUTHENTICATE ""\r\n'));
    client.on('data', (d) => {
      buf += d.toString();
      if (!authed && buf.includes('250 OK')) {
        authed = true;
        buf = '';
        client.write('SIGNAL NEWNYM\r\n');
      } else if (authed && buf.includes('250 OK')) {
        client.end();
        resolve(true);
      } else if (buf.includes('515') || buf.includes('551')) {
        client.end();
        resolve(false);
      }
    });
    client.on('error', () => resolve(false));
    client.on('timeout', () => { client.destroy(); resolve(false); });
  });
}

// ── Get current IP via proxied session ───────────────────────────────────────
async function getCurrentIp() {
  const ses = session.fromPartition(PARTITION);
  try {
    const res = await ses.fetch('https://api.ipify.org?format=json');
    const { ip } = await res.json();
    return ip;
  } catch {
    try {
      const res2 = await ses.fetch('https://ifconfig.me/ip');
      return (await res2.text()).trim();
    } catch { return '—'; }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
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

  // Always reset proxy on startup — persisted SOCKS5 from a previous TOR session
  // would block ALL traffic silently since TOR isn't running
  ses.setProxy({ mode: 'direct' }).catch(() => {});
  torEnabled = false;

  // ── Permissions: allow media/clipboard, ask user for others ──────────────────
  ses.setPermissionRequestHandler((wc, permission, callback, details) => {
    const autoAllow = ['clipboard-read', 'clipboard-sanitized-write', 'media', 'mediaKeySystem', 'fullscreen', 'pointerLock'];
    if (autoAllow.includes(permission)) { callback(true); return; }
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'question',
      buttons: ['Permitir', 'Bloquear'],
      title: 'Permissão solicitada',
      message: `O site pede permissão: ${permission}`,
      detail: details?.requestingUrl || '',
    });
    callback(choice === 0);
  });

  // ── Downloads ──────────────────────────────────────────────────────────────
  ses.on('will-download', (event, item) => {
    mainWindow?.webContents.send('download-started', { filename: item.getFilename(), url: item.getURL(), total: item.getTotalBytes() });
    item.on('done', (e, state) => {
      mainWindow?.webContents.send('download-done', { filename: item.getFilename(), state, path: item.getSavePath() });
    });
  });

  // ── Context menu (right-click in webview) ─────────────────────────────────
  ipcMain.on('show-context-menu', (event, params) => {
    const send = (action, data) => event.sender.send('ctx-action', action, data || {});
    const tpl = [];

    if (params.linkURL) {
      tpl.push(
        { label: 'Abrir link em nova aba',      click: () => send('open-tab', { url: params.linkURL }) },
        { label: 'Copiar endereço do link',      click: () => clipboard.writeText(params.linkURL) },
        { type: 'separator' }
      );
    }
    if (params.mediaType === 'image' && params.srcURL) {
      tpl.push(
        { label: 'Abrir imagem em nova aba',     click: () => send('open-tab', { url: params.srcURL }) },
        { label: 'Copiar endereço da imagem',    click: () => clipboard.writeText(params.srcURL) },
        { type: 'separator' }
      );
    }
    if (params.selectionText) {
      const sel = params.selectionText.slice(0, 32) + (params.selectionText.length > 32 ? '…' : '');
      tpl.push(
        { label: 'Copiar',                       click: () => send('copy', {}) },
        { label: `Pesquisar "${sel}"`,            click: () => send('search', { text: params.selectionText }) },
        { type: 'separator' }
      );
    } else if (params.isEditable) {
      tpl.push(
        { label: 'Cortar',      click: () => send('cut', {}) },
        { label: 'Copiar',      click: () => send('copy', {}) },
        { label: 'Colar',       click: () => send('paste', {}) },
        { label: 'Selecionar tudo', click: () => send('select-all', {}) },
        { type: 'separator' }
      );
    }

    tpl.push(
      { label: 'Voltar',              enabled: !!params.canGoBack,    click: () => send('back', {}) },
      { label: 'Avançar',             enabled: !!params.canGoForward, click: () => send('forward', {}) },
      { label: 'Recarregar',          click: () => send('reload', {}) },
      { type: 'separator' },
      { label: 'Guardar página como…', click: () => send('save', {}) },
      { label: 'Imprimir…',           click: () => send('print', {}) },
      { type: 'separator' },
      { label: 'Ver código fonte',    click: () => send('view-source', {}) },
      { label: 'Inspecionar elemento', click: () => send('devtools', {}) },
    );

    Menu.buildFromTemplate(tpl).popup({ window: mainWindow });
  });

  // ── Request interception ────────────────────────────────────────────────────
  ses.webRequest.onBeforeSendHeaders({ urls: ['<all_urls>'] }, (details, callback) => {
    if (captureEnabled && !['image','stylesheet','font'].includes(details.resourceType)) {
      const entry = {
        id: details.id, method: details.method, url: details.url,
        type: details.resourceType, requestHeaders: details.requestHeaders,
        statusCode: null, responseHeaders: null, ts: Date.now(), duration: null,
      };
      capturedRequests.unshift(entry);
      if (capturedRequests.length > 200) capturedRequests.pop();
      mainWindow?.webContents.send('request-captured', entry);
    }
    callback({ requestHeaders: details.requestHeaders });
  });

  ses.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, (details, callback) => {
    if (captureEnabled) {
      const entry = capturedRequests.find(r => r.id === details.id);
      if (entry) {
        entry.statusCode = details.statusCode;
        entry.responseHeaders = details.responseHeaders;
        entry.duration = Date.now() - entry.ts;
        mainWindow?.webContents.send('response-captured', {
          id: entry.id, statusCode: entry.statusCode,
          responseHeaders: entry.responseHeaders, duration: entry.duration,
        });
      }
    }
    callback({ responseHeaders: details.responseHeaders });
  });

  // ── IPC: Window ────────────────────────────────────────────────────────────
  ipcMain.handle('window-minimize', () => mainWindow.minimize());
  ipcMain.handle('window-maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
  ipcMain.handle('window-close',    () => mainWindow.close());
  ipcMain.handle('window-is-max',   () => mainWindow.isMaximized());

  // ── IPC: Capture ───────────────────────────────────────────────────────────
  ipcMain.handle('get-captures',    () => capturedRequests.slice(0, 100));
  ipcMain.handle('clear-captures',  () => { capturedRequests.length = 0; return true; });
  ipcMain.handle('toggle-capture',  (_, v) => { captureEnabled = v; return captureEnabled; });

  // ── IPC: Navigation ────────────────────────────────────────────────────────
  ipcMain.handle('open-caido',      () => shell.openExternal(CAIDO_URL));
  ipcMain.handle('open-aveone',     () => shell.openExternal(AVEONE_URL));
  ipcMain.handle('open-external',   (_, url) => shell.openExternal(url));
  ipcMain.handle('send-to-aveone',  (_, data) => {
    shell.openExternal(`${AVEONE_URL}?import=${encodeURIComponent(JSON.stringify(data))}`);
    return true;
  });
  ipcMain.handle('show-save-dialog', async () =>
    dialog.showSaveDialog(mainWindow, {
      defaultPath: 'aveone-capture.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
  );

  // ── IPC: TOR ───────────────────────────────────────────────────────────────
  ipcMain.handle('tor-toggle', async (_, enable) => {
    const s = session.fromPartition(PARTITION);
    if (enable) {
      await s.setProxy({
        proxyRules: `socks5://${TOR_SOCKS}:${TOR_PORT}`,
        proxyBypassRules: '<local>',
      });
    } else {
      await s.setProxy({ mode: 'direct' });
    }
    torEnabled = enable;
    return torEnabled;
  });

  ipcMain.handle('tor-new-ip',  async () => torNewCircuit());
  ipcMain.handle('get-ip',      async () => getCurrentIp());
  ipcMain.handle('tor-status',  () => torEnabled);

  // ── IPC: AveOne CORS-free fetch ────────────────────────────────────────────
  ipcMain.handle('aveone-fetch', (_, { method, url, headers, body }) => {
    return new Promise((resolve) => {
      const t0 = Date.now();
      try {
        const req = electronNet.request({ method: method || 'GET', url, useSessionCookies: true, partition: PARTITION });
        Object.entries(headers || {}).forEach(([k, v]) => {
          try { req.setHeader(k, String(v)); } catch (e) { /* skip forbidden headers */ }
        });
        req.on('response', (res) => {
          const hdrs = [];
          Object.entries(res.headers).forEach(([k, v]) => hdrs.push([k, Array.isArray(v) ? v.join(', ') : v]));
          let data = '';
          res.on('data', chunk => { if (data.length < 500000) data += chunk.toString(); });
          res.on('end', () => resolve({ ok: true, status: res.statusCode, statusText: '', headers: hdrs, body: data, ms: Date.now() - t0 }));
          res.on('error', e => resolve({ ok: false, error: e.message, ms: Date.now() - t0 }));
        });
        req.on('error', e => resolve({ ok: false, error: e.message, ms: Date.now() - t0 }));
        if (body && !['GET', 'HEAD'].includes((method || '').toUpperCase())) req.write(body);
        req.end();
      } catch (e) {
        resolve({ ok: false, error: e.message, ms: Date.now() - t0 });
      }
    });
  });

  // ── IPC: Cookies ───────────────────────────────────────────────────────────
  ipcMain.handle('get-cookies', async (_, url) => {
    const s = session.fromPartition(PARTITION);
    try { return await s.cookies.get(url ? { url } : {}); } catch { return []; }
  });
  ipcMain.handle('remove-cookie', async (_, url, name) => {
    const s = session.fromPartition(PARTITION);
    try { await s.cookies.remove(url, name); return true; } catch { return false; }
  });
  ipcMain.handle('get-all-cookies', async () => {
    const s = session.fromPartition(PARTITION);
    try { return await s.cookies.get({}); } catch { return []; }
  });

  mainWindow.on('maximize',   () => mainWindow?.webContents.send('window-state', 'maximized'));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window-state', 'normal'));
  mainWindow.on('closed',     () => { mainWindow = null; });

  // ── Extension / Userscript / Plugin system ────────────────────────────────
  const userData        = app.getPath('userData');
  const EXTS_FILE       = path.join(userData, 'ave-extensions.json');
  const USERSCRIPTS_DIR = path.join(userData, 'userscripts');
  const PLUGINS_DIR     = path.join(userData, 'plugins');
  [USERSCRIPTS_DIR, PLUGINS_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

  // Auto-reload extensions saved from last session
  try {
    const saved = JSON.parse(fs.readFileSync(EXTS_FILE, 'utf8') || '[]');
    for (const p of saved) {
      if (fs.existsSync(p)) ses.loadExtension(p, { allowFileAccess: true }).catch(e => console.warn('Ext load failed:', e.message));
    }
  } catch {}

  // Helpers
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

  // ── IPC: Chrome Extensions ─────────────────────────────────────────────────
  ipcMain.handle('ext-load', async (_, extPath) => {
    try {
      const ext = await ses.loadExtension(extPath, { allowFileAccess: true });
      let saved = []; try { saved = JSON.parse(fs.readFileSync(EXTS_FILE, 'utf8') || '[]'); } catch {}
      if (!saved.includes(extPath)) { saved.push(extPath); fs.writeFileSync(EXTS_FILE, JSON.stringify(saved)); }
      return { ok: true, id: ext.id, name: ext.name, version: ext.version };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('ext-remove', async (_, id) => {
    try {
      const all = ses.getAllExtensions();
      const ext = all.find(e => e.id === id);
      ses.removeExtension(id);
      if (ext?.path) {
        let saved = []; try { saved = JSON.parse(fs.readFileSync(EXTS_FILE, 'utf8') || '[]'); } catch {}
        fs.writeFileSync(EXTS_FILE, JSON.stringify(saved.filter(p => p !== ext.path)));
      }
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('ext-list', () => {
    try { return ses.getAllExtensions().map(e => ({ id: e.id, name: e.name, version: e.version, path: e.path })); }
    catch { return []; }
  });

  // ── IPC: Userscripts ───────────────────────────────────────────────────────
  ipcMain.handle('us-list',   ()         => readAll(USERSCRIPTS_DIR));
  ipcMain.handle('us-delete', (_, id)    => {
    try { const f = usrPath(id); if (fs.existsSync(f)) fs.unlinkSync(f); return { ok: true }; }
    catch (e) { return { ok: false, error: e.message }; }
  });
  ipcMain.handle('us-save', (_, s) => {
    try {
      if (!s.id) s.id = 'us_' + Date.now();
      fs.writeFileSync(usrPath(s.id), JSON.stringify(s, null, 2));
      return { ok: true, id: s.id };
    } catch (e) { return { ok: false, error: e.message }; }
  });
  ipcMain.handle('us-get-for-url', (_, url) => {
    return readAll(USERSCRIPTS_DIR).filter(s => s.enabled && matchUrlPattern(s.match || '*', url));
  });

  // ── IPC: Plugins ───────────────────────────────────────────────────────────
  ipcMain.handle('plugin-list',   ()         => readAll(PLUGINS_DIR));
  ipcMain.handle('plugin-delete', (_, id)    => {
    try { const f = plugPath(id); if (fs.existsSync(f)) fs.unlinkSync(f); return { ok: true }; }
    catch (e) { return { ok: false, error: e.message }; }
  });
  ipcMain.handle('plugin-save', (_, p) => {
    try {
      if (!p.id) p.id = 'plg_' + Date.now();
      fs.writeFileSync(plugPath(p.id), JSON.stringify(p, null, 2));
      return { ok: true, id: p.id };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  // ── IPC: Dialogs / FS ─────────────────────────────────────────────────────
  ipcMain.handle('dialog-open-folder', async () => {
    const r = await dialog.showOpenDialog(mainWindow, { title: 'Selecionar pasta da extensão', properties: ['openDirectory'], buttonLabel: 'Carregar' });
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
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
