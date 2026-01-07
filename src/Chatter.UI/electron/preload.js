const { contextBridge, ipcRenderer } = require('electron');

// Güvenli API'yi expose et
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  
  // Window Controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  
  // Maximize durumunu dinle
  onMaximizeChange: (callback) => {
    ipcRenderer.on('window-maximized', () => callback(true));
    ipcRenderer.on('window-unmaximized', () => callback(false));
  }
});