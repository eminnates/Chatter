const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater'); // EKLENDİ
const log = require('electron-log'); // EKLENDİ

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
    frame: false, // Çerçeve yok
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'), // Preload yolu
      sandbox: false
    },
    show: false,
    backgroundColor: '#1a1d2e',
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // EKLENDİ: Uygulama açılınca güncelleme kontrolü yap (Sadece Prod modunda)
    if (!isDev) {
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
  
  // Pencere boyutlandığında React'e haber ver
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized');
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-unmaximized');
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

// --- IPC HANDLERS (Pencere Kontrolleri) ---

ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

// --- AUTO UPDATER EVENTS (EKLENDİ) ---

// 1. Güncelleme kontrolü başladı
autoUpdater.on('checking-for-update', () => {
  log.info('Checking for update...');
});

// 2. Güncelleme bulundu -> Kullanıcıya sor
autoUpdater.on('update-available', (info) => {
  log.info('Update available.');
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Available',
    message: `A new version (${info.version}) is available. Do you want to download it now?`,
    buttons: ['Yes', 'No']
  }).then((result) => {
    if (result.response === 0) { // 'Yes' seçilirse
      autoUpdater.downloadUpdate();
    }
  });
});

// 3. Güncelleme yok
autoUpdater.on('update-not-available', () => {
  log.info('Update not available.');
});

// 4. Hata oluştu
autoUpdater.on('error', (err) => {
  log.error('Error in auto-updater. ' + err);
});

// 5. İndirme ilerlemesi (Loglara yazar)
autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log.info(log_message);
});

// 6. İndirme bitti -> Yükle ve Yeniden Başlat
autoUpdater.on('update-downloaded', () => {
  log.info('Update downloaded');
  dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'Install Update',
    message: 'Update downloaded. The application will restart to install updates.',
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
    { label: 'Check for Updates', click: () => autoUpdater.checkForUpdates() }, // Manuel kontrol menüsü
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