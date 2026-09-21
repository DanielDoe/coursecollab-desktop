import { config as loadEnv } from 'dotenv'
import { app, BrowserWindow, ipcMain, session, shell } from 'electron'
import { join } from 'node:path'
import {
  getAppOrigin,
  registerAppProtocol,
  registerAppScheme,
  usePackagedRenderer,
} from './app-protocol'
import { buildDesktopUserAgent, resolveInitialStartPath } from './constants'
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
import { applyNativeAppIcon, resolveAppIcon, resolveAppIconPath } from './icon-utils'
import { setDesktopWindowGetter } from './desktop-window'
import { installApplicationMenu } from './menu'
import { readLastDesktopRoute, writeLastDesktopRoute } from './last-route'
import { migrateLegacyElectronProfile, pinDesktopUserData } from './user-data'
import {
  attachSingleWindowNavigationPolicy,
  resolveViteDevServerUrl,
} from './navigation-policy'
import {
  forceExitAssessmentLockdown,
  isAssessmentLockdownActive,
  registerAssessmentLockdownIpc,
} from './assessment-lockdown'
import { scheduleWindowsShortcutRepair } from './windows-shortcut-repair'

loadEnv({ path: join(__dirname, '../.env') })

pinDesktopUserData()
registerAppScheme()
if (process.platform === 'win32') {
  app.setAppUserModelId('com.coursecollab.desktop')
}

setAppQuitting(false)

const gotSingleInstanceLock = app.requestSingleInstanceLock()
const viteDevServerUrl = resolveViteDevServerUrl()
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
  registerAssessmentLockdownIpc()

  ipcMain.handle('app:open-external', (_event, url: unknown) => {
    if (typeof url !== 'string') return { ok: false as const }
    const trimmed = url.trim()
    if (!trimmed) return { ok: false as const }
    if (!/^(https?:|mailto:|tel:)/i.test(trimmed)) return { ok: false as const }
    void shell.openExternal(trimmed)
    return { ok: true as const }
  })

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
    icon: resolveAppIconPath() ?? resolveAppIcon(),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      devTools: !app.isPackaged,
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
    if (isAssessmentLockdownActive() && !isAppQuitting()) {
      event.preventDefault()
      window.focus()
      return
    }
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

  const startPath = resolveInitialStartPath(readLastDesktopRoute, app.isPackaged)
  if (usePackagedRenderer()) {
    void contents.loadURL(`${getAppOrigin()}${startPath}`)
    return
  }

  void contents.loadURL(`${viteDevServerUrl}${startPath}`)
}

app.whenReady().then(async () => {
  if (!gotSingleInstanceLock) return

  migrateLegacyElectronProfile()

  app.on('web-contents-created', (_event, contents) => {
    attachSingleWindowNavigationPolicy(contents, viteDevServerUrl)
  })

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
  scheduleWindowsShortcutRepair()
  registerNotificationHandlers()
  loadNotificationPreferences()
  syncLaunchAtLoginPreference()
  createDesktopTray({ getMainWindow })
  // Only the first-run CodeBench wizard may use a second BrowserWindow. After it closes,
  // the main window is the sole in-app surface; navigation-policy blocks popups everywhere.
  if (shouldRunFirstRunSetup()) {
    await runFirstRunSetupWindow()
  }
  createWindow()
  if (app.isPackaged && isFirstRunSetupComplete()) {
    void ensureCppToolchain({ installIfMissing: true, mode: 'startup' })
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
  forceExitAssessmentLockdown()
  void shutdownCodebench()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    destroyDesktopTray()
    app.quit()
  }
})
