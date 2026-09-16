const { contextBridge, ipcRenderer } = require('electron');
const pkg = require('./package.json');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  isDev: process.env.DEV_MODE === 'true',
  version: pkg.version,
  updateUrl: process.env.UPDATE_URL || process.env.AUTO_UPDATE_URL || null,
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
  },
  checkForUpdates: () => {
    try {
      return ipcRenderer.invoke('app:check-for-updates');
    } catch (e) {
      console.warn('Failed to check for updates:', e);
    }
  },
  installUpdate: () => {
    try {
      ipcRenderer.send('app:install-update');
    } catch (e) {
      console.warn('Failed to trigger update installation:', e);
    }
  },
  onUpdateStatus: (callback) => {
    if (typeof callback === 'function') {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('updater:status', handler);
      return () => ipcRenderer.removeListener('updater:status', handler);
    }
  }
});

