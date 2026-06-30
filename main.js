const { app, BrowserWindow, ipcMain, session, shell, Menu, dialog } = require('electron');
const path = require('path');

const AVEONE_URL = 'http://localhost:8080';
const PARTITION  = 'persist:avebrowser';

let mainWindow = null;
// Stores captured requests: { id, method, url, requestHeaders, statusCode, responseHeaders, time, duration }
const capturedRequests = [];
let captureEnabled = true;

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

  // Remove menu bar
  Menu.setApplicationMenu(null);

  // ── Session-level request interception ───────────────────────────────────
  const ses = session.fromPartition(PARTITION);

  ses.webRequest.onBeforeSendHeaders({ urls: ['<all_urls>'] }, (details, callback) => {
    if (captureEnabled && details.resourceType !== 'image' && details.resourceType !== 'stylesheet' && details.resourceType !== 'font') {
      const entry = {
        id:              details.id,
        method:          details.method,
        url:             details.url,
        type:            details.resourceType,
        requestHeaders:  details.requestHeaders,
        statusCode:      null,
        responseHeaders: null,
        ts:              Date.now(),
        duration:        null,
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
        entry.statusCode      = details.statusCode;
        entry.responseHeaders = details.responseHeaders;
        entry.duration        = Date.now() - entry.ts;
        mainWindow?.webContents.send('response-captured', {
          id:              entry.id,
          statusCode:      entry.statusCode,
          responseHeaders: entry.responseHeaders,
          duration:        entry.duration,
        });
      }
    }
    callback({ responseHeaders: details.responseHeaders });
  });

  // ── IPC handlers ─────────────────────────────────────────────────────────
  ipcMain.handle('get-captures', () => capturedRequests.slice(0, 100));
  ipcMain.handle('clear-captures', () => { capturedRequests.length = 0; return true; });
  ipcMain.handle('toggle-capture', (_, v) => { captureEnabled = v; return captureEnabled; });

  ipcMain.handle('window-minimize',  () => mainWindow.minimize());
  ipcMain.handle('window-maximize',  () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
  ipcMain.handle('window-close',     () => mainWindow.close());
  ipcMain.handle('window-is-max',    () => mainWindow.isMaximized());

  ipcMain.handle('open-devtools', (_, wvId) => {
    const wv = mainWindow.webContents;
    wv.send('open-devtools-for', wvId);
  });

  ipcMain.handle('open-external', (_, url) => shell.openExternal(url));
  ipcMain.handle('open-aveone',   () => shell.openExternal(AVEONE_URL));

  ipcMain.handle('send-to-aveone', (_, data) => {
    // Opens AveOne panel in default browser with the request pre-filled
    const encoded = encodeURIComponent(JSON.stringify(data));
    shell.openExternal(`${AVEONE_URL}?import=${encoded}`);
    return true;
  });

  ipcMain.handle('show-save-dialog', async () => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: 'aveone-capture.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    return result;
  });

  mainWindow.on('maximize',   () => mainWindow?.webContents.send('window-state', 'maximized'));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window-state', 'normal'));
  mainWindow.on('closed',     () => { mainWindow = null; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
