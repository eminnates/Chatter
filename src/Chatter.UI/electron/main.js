const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;

let mainWindow = null;
let tray = null;

function createWindow() {
  // Determine icon path based on environment
  const iconPath = isDev 
    ? path.join(__dirname, '../public/icon.png')
    : path.join(process.resourcesPath, 'public/icon.png');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    show: false, // Don't show until ready
  });

  // Show window when ready to prevent flickering
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    // GELİŞTİRME MODU: Vite sunucusunu yükle
    mainWindow.loadURL('http://localhost:5173');
    // Opsiyonel: DevTools'u otomatik aç
    mainWindow.webContents.openDevTools();
  } else {
    // PRODUCTION MODU: Paketlenen index.html dosyasını yükle
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Prevent window from closing, minimize to tray instead
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      
      // Show notification on first minimize
      if (!mainWindow.minimizedOnce) {
        mainWindow.minimizedOnce = true;
        // Optional: Show system notification that app is still running
      }
    }
  });

  // Minimize to tray on minimize event
  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });
}

function createTray() {
  // Create tray icon
  const iconPath = path.join(__dirname, '../public/icon-tray.png');
  let trayIcon;
  
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      // Fallback: create a simple colored square if icon not found
      trayIcon = nativeImage.createEmpty();
    }
  } catch (err) {
    console.log('Tray icon not found, using empty icon');
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Chatter - Running in background');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Chatter',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    {
      label: 'Hide',
      click: () => {
        if (mainWindow) {
          mainWindow.hide();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  // Show/hide window on tray icon click
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createWindow();
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

// Keep app running in background
app.on('window-all-closed', (event) => {
  // Prevent app from quitting - keep running in background
  event.preventDefault();
});

// Handle app quit
app.on('before-quit', () => {
  app.isQuitting = true;
});