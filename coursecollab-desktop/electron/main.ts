import { app, BrowserWindow, ipcMain, session } from 'electron'
import { join } from 'node:path'

const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL)

function registerIpcHandlers() {
  ipcMain.handle('app:get-version', () => app.getVersion())
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: '#f8f7fc',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  window.once('ready-to-show', () => window.show())

  if (isDevelopment) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL as string)
  } else {
    void window.loadFile(join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
