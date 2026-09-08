const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  isDev: process.env.DEV_MODE === 'true',
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

