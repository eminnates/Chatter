const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = !app.isPackaged; // Uygulamanın paketlenip paketlenmediğini kontrol eder

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  if (isDev) {
    // GELİŞTİRME MODU: Vite sunucusunu yükle
    win.loadURL('http://localhost:5173');
    // Opsiyonel: DevTools'u otomatik aç
    win.webContents.openDevTools();
  } else {
    // PRODUCTION MODU: Paketlenen index.html dosyasını yükle
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});