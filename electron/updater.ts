import { Notification, app, ipcMain, BrowserWindow, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { setAppQuitting } from './app-state'

export const UPDATE_STATUS_CHANNEL = 'update:status'

export type DesktopUpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'ready'
  | 'error'

export type DesktopUpdateStatus = {
  state: DesktopUpdateState
  supported: boolean
  currentVersion: string
  version?: string
  releaseNotes?: string
  percent?: number
  message?: string
}

/** After the main window loads — early enough to prompt on launch, late enough for React to subscribe. */
const STARTUP_CHECK_DELAY_MS = 2_500
const INSTALL_EXIT_FALLBACK_MS = 2_500

/** Public Blob feed — works even when the GitHub repo is private. */
const DEFAULT_GENERIC_UPDATE_FEED_URL =
  'https://bzxrpdwd2b7njknk.public.blob.vercel-storage.com/public/downloads/desktop/updates'

const MANUAL_DOWNLOAD_URL =
  process.env.DESKTOP_DOWNLOAD_PAGE_URL?.trim() ||
  'https://github.com/DanielDoe/coursecollab-desktop/releases/latest'

let status: DesktopUpdateStatus = {
  state: 'idle',
  supported: false,
  currentVersion: '0.0.0',
}
let lastCheckUserInitiated = false
let statusListener: (() => void) | null = null
let installInFlight = false
const updateWaiters = new Set<() => void>()

function broadcastStatus(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue
    window.webContents.send(UPDATE_STATUS_CHANNEL, status)
  }
  statusListener?.()
  for (const waiter of updateWaiters) waiter()
}

export function onDesktopUpdateStatusChange(listener: (() => void) | null): void {
  statusListener = listener
}

function setStatus(patch: Partial<DesktopUpdateStatus>): DesktopUpdateStatus {
  status = {
    ...status,
    ...patch,
    currentVersion: patch.currentVersion ?? status.currentVersion,
    supported: patch.supported ?? status.supported,
  }
  broadcastStatus()
  return status
}

function releaseNotesText(
  notes: string | Array<{ note: string | null }> | null | undefined,
): string | undefined {
  if (typeof notes === 'string' && notes.trim()) return notes.trim()
  if (!Array.isArray(notes)) return undefined
  const joined = notes
    .map((item) => item.note?.trim())
    .filter((note): note is string => Boolean(note))
    .join('\n')
  return joined || undefined
}

function configureFeed(): void {
  const genericUrl = process.env.DESKTOP_UPDATE_FEED_URL?.trim() || DEFAULT_GENERIC_UPDATE_FEED_URL
  autoUpdater.setFeedURL({ provider: 'generic', url: genericUrl.replace(/\/+$/, '') })
}

function notifyUpdateAvailable(version: string): void {
  if (!Notification.isSupported()) return
  const notification = new Notification({
    title: 'CourseCollab update available',
    body: `Version ${version} is ready to download.`,
  })
  notification.show()
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? '')
}

function isInstallSignatureError(text: string): boolean {
  return /code signature|codesign|TeamIdentifier|not signed|signature.*invalid|EXDEV|Cannot update while running on a read-only volume|Squirrel/i.test(
    text,
  )
}

function friendlyUpdateError(
  error: unknown,
  context: 'check' | 'download' | 'install' = 'check',
): string {
  const text = errorText(error)
  if (/\b404\b/.test(text) || /ENOTFOUND|ECONNREFUSED|net::/i.test(text)) {
    return 'Could not reach the update server. Check your connection and try again.'
  }
  if (context === 'install' || isInstallSignatureError(text)) {
    return 'Automatic install failed. Download the latest installer from GitHub Releases and replace the app in Applications.'
  }
  if (context === 'download') {
    return 'Could not download the update. Try again, or install manually from GitHub Releases.'
  }
  return 'Could not check for updates. Try again later.'
}

function applyUpdateFailure(
  error: unknown,
  context: 'check' | 'download' | 'install' = 'check',
): DesktopUpdateStatus {
  installInFlight = false
  return setStatus({
    state: 'error',
    message: friendlyUpdateError(error, context),
    // Keep version so the UI can offer manual download after a failed install.
    version: status.version,
  })
}

function teardownBeforeInstall(): void {
  try {
    // Lazy require avoids a circular import with tray.ts (tray imports updater).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tray = require('./tray') as typeof import('./tray')
    tray.destroyDesktopTray()
  } catch {
    // ignore
  }

  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue
    // Prevent "minimize to tray" from canceling quitAndInstall.
    window.removeAllListeners('close')
  }
}

async function checkForUpdates(userInitiated: boolean): Promise<DesktopUpdateStatus> {
  if (!status.supported) {
    return setStatus({
      state: 'error',
      message: 'Over-the-air updates are available after installing a packaged CourseCollab build.',
    })
  }

  if (status.state === 'checking' || status.state === 'downloading' || installInFlight) {
    return status
  }

  lastCheckUserInitiated = userInitiated
  setStatus({ state: 'checking', message: undefined, version: undefined, percent: undefined })

  try {
    await autoUpdater.checkForUpdates()
    return status
  } catch (error) {
    return applyUpdateFailure(error, 'check')
  }
}

function waitForUpdateState(
  states: DesktopUpdateState[],
  timeoutMs: number,
): Promise<DesktopUpdateStatus> {
  if (states.includes(status.state)) return Promise.resolve(status)

  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      updateWaiters.delete(onChange)
      resolve(status)
    }
    const onChange = () => {
      if (states.includes(status.state)) finish()
    }
    updateWaiters.add(onChange)
    setTimeout(finish, timeoutMs)
  })
}

async function downloadUpdate(): Promise<DesktopUpdateStatus> {
  if (!status.supported) {
    return setStatus({
      state: 'error',
      message: 'Over-the-air updates are available after installing a packaged CourseCollab build.',
    })
  }

  if (status.state === 'ready') return status
  if (status.state === 'downloading' || installInFlight) return status

  setStatus({ state: 'downloading', percent: status.percent ?? 0, message: undefined })

  try {
    await autoUpdater.downloadUpdate()
    // macOS needs Squirrel.Mac to finish fetching through the local proxy before state is "ready".
    const settled = await waitForUpdateState(['ready', 'error'], 120_000)
    return settled
  } catch (error) {
    return applyUpdateFailure(error, 'download')
  }
}

function installUpdate(): DesktopUpdateStatus {
  if (!status.supported || status.state !== 'ready') {
    return setStatus({
      state: 'error',
      message: 'No downloaded update is ready to install yet.',
      version: status.version,
    })
  }

  if (installInFlight) return status

  installInFlight = true
  setStatus({
    state: 'ready',
    message: 'Restarting to install the update…',
    version: status.version,
    percent: 100,
  })
  setAppQuitting(true)
  teardownBeforeInstall()

  setImmediate(() => {
    try {
      autoUpdater.quitAndInstall(false, true)
    } catch (error) {
      applyUpdateFailure(error, 'install')
      return
    }

    // macOS + tray apps can keep the process alive after quitAndInstall.
    // autoInstallOnAppQuit is enabled, so a hard exit still applies the update.
    setTimeout(() => {
      if (!installInFlight) return
      try {
        app.exit(0)
      } catch {
        process.exit(0)
      }
    }, INSTALL_EXIT_FALLBACK_MS)
  })

  return status
}

async function openManualDownloadPage(): Promise<{ ok: boolean }> {
  try {
    await shell.openExternal(MANUAL_DOWNLOAD_URL)
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

export function getUpdateStatus(): DesktopUpdateStatus {
  return status
}

export function requestManualUpdateCheck(): Promise<DesktopUpdateStatus> {
  return checkForUpdates(true)
}

export function requestDownloadUpdate(): Promise<DesktopUpdateStatus> {
  return downloadUpdate()
}

export function requestInstallDownloadedUpdate(): DesktopUpdateStatus {
  return installUpdate()
}

export function registerUpdater(): void {
  status = {
    state: 'idle',
    supported: app.isPackaged,
    currentVersion: app.getVersion(),
  }

  ipcMain.handle('update:get-status', () => status)
  ipcMain.handle('update:check', () => checkForUpdates(true))
  ipcMain.handle('update:download', () => downloadUpdate())
  ipcMain.handle('update:install', () => installUpdate())
  ipcMain.handle('update:open-download-page', () => openManualDownloadPage())

  if (!app.isPackaged) return

  configureFeed()
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowDowngrade = false

  autoUpdater.on('checking-for-update', () => {
    if (installInFlight) return
    // Never wipe a downloaded update or an in-flight download with a fresh "checking" state.
    if (status.state === 'ready' || status.state === 'downloading') return
    setStatus({ state: 'checking', message: undefined })
  })

  autoUpdater.on('update-available', (info) => {
    if (installInFlight) return
    // Keep Install ready if this version is already downloaded.
    if (status.state === 'ready' && status.version === info.version) return
    if (status.state === 'downloading' && status.version === info.version) return
    const alreadyKnown = status.state === 'available' && status.version === info.version
    setStatus({
      state: 'available',
      version: info.version,
      releaseNotes: releaseNotesText(info.releaseNotes),
      message: `Version ${info.version} is available.`,
    })
    if (!alreadyKnown && !lastCheckUserInitiated) notifyUpdateAvailable(info.version)
  })

  autoUpdater.on('update-not-available', (info) => {
    if (installInFlight) return
    setStatus({
      state: 'not-available',
      version: info.version,
      message: `You're on the latest version (${status.currentVersion}).`,
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    if (installInFlight) return
    setStatus({
      state: 'downloading',
      percent: Math.max(0, Math.min(100, Math.round(progress.percent))),
      message: undefined,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    installInFlight = false
    setStatus({
      state: 'ready',
      version: info.version,
      releaseNotes: releaseNotesText(info.releaseNotes),
      percent: 100,
      message: `Version ${info.version} is ready to install.`,
    })
  })

  autoUpdater.on('error', (error) => {
    const context =
      installInFlight || status.state === 'ready'
        ? 'install'
        : status.state === 'downloading'
          ? 'download'
          : 'check'
    applyUpdateFailure(error, context)
  })

  setTimeout(() => {
    void checkForUpdates(false)
  }, STARTUP_CHECK_DELAY_MS)
}
