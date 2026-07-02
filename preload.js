// AveBrowser v2.0 — preload (contextBridge)
// Exposes window.ave API to the renderer. All IPC channels are explicitly
// allowlisted — no nodeIntegration required.

const { contextBridge, ipcRenderer } = require('electron');

const _listenerWrappers = new Map();

contextBridge.exposeInMainWorld('ave', {
  // ── Window ────────────────────────────────────────────────────────────────
  minimize:        () => ipcRenderer.invoke('window-minimize'),
  maximize:        () => ipcRenderer.invoke('window-maximize'),
  close:           () => ipcRenderer.invoke('window-close'),
  isMaximized:     () => ipcRenderer.invoke('window-is-max'),

  // ── Navigation ────────────────────────────────────────────────────────────
  openExternal:    (url)  => ipcRenderer.invoke('open-external', url),

  // ── TOR ───────────────────────────────────────────────────────────────────
  torToggle:       (v)    => ipcRenderer.invoke('tor-toggle', v),
  torNewIp:        ()     => ipcRenderer.invoke('tor-new-ip'),
  getIp:           ()     => ipcRenderer.invoke('get-ip'),
  torStatus:       ()     => ipcRenderer.invoke('tor-status'),

  // ── Go Proxy API (via main-process relay — no CORS) ───────────────────────
  proxyInfo:       ()     => ipcRenderer.invoke('proxy-info'),
  proxyFetch:      (opts) => ipcRenderer.invoke('proxy-fetch', opts),

  // ── Fuzzer ────────────────────────────────────────────────────────────────
  fuzzerRun:       (opts) => ipcRenderer.invoke('fuzzer-run', opts),
  fuzzerStop:      ()     => ipcRenderer.invoke('fuzzer-stop'),

  // ── AveOne (CORS-free fetch via main process) ─────────────────────────────
  aveoneFetch:     (opts) => ipcRenderer.invoke('aveone-fetch', opts),

  // ── Cookies ───────────────────────────────────────────────────────────────
  getCookies:      (url)  => ipcRenderer.invoke('get-cookies', url),
  getAllCookies:   ()      => ipcRenderer.invoke('get-all-cookies'),
  removeCookie:    (url, name) => ipcRenderer.invoke('remove-cookie', url, name),

  // ── Context menu ──────────────────────────────────────────────────────────
  showContextMenu: (params) => ipcRenderer.send('show-context-menu', params),

  // ── Chrome Extensions ─────────────────────────────────────────────────────
  extLoad:         (p)    => ipcRenderer.invoke('ext-load', p),
  extRemove:       (id)   => ipcRenderer.invoke('ext-remove', id),
  extList:         ()     => ipcRenderer.invoke('ext-list'),
  extOpenPopup:    (opts) => ipcRenderer.invoke('ext-open-popup', opts),

  // ── Userscripts ───────────────────────────────────────────────────────────
  usList:          ()     => ipcRenderer.invoke('us-list'),
  usSave:          (s)    => ipcRenderer.invoke('us-save', s),
  usDelete:        (id)   => ipcRenderer.invoke('us-delete', id),
  usGetForUrl:     (url)  => ipcRenderer.invoke('us-get-for-url', url),

  // ── Plugins ───────────────────────────────────────────────────────────────
  pluginList:      ()     => ipcRenderer.invoke('plugin-list'),
  pluginSave:      (p)    => ipcRenderer.invoke('plugin-save', p),
  pluginDelete:    (id)   => ipcRenderer.invoke('plugin-delete', id),

  // ── Dialogs / FS ──────────────────────────────────────────────────────────
  dialogOpenFolder: ()        => ipcRenderer.invoke('dialog-open-folder'),
  dialogOpenFile:   (opts)    => ipcRenderer.invoke('dialog-open-file', opts),
  fsRead:           (p)       => ipcRenderer.invoke('fs-read', p),

  // ── Event bus ─────────────────────────────────────────────────────────────
  on: (ch, cb) => {
    const allowed = [
      'window-state', 'ctx-action',
      'download-started', 'download-done',
      'permission-denied-toast', 'tor-ip-changed',
      'fuzzer-line',             // streamed output from avefuzz
    ];
    if (!allowed.includes(ch)) return;
    const wrapper = (_, ...a) => cb(...a);
    if (!_listenerWrappers.has(cb)) _listenerWrappers.set(cb, []);
    _listenerWrappers.get(cb).push({ ch, wrapper });
    ipcRenderer.on(ch, wrapper);
  },
  off: (ch, cb) => {
    const entries = _listenerWrappers.get(cb);
    if (!entries) return;
    const idx = entries.findIndex(e => e.ch === ch);
    if (idx === -1) return;
    ipcRenderer.removeListener(ch, entries[idx].wrapper);
    entries.splice(idx, 1);
    if (!entries.length) _listenerWrappers.delete(cb);
  },
});
