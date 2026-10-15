// Renderer'a açılan güvenli API yüzeyi.
const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (callback) => {
  const handler = (_e, payload) => callback(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

contextBridge.exposeInMainWorld('hub', {
  listCatalog: () => ipcRenderer.invoke('catalog:list'),
  refreshCatalog: () => ipcRenderer.invoke('catalog:refresh'),
  listReleases: (fullName) => ipcRenderer.invoke('releases:list', fullName),
  getReadme: (fullName) => ipcRenderer.invoke('readme:get', fullName),
  startDownload: (payload) => ipcRenderer.invoke('download:start', payload),
  pickFolder: () => ipcRenderer.invoke('download:pickFolder'),
  open: (p) => ipcRenderer.invoke('shell:open', p),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  listInstalled: () => ipcRenderer.invoke('installed:list'),
  removeInstalled: (fullName) => ipcRenderer.invoke('installed:remove', fullName),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  checkUpdates: () => ipcRenderer.invoke('updates:check'),
  appInfo: () => ipcRenderer.invoke('app:info'),
  minimize: () => ipcRenderer.send('win:minimize'),
  close: () => ipcRenderer.send('win:close'),
  onDownloadProgress: on('download:progress'),
  onDownloadDone: on('download:done'),
  onDownloadError: on('download:error'),
  onUpdateNotification: on('update-notification'),
});
