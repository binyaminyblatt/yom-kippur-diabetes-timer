// Initialize System CA Trust Store immediately for SSL inspection filter support
require('./system-ca').initSystemCA();

const { app, BrowserWindow, powerSaveBlocker, Menu, ipcMain, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

// Disable pinch zoom and overscroll swipe navigation at Chromium level
app.commandLine.appendSwitch('disable-pinch');
app.commandLine.appendSwitch('overscroll-history-navigation', '0');

let mainWindow;
let powerBlockerId = null;
let serverInstance = null;
let activeServerPort = null;

async function startBackendServer() {
  try {
    const { startServer } = require('./server');
    // Use consistent port 3000 (or PORT env) across all runs so localStorage and cached state remain deterministic.
    // If 3000 is occupied, startServer automatically falls back gracefully.
    const targetPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    
    const result = await startServer(targetPort);
    serverInstance = result.server;
    activeServerPort = result.port;
    console.log(`[Electron] Connected to backend on port: ${activeServerPort}`);
    return activeServerPort;
  } catch (err) {
    console.error('[Electron] Failed to start internal server:', err);
    throw err;
  }
}

async function createWindow() {
  if (!activeServerPort) {
    await startBackendServer();
  }

  mainWindow = new BrowserWindow({
    width: 1300,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: '#090d16',
    title: 'Yom Kippur Diabetes Interval Timer & LibreLinkUp CGM',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false // IMPORTANT: Prevent background tab/window throttling over 25 hours
    },
    icon: path.join(__dirname, 'build', 'icon.png')
  });

  // Load the web app and clear session cache for live development
  mainWindow.webContents.session.clearCache().catch(() => {});
  mainWindow.loadURL(`http://localhost:${activeServerPort}`);

  // Prevent Escape key (press, hold, or repeat) from exiting fullscreen in Electron
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape' || input.code === 'Escape') {
      event.preventDefault();
    }
  });

  // Handle external link clicks (like GitHub repository and updates) in default browser
  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (details.url.startsWith('https:') || details.url.startsWith('http:')) {
      shell.openExternal(details.url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Prevent back/forward trackpad swipe navigation
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://localhost:${activeServerPort}`)) {
      event.preventDefault();
      if (url.startsWith('https:') || url.startsWith('http:')) {
        shell.openExternal(url);
      }
    }
  });

  mainWindow.on('leave-html-full-screen', () => {
    mainWindow.setFullScreen(true);
  });

  mainWindow.on('leave-full-screen', () => {
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setFullScreen(true);
      }
    }, 50);
  });

  // Cross-Platform Kiosk Mode IPC: When renderer locks, engage OS Kiosk mode (blocking macOS 3-finger swipe, Windows taskbars, Linux shortcuts)
  ipcMain.on('app:set-locked', (event, isLocked) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        if (isLocked) {
          mainWindow.setKiosk(true);
        } else {
          mainWindow.setKiosk(false);
          mainWindow.setFullScreen(true);
        }
        console.log(`[Electron] Lock Shield state changed: isLocked=${isLocked}, kiosk=${mainWindow.isKiosk()}`);
      } catch (e) {
        console.warn('[Electron] Failed to update kiosk/lock state:', e);
      }
    }
  });

  // Open external link in default browser from renderer
  ipcMain.on('app:open-external', (event, url) => {
    if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
      shell.openExternal(url);
    }
  });

  // Prevent display sleep over 25 hours
  try {
    powerBlockerId = powerSaveBlocker.start('prevent-display-sleep');
    console.log('Power save blocker activated. Screen will stay awake.');
  } catch (e) {
    console.warn('Could not activate powerSaveBlocker:', e);
  }

  // Create a minimal menu for convenience
  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Quit Yom Kippur Timer',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates...',
          click: async () => {
            const customUrl = process.env.UPDATE_URL || process.env.AUTO_UPDATE_URL;
            if (!app.isPackaged && !customUrl) {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Check for Updates',
                message: 'Auto-updates are disabled in development mode.',
                detail: 'Run in a packaged production build or set UPDATE_URL (e.g. UPDATE_URL=./dist) to test locally.'
              });
              return;
            }
            try {
              const res = await autoUpdater.checkForUpdates();
              if (!res || !res.downloadPromise) {
                dialog.showMessageBox(mainWindow, {
                  type: 'info',
                  title: 'Yom Kippur Diabetes Timer',
                  message: 'You are using the latest version.',
                  detail: `Current version: v${app.getVersion()}`
                });
              }
            } catch (e) {
              dialog.showMessageBox(mainWindow, {
                type: 'warning',
                title: 'Update Check Failed',
                message: 'Unable to check for updates at this time.',
                detail: e.message
              });
            }
          }
        },
        { type: 'separator' },
        {
          label: 'About Yom Kippur Diabetes Timer',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Yom Kippur Diabetes Timer',
              message: 'Yom Kippur Diabetes Eating Interval & LibreLinkUp CGM Timer',
              detail: `Version: v${app.getVersion()}\nDesigned for Achila l'Shiurim with dual-staggered airplane chimes, auto-silencing alarms, and live CGM monitoring.`
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const customUpdateUrl = process.env.UPDATE_URL || process.env.AUTO_UPDATE_URL;

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Configure custom update URL / local path override if set in environment
  if (customUpdateUrl) {
    let feedUrl = customUpdateUrl.trim();
    if (!feedUrl.startsWith('http://') && !feedUrl.startsWith('https://')) {
      const port = activeServerPort || (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);
      feedUrl = `http://localhost:${port}/__local_update_feed`;
    }
    console.log(`[AutoUpdater] Overriding update feed URL with: ${feedUrl}`);

    if (!app.isPackaged) {
      try {
        const devConfigPath = path.join(__dirname, 'dev-app-update.yml');
        fs.writeFileSync(devConfigPath, `provider: generic\nurl: ${feedUrl}\n`, 'utf8');
      } catch (e) {
        console.warn('[AutoUpdater] Failed to write dev-app-update.yml:', e.message);
      }

      if (process.platform === 'linux' && !process.env.APPIMAGE) {
        const dummyAppImage = path.join(__dirname, 'dist', 'test-feed', 'Yom-Kippur-Diabetes-Timer-1.0.5.AppImage');
        if (fs.existsSync(dummyAppImage)) {
          process.env.APPIMAGE = dummyAppImage;
        }
      }
    }

    try {
      autoUpdater.setFeedURL({
        provider: 'generic',
        url: feedUrl
      });
      autoUpdater.forceDevUpdateConfig = true;
    } catch (err) {
      console.warn('[AutoUpdater] Failed to set custom feed URL:', err.message);
    }
  }

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for update...');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', { status: 'checking' });
    }
  });

  autoUpdater.on('update-available', (info) => {
    console.log(`[AutoUpdater] Update available: v${info.version}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', {
        status: 'available',
        version: info.version,
        releaseDate: info.releaseDate
      });
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[AutoUpdater] App is up to date.');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', { status: 'not-available' });
    }
  });

  autoUpdater.on('error', (err) => {
    console.warn('[AutoUpdater] Error during update check:', err?.message || err);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', {
        status: 'error',
        error: err?.message || 'Unknown error checking for updates'
      });
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', {
        status: 'downloading',
        percent: Math.round(progressObj.percent)
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log(`[AutoUpdater] Update downloaded: v${info.version}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', {
        status: 'downloaded',
        version: info.version
      });
    }
  });

  // Check on startup if packaged or if custom update URL is provided for testing
  if (app.isPackaged || customUpdateUrl) {
    autoUpdater.checkForUpdates().then((res) => {
      if (res && res.downloadPromise) {
        res.downloadPromise.catch((err) => {
          console.warn('[AutoUpdater] Download note:', err?.message || err);
        });
      }
    }).catch((err) => {
      console.warn('[AutoUpdater] Initial check note:', err?.message || err);
    });
  }
}

// IPC Handlers for Updater
ipcMain.handle('app:check-for-updates', async () => {
  if (!app.isPackaged && !customUpdateUrl) {
    return { status: 'dev-mode', message: 'Auto-updates are only available in packaged builds or when UPDATE_URL is set.' };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    if (result && result.downloadPromise) {
      result.downloadPromise.catch((err) => {
        console.warn('[AutoUpdater] Check download note:', err?.message || err);
      });
    }
    return { status: 'ok', updateInfo: result?.updateInfo };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
});

ipcMain.on('app:install-update', () => {
  autoUpdater.quitAndInstall();
});

app.whenReady().then(async () => {
  await createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (powerBlockerId !== null && powerSaveBlocker.isStarted(powerBlockerId)) {
    powerSaveBlocker.stop(powerBlockerId);
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (serverInstance && serverInstance.close) {
    serverInstance.close();
  }
});

