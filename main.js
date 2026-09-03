// Initialize System CA Trust Store immediately for SSL inspection filter support
require('./system-ca').initSystemCA();

const { app, BrowserWindow, powerSaveBlocker, Menu } = require('electron');
const path = require('path');

let mainWindow;
let powerBlockerId = null;
let serverInstance = null;
let activeServerPort = null;

async function startBackendServer() {
  try {
    const { startServer } = require('./server');
    // Only attempt fixed port 3000 if explicitly in DEV_MODE; otherwise allocate an ephemeral random free port (0)
    const isDev = !app.isPackaged && process.env.DEV_MODE === 'true';
    const targetPort = isDev ? (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000) : 0;
    
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
