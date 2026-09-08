const { contextBridge, ipcRenderer } = require('electron');
const pkg = require('./package.json');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  isDev: process.env.DEV_MODE === 'true',
  version: pkg.version,
  setLocked: (isLocked) => {
    try {
      ipcRenderer.send('app:set-locked', !!isLocked);
    } catch (e) {
      console.warn('Failed to send lock state to main process:', e);
    }
  },
  openExternal: (url) => {
    try {
      ipcRenderer.send('app:open-external', url);
    } catch (e) {
      console.warn('Failed to open external URL:', e);
    }
  }
});

