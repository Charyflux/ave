const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ave', {
  // Window controls
  minimize:      () => ipcRenderer.invoke('window-minimize'),
  maximize:      () => ipcRenderer.invoke('window-maximize'),
  close:         () => ipcRenderer.invoke('window-close'),
  isMaximized:   () => ipcRenderer.invoke('window-is-max'),

  // Capture
  getCaptures:   () => ipcRenderer.invoke('get-captures'),
  clearCaptures: () => ipcRenderer.invoke('clear-captures'),
  toggleCapture: (v) => ipcRenderer.invoke('toggle-capture', v),

  // AveOne integration
  openAveOne:    () => ipcRenderer.invoke('open-aveone'),
  sendToAveOne:  (data) => ipcRenderer.invoke('send-to-aveone', data),
  openExternal:  (url) => ipcRenderer.invoke('open-external', url),

  // Events (renderer listens to main)
  on: (channel, cb) => {
    const allowed = ['request-captured','response-captured','window-state','open-devtools-for'];
    if (allowed.includes(channel)) ipcRenderer.on(channel, (_, ...args) => cb(...args));
  },
  off: (channel, cb) => ipcRenderer.removeListener(channel, cb),
});
