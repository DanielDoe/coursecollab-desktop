import { Notification, app, ipcMain, BrowserWindow } from 'electron'
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

const GITHUB_OWNER = 'DanielDoe'
const GITHUB_REPO = 'coursecollab-desktop'
const STARTUP_CHECK_DELAY_MS = 8_000

let status: DesktopUpdateStatus = {
  state: 'idle',
  supported: false,
  currentVersion: '0.0.0',
}
let lastCheckUserInitiated = false
let statusListener: (() => void) | null = null

function broadcastStatus(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue
    window.webContents.send(UPDATE_STATUS_CHANNEL, status)
  }
  statusListener?.()
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

function releaseNotesText(notes: string | Array<{ note: string | null }> | null | undefined): string | undefined {
  if (typeof notes === 'string' && notes.trim()) return notes.trim()
  if (!Array.isArray(notes)) return undefined
  const joined = notes
    .map((item) => item.note?.trim())
    .filter((note): note is string => Boolean(note))
    .join('\n')
  return joined || undefined
}

function configureFeed(): void {
  const genericUrl = process.env.DESKTOP_UPDATE_FEED_URL?.trim()
  if (genericUrl) {
    autoUpdater.setFeedURL({ provider: 'generic', url: genericUrl.replace(/\/+$/, '') })
    return
  }

  autoUpdater.setFeedURL({
    provider: 'github',
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
  })
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

/** No GitHub Releases yet (or a private repo without a token) — not a user-facing failure. */
function isMissingReleaseFeed(error: unknown): boolean {
  const text = errorText(error)
  if (!/\b404\b/.test(text)) return false
  return /releases\.atom|github\.com|authentication token/i.test(text)
}

function friendlyUpdateError(error: unknown): string {
  if (isMissingReleaseFeed(error)) {
    return `You're on the latest version (${status.currentVersion}).`
  }
  return 'Could not check for updates. Try again later.'
}

function applyUpdateFailure(error: unknown): DesktopUpdateStatus {
  if (isMissingReleaseFeed(error)) {
    return setStatus({
      state: 'not-available',
      message: friendlyUpdateError(error),
      version: undefined,
      percent: undefined,
    })
  }
  return setStatus({
    state: 'error',
    message: friendlyUpdateError(error),
  })
}

async function checkForUpdates(userInitiated: boolean): Promise<DesktopUpdateStatus> {
  if (!status.supported) {
    return setStatus({
      state: 'error',
      message: 'Over-the-air updates are available after installing a packaged CourseCollab build.',
    })
  }

  if (status.state === 'checking' || status.state === 'downloading') {
    return status
  }

  lastCheckUserInitiated = userInitiated
  setStatus({ state: 'checking', message: undefined, version: undefined, percent: undefined })

  try {
    await autoUpdater.checkForUpdates()
    return status
  } catch (error) {
    return applyUpdateFailure(error)
  }
}

async function downloadUpdate(): Promise<DesktopUpdateStatus> {
  if (!status.supported) {
    return setStatus({
      state: 'error',
      message: 'Over-the-air updates are available after installing a packaged CourseCollab build.',
    })
  }

  if (status.state === 'ready') return status
  if (status.state === 'downloading') return status

  setStatus({ state: 'downloading', percent: status.percent ?? 0, message: undefined })

  try {
    await autoUpdater.downloadUpdate()
    return status
  } catch (error) {
    return applyUpdateFailure(error)
  }
}

function installUpdate(): DesktopUpdateStatus {
  if (!status.supported || status.state !== 'ready') {
    return setStatus({
      state: 'error',
      message: 'No downloaded update is ready to install yet.',
    })
  }

  setAppQuitting(true)
  autoUpdater.quitAndInstall(false, true)
  return status
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

  if (!app.isPackaged) return

  configureFeed()
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowDowngrade = false

  autoUpdater.on('checking-for-update', () => {
    setStatus({ state: 'checking', message: undefined })
  })

  autoUpdater.on('update-available', (info) => {
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
    setStatus({
      state: 'not-available',
      version: info.version,
      message: `You're on the latest version (${status.currentVersion}).`,
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    setStatus({
      state: 'downloading',
      percent: Math.max(0, Math.min(100, Math.round(progress.percent))),
      message: undefined,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    setStatus({
      state: 'ready',
      version: info.version,
      releaseNotes: releaseNotesText(info.releaseNotes),
      percent: 100,
      message: `Version ${info.version} is ready to install.`,
    })
  })

  autoUpdater.on('error', (error) => {
    applyUpdateFailure(error)
  })

  setTimeout(() => {
    void checkForUpdates(false)
  }, STARTUP_CHECK_DELAY_MS)
}
