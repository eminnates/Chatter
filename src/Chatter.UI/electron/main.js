const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// --- AUTO UPDATER AYARLARI ---
log.transports.file.level = 'info';
autoUpdater.logger = log;
autoUpdater.autoDownload = false; // Kullanıcıya sormadan indirmesin

// Windows için App ID
if (process.platform === 'win32') {
  app.setAppUserModelId('com.chatter.app');
}

const isDev = !app.isPackaged;

let mainWindow = null;
let tray = null;
let manualCheck = false; // Manuel kontrol yapılıp yapılmadığını anlamak için bayrak

function createWindow() {
  let iconPath;
  if (isDev) {
    iconPath = path.join(__dirname, '../public/icon.png');
  } else {
    iconPath = path.join(__dirname, '../dist/icon.png');
  }
  
  const appIcon = nativeImage.createFromPath(iconPath);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 400,
    minHeight: 500,
    icon: appIcon,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false
    },
    show: false,
    backgroundColor: '#1a1d2e',
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Uygulama açılınca sessizce kontrol et (Kullanıcıyı rahatsız etme)
    if (!isDev) {
      manualCheck = false; 
      autoUpdater.checkForUpdates();
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // --- WINDOW EVENTS ---
  mainWindow.on('maximize', () => mainWindow.webContents.send('window-maximized'));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window-unmaximized'));
  
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

// --- IPC HANDLERS ---
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  }
});
ipcMain.on('window-close', () => mainWindow?.close());

// --- AUTO UPDATER EVENTS (GÜNCELLENDİ) ---

autoUpdater.on('checking-for-update', () => {
  log.info('Checking for update...');
});

// GÜNCELLEME VARSA (Her zaman sor)
autoUpdater.on('update-available', (info) => {
  log.info('Update available.');
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Available',
    message: `A new version (${info.version}) is available. Do you want to download it now?`,
    buttons: ['Yes', 'No']
  }).then((result) => {
    if (result.response === 0) { // Yes
      autoUpdater.downloadUpdate();
    }
  });
});

// GÜNCELLEME YOKSA (Sadece manuel kontrolde kutu çıkar)
autoUpdater.on('update-not-available', () => {
  log.info('Update not available.');
  if (manualCheck) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'No Updates',
      message: 'Current version is up-to-date.',
      buttons: ['OK']
    });
    manualCheck = false; // Bayrağı sıfırla
  }
});

// HATA VARSA (Her zaman göster ki anlayalım)
autoUpdater.on('error', (err) => {
  log.error('Error in auto-updater. ' + err);
  dialog.showMessageBox(mainWindow, {
    type: 'error',
    title: 'Update Error',
    message: 'An error occurred while checking for updates.\n\n' + (err.message || err),
    buttons: ['OK']
  });
});

autoUpdater.on('download-progress', (progressObj) => {
  log.info(`Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`);
});

autoUpdater.on('update-downloaded', () => {
  log.info('Update downloaded');
  dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'Install Update',
    message: 'Update downloaded. Restart to install?',
    buttons: ['Restart Now', 'Later']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall(false, true);
    }
  });
});

// --- TRAY LOGIC ---
function createTray() {
  const iconPath = isDev 
    ? path.join(__dirname, '../public/icon-tray.png')
    : path.join(__dirname, '../dist/icon-tray.png');
  
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) trayIcon = nativeImage.createEmpty();
  } catch (err) {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Chatter');
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show', click: () => mainWindow.show() },
    { 
      label: 'Check for Updates', 
      click: () => {
        manualCheck = true; // Manuel kontrol olduğunu belirtiyoruz
        autoUpdater.checkForUpdates();
      } 
    },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => mainWindow.show());
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
});