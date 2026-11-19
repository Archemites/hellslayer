const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  quit: () => ipcRenderer.send('app:quit'),
  savePreviewVideo: (name, data) => ipcRenderer.invoke('videos:save', name, data),
  savePreviewImage: (name, data) => ipcRenderer.invoke('previews:save', name, data)
});
