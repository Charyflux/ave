const { app, BrowserWindow, ipcMain, session, shell, Menu, dialog, net: electronNet } = require('electron');
const path = require('path');
const netModule = require('net');

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
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
