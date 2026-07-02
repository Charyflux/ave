const { contextBridge, ipcRenderer } = require('electron');

const _listenerWrappers = new Map(); // cb -> [{ch, wrapper}] — lets off() find the real registered listener

contextBridge.exposeInMainWorld('ave', {
  // Window
  minimize:        () => ipcRenderer.invoke('window-minimize'),
  maximize:        () => ipcRenderer.invoke('window-maximize'),
  close:           () => ipcRenderer.invoke('window-close'),
  isMaximized:     () => ipcRenderer.invoke('window-is-max'),

  // Capture
  getCaptures:     () => ipcRenderer.invoke('get-captures'),
  clearCaptures:   () => ipcRenderer.invoke('clear-captures'),
  toggleCapture:   (v) => ipcRenderer.invoke('toggle-capture', v),

  // Navigation / integrations
  openCaido:       () => ipcRenderer.invoke('open-caido'),
  openAveOne:      () => ipcRenderer.invoke('open-aveone'),
  openExternal:    (url) => ipcRenderer.invoke('open-external', url),
  sendToAveOne:    (data) => ipcRenderer.invoke('send-to-aveone', data),

  // TOR
  torToggle:       (v) => ipcRenderer.invoke('tor-toggle', v),
  torNewIp:        () => ipcRenderer.invoke('tor-new-ip'),
  getIp:           () => ipcRenderer.invoke('get-ip'),
  torStatus:       () => ipcRenderer.invoke('tor-status'),

  // AveOne Inspector
  aveoneFetch:     (opts) => ipcRenderer.invoke('aveone-fetch', opts),

  // Cookies
  getCookies:      (url) => ipcRenderer.invoke('get-cookies', url),
  getAllCookies:    () => ipcRenderer.invoke('get-all-cookies'),
  removeCookie:    (url, name) => ipcRenderer.invoke('remove-cookie', url, name),

  // Context menu
  showContextMenu: (params) => ipcRenderer.send('show-context-menu', params),

  // Chrome Extensions (MV2, unpacked)
  extLoad:         (extPath) => ipcRenderer.invoke('ext-load', extPath),
  extRemove:       (id)      => ipcRenderer.invoke('ext-remove', id),
  extList:         ()        => ipcRenderer.invoke('ext-list'),
  extOpenPopup:    (opts)    => ipcRenderer.invoke('ext-open-popup', opts),

  // Userscripts
  usList:          ()        => ipcRenderer.invoke('us-list'),
  usSave:          (s)       => ipcRenderer.invoke('us-save', s),
  usDelete:        (id)      => ipcRenderer.invoke('us-delete', id),
  usGetForUrl:     (url)     => ipcRenderer.invoke('us-get-for-url', url),

  // Plugins (run in renderer context)
  pluginList:      ()        => ipcRenderer.invoke('plugin-list'),
  pluginSave:      (p)       => ipcRenderer.invoke('plugin-save', p),
  pluginDelete:    (id)      => ipcRenderer.invoke('plugin-delete', id),

  // Dialogs / FS
  dialogOpenFolder: ()        => ipcRenderer.invoke('dialog-open-folder'),
  dialogOpenFile:   (opts)    => ipcRenderer.invoke('dialog-open-file', opts),
  fsRead:           (p)       => ipcRenderer.invoke('fs-read', p),

  // Events
  on: (ch, cb) => {
    const ok = [
      'request-captured', 'response-captured', 'window-state',
      'open-devtools-for', 'tor-ip-changed',
      'ctx-action', 'download-started', 'download-done',
      'permission-denied-toast',
    ];
    if (!ok.includes(ch)) return;
    // ipcRenderer.on() needs the exact wrapper instance to unregister later —
    // removeListener(ch, cb) with the original cb is a no-op since cb was never
    // the listener Electron actually attached. Track wrapper-per-(cb,ch) so off() works.
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
