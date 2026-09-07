import { config as loadEnv } from 'dotenv'
import { app, BrowserWindow, ipcMain, session, shell } from 'electron'
import { join } from 'node:path'
import {
  getAppOrigin,
  registerAppProtocol,
  registerAppScheme,
  usePackagedRenderer,
} from './app-protocol'
import { buildDesktopUserAgent, resolveStartupPath } from './constants'
import { isAppQuitting, setAppQuitting } from './app-state'
import {
  setNotificationSyncContext,
  type NotificationSyncContext,
} from './background-sync'
import { registerNotificationHandlers, setMainWindow } from './notifications'
import { loadNotificationPreferences } from './preferences'
import { getOrCreateDesktopDeviceId, syncLaunchAtLoginPreference } from './push-registration'
import { createDesktopTray, destroyDesktopTray, shouldMinimizeToTrayOnClose } from './tray'
import { registerCodebenchIpc, shutdownCodebench, stopCodebenchForSender } from './ipc/codebench'
import { ensureCppToolchain } from './codebench/toolchain-ensure'
import {
  isFirstRunSetupComplete,
  registerFirstRunSetupIpc,
  runFirstRunSetupWindow,
  shouldRunFirstRunSetup,
} from './first-run-setup'
import { registerUpdater } from './updater'
import { applyNativeAppIcon, resolveAppIcon } from './icon-utils'
import { setDesktopWindowGetter } from './desktop-window'
import { installApplicationMenu } from './menu'
import { readLastDesktopRoute, writeLastDesktopRoute } from './last-route'
import { migrateLegacyElectronProfile, pinDesktopUserData } from './user-data'

loadEnv({ path: join(__dirname, '../.env') })

pinDesktopUserData()
registerAppScheme()
if (process.platform === 'win32') {
  app.setAppUserModelId('com.coursecollab.desktop')
}

setAppQuitting(false)

const gotSingleInstanceLock = app.requestSingleInstanceLock()
const viteDevServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173'
const startHidden = process.argv.includes('--hidden')

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const existing = BrowserWindow.getAllWindows()[0]
    if (!existing) {
      createWindow()
      return
    }
    if (existing.isMinimized()) existing.restore()
    existing.show()
    existing.focus()
  })
}

function registerIpcHandlers() {
  ipcMain.handle('app:get-version', () => app.getVersion())
  ipcMain.handle('app:get-course-collab-url', () =>
    usePackagedRenderer() ? getAppOrigin() : viteDevServerUrl,
  )
  ipcMain.handle('app:get-device-id', () => getOrCreateDesktopDeviceId())
  ipcMain.handle('app:set-last-route', (_event, path: unknown) => {
    return writeLastDesktopRoute(typeof path === 'string' ? path : '')
  })
  ipcMain.handle('app:get-last-route', () => readLastDesktopRoute())

  ipcMain.handle('notification:set-sync-context', (_event, context: NotificationSyncContext | null) => {
    setNotificationSyncContext(context)
    return { ok: true }
  })
}

function injectDesktopShellMarkers(webContents: Electron.WebContents) {
  void webContents.executeJavaScript(`
    (function () {
      window.__COURSE_COLLAB_DESKTOP__ = true;
      document.documentElement.dataset.desktopApp = 'true';
      document.body.classList.add('cc-desktop-app');
    })();
  `)
}

function isAllowedNavigation(url: string): boolean {
  if (url.startsWith(viteDevServerUrl)) return true
  if (url.startsWith(`${getAppOrigin()}/`) || url === getAppOrigin()) return true
  if (url.startsWith('file://')) return true
  return false
}

function getMainWindow(): BrowserWindow | null {
  return BrowserWindow.getAllWindows()[0] ?? null
}

function createWindow() {
  const userAgent = buildDesktopUserAgent(app.getVersion())

  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: '#f8f7fc',
    title: 'CourseCollab',
    icon: resolveAppIcon(),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: 'persist:coursecollab',
    },
  })

  window.once('ready-to-show', () => {
    if (startHidden) {
      window.hide()
      return
    }
    window.show()
  })
  setMainWindow(window)
  const contentsId = window.webContents.id
  window.webContents.on('destroyed', () => {
    stopCodebenchForSender(contentsId)
  })
  window.on('closed', () => setMainWindow(null))

  window.on('close', (event) => {
    if (isAppQuitting() || !shouldMinimizeToTrayOnClose()) return
    event.preventDefault()
    window.hide()
  })

  const contents = window.webContents
  contents.setUserAgent(userAgent)

  contents.on('did-finish-load', () => {
    injectDesktopShellMarkers(contents)
    if (process.env.CC_PACKAGED_PREVIEW === '1') {
      const inspectPreview = (label: string) =>
        contents
          .executeJavaScript(
            `JSON.stringify({
              href: location.href,
              root: document.getElementById('root')?.innerHTML?.length || 0,
              text: (document.body?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 280)
            })`,
          )
          .then((result) => {
            console.log(`[desktop-preview ${label}]`, result)
          })
          .catch((error) => {
            console.error('[desktop-preview] inspect failed', error)
          })
      void inspectPreview('load')
      setTimeout(() => {
        void inspectPreview('settled')
      }, 4000)
    }
  })
  contents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[desktop] failed to load', { errorCode, errorDescription, validatedURL })
  })

  contents.setWindowOpenHandler(({ url }) => {
    if (isAllowedNavigation(url)) return { action: 'allow' }
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  contents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url)) {
      event.preventDefault()
      void shell.openExternal(url)
    }
  })

  const startPath = readLastDesktopRoute() || resolveStartupPath()
  if (usePackagedRenderer()) {
    void contents.loadURL(`${getAppOrigin()}${startPath}`)
    return
  }

  void contents.loadURL(`${viteDevServerUrl}${startPath}`)
}

app.whenReady().then(async () => {
  if (!gotSingleInstanceLock) return

  migrateLegacyElectronProfile()

  const persistSession = session.fromPartition('persist:coursecollab')
  registerAppProtocol(persistSession)
  registerAppProtocol(session.defaultSession)
  const allowDesktopPermission = (_webContents: Electron.WebContents, permission: string, callback: (grant: boolean) => void) => {
    const allowed = new Set(['media', 'fullscreen', 'pointerLock', 'notifications'])
    callback(allowed.has(permission))
  }
  session.defaultSession.setPermissionRequestHandler(allowDesktopPermission)
  persistSession.setPermissionRequestHandler(allowDesktopPermission)

  applyNativeAppIcon()
  setDesktopWindowGetter(getMainWindow)
  installApplicationMenu()
  registerIpcHandlers()
  registerCodebenchIpc()
  registerFirstRunSetupIpc()
  registerUpdater()
  registerNotificationHandlers()
  loadNotificationPreferences()
  syncLaunchAtLoginPreference()
  createDesktopTray({ getMainWindow })
  if (shouldRunFirstRunSetup()) {
    await runFirstRunSetupWindow()
  }
  createWindow()
  if (app.isPackaged && isFirstRunSetupComplete()) {
    void ensureCppToolchain({ installIfMissing: true })
  }

  app.on('activate', () => {
    const existing = getMainWindow()
    if (existing) {
      existing.show()
      existing.focus()
      return
    }
    createWindow()
  })
})

app.on('before-quit', () => {
  setAppQuitting(true)
  void shutdownCodebench()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    destroyDesktopTray()
    app.quit()
  }
})
