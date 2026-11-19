const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const RECORD_PREVIEWS = process.argv.includes('--record-previews');
const CAPTURE_PREVIEWS = process.argv.includes('--capture-previews');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// Otimizações de GPU, V8 Heap e compositing para rodar liso sem engasgos de GC
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-oop-rasterization');
app.commandLine.appendSwitch('renderer-process-limit', '2');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=2048');
app.commandLine.appendSwitch('disable-features', 'MediaRouter,Translate,CalculateNativeWinOcclusion, SpareRendererForSitePerProcess');

let mainWindow = null;

const gotLock = (CAPTURE_PREVIEWS || RECORD_PREVIEWS) ? true : app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else if (!CAPTURE_PREVIEWS && !RECORD_PREVIEWS) {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  // Remove o menu padrão do Electron para desativar aceleradores como Ctrl+W, Ctrl+R, etc.
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    title: 'PARAINFERNÁLIA — Beta 1',
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  const query = {};
  if (RECORD_PREVIEWS) query.recordPreviews = '1';
  if (CAPTURE_PREVIEWS) query.capturePreviews = '1';
  mainWindow.loadFile(
    path.join(__dirname, '..', 'index.html'),
    Object.keys(query).length ? { query } : undefined
  );

  if (CAPTURE_PREVIEWS) {
    mainWindow.webContents.on('console-message', (_e, _lvl, msg) => {
      console.log('[renderer]', msg);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('videos:save', async (_ev, name, data) => {
  const safe = String(name || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safe) return false;
  const outDir = path.join(__dirname, '..', 'assets', 'videos');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, safe + '.webm');
  fs.writeFileSync(outPath, Buffer.from(data));
  return outPath;
});

ipcMain.handle('previews:save', async (_ev, name, data) => {
  const safe = String(name || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safe) return false;
  const outDir = path.join(__dirname, '..', 'assets', 'previews');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, safe + '.jpg');
  fs.writeFileSync(outPath, Buffer.from(data));
  return outPath;
});

ipcMain.on('app:quit', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
  }
  app.quit();
});

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
