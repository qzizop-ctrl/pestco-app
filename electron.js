const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow;

// Checks GitHub Releases (configured via the "publish" block in
// package.json) for a newer version than the one currently installed.
// Only meaningful for a packaged build published with
// "electron-builder --publish always" — see the "Build Windows installer"
// step in .github/workflows/build-windows.yml, which only runs on a tag
// push (e.g. v1.0.1). Silently does nothing during local/dev runs.
function initAutoUpdate() {
  if (!app.isPackaged) return;

  autoUpdater.on('update-downloaded', () => {
    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: 'تحديث جاهز',
        message: 'في نسخة أحدث من التطبيق اتحمّلت. تحب تعيد التشغيل دلوقتي عشان تتظبط؟',
        buttons: ['إعادة التشغيل الآن', 'لاحقًا'],
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-update check failed:', err);
  });

  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, 'build', 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Remove the default menu bar (File/Edit/View...) for a cleaner app look
  Menu.setApplicationMenu(null);

  // Load the built web app (output of "npm run build")
  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  initAutoUpdate();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
