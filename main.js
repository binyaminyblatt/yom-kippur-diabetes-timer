// Initialize System CA Trust Store immediately for SSL inspection filter support
require('./system-ca').initSystemCA();

const { app, BrowserWindow, powerSaveBlocker, Menu, ipcMain, shell } = require('electron');
const path = require('path');

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
          label: 'About Yom Kippur Diabetes Timer',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Yom Kippur Diabetes Timer',
              message: 'Yom Kippur Diabetes Eating Interval & LibreLinkUp CGM Timer',
              detail: 'Designed for Achila l\'Shiurim with dual-staggered airplane chimes, auto-silencing alarms, and live CGM monitoring.'
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

app.whenReady().then(async () => {
  await createWindow();

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
