import { app, ipcMain, type BrowserWindow, type WebContents } from 'electron'
import { getDesktopWindow } from './desktop-window'
import { refreshApplicationMenu } from './menu'

let lockdownDepth = 0
let menuHiddenForLockdown = false
let focusWatchInterval: ReturnType<typeof setInterval> | null = null
let boundWindow: BrowserWindow | null = null

type SavedWindowChrome = {
  minimizable: boolean
  maximizable: boolean
  fullscreenable: boolean
  closable: boolean
  alwaysOnTop: boolean
  contentProtection: boolean
}

let savedChrome: SavedWindowChrome | null = null

const boundContents = new WeakSet<WebContents>()

function isBlockedSystemShortcut(input: Electron.Input): boolean {
  const key = input.key?.toLowerCase?.() ?? ''
  const metaOrCtrl = input.meta || input.control

  if (key === 'f12') return true
  if (metaOrCtrl && input.shift && ['i', 'j', 'c'].includes(key)) return true
  if (input.meta && input.alt && ['i', 'j', 'c', 'u'].includes(key)) return true
  if (metaOrCtrl && !input.shift && key === 'u') return true

  // Minimize / hide / close while in exam lock
  if (input.meta && key === 'm') return true
  if (input.meta && key === 'h') return true
  if (metaOrCtrl && key === 'w') return true
  if (input.alt && key === 'f4') return true
  if (input.meta && key === 'q') return true

  return false
}

function attachLockdownInputGuards(contents: WebContents): void {
  if (boundContents.has(contents)) return
  boundContents.add(contents)

  contents.on('devtools-opened', () => {
    if (lockdownDepth > 0) {
      contents.closeDevTools()
    }
  })

  contents.on('before-input-event', (event, input) => {
    if (lockdownDepth <= 0) return
    if (input.type !== 'keyDown') return
    if (isBlockedSystemShortcut(input)) {
      event.preventDefault()
    }
  })
}

function reassertExamWindow(window: BrowserWindow): void {
  if (lockdownDepth <= 0) return

  if (window.isMinimized()) {
    window.restore()
  }
  if (!window.isVisible()) {
    window.show()
  }
  if (!window.isKiosk()) {
    window.setKiosk(true)
  }
  window.moveTop()
  window.focus()
}

function onWindowBlur(): void {
  if (lockdownDepth <= 0) return
  const window = getDesktopWindow()
  if (!window) return
  setImmediate(() => reassertExamWindow(window))
}

function onWindowMinimize(): void {
  if (lockdownDepth <= 0) return
  const window = getDesktopWindow()
  if (window) reassertExamWindow(window)
}

function onWindowHide(): void {
  if (lockdownDepth <= 0) return
  const window = getDesktopWindow()
  if (window) reassertExamWindow(window)
}

function onLeaveFullScreen(): void {
  if (lockdownDepth <= 0) return
  const window = getDesktopWindow()
  if (window) reassertExamWindow(window)
}

function attachWindowGuards(window: BrowserWindow): void {
  if (boundWindow === window) return
  detachWindowGuards()
  boundWindow = window
  window.on('blur', onWindowBlur)
  window.on('minimize', onWindowMinimize)
  window.on('hide', onWindowHide)
  window.on('leave-full-screen', onLeaveFullScreen)
}

function detachWindowGuards(): void {
  if (!boundWindow) return
  boundWindow.removeListener('blur', onWindowBlur)
  boundWindow.removeListener('minimize', onWindowMinimize)
  boundWindow.removeListener('hide', onWindowHide)
  boundWindow.removeListener('leave-full-screen', onLeaveFullScreen)
  boundWindow = null
}

function startFocusWatch(): void {
  stopFocusWatch()
  focusWatchInterval = setInterval(() => {
    if (lockdownDepth <= 0) return
    const window = getDesktopWindow()
    if (!window) return
    reassertExamWindow(window)
  }, 350)
}

function stopFocusWatch(): void {
  if (focusWatchInterval) {
    clearInterval(focusWatchInterval)
    focusWatchInterval = null
  }
}

function saveAndHardenWindowChrome(window: BrowserWindow): void {
  savedChrome = {
    minimizable: window.isMinimizable(),
    maximizable: window.isMaximizable(),
    fullscreenable: window.isFullScreenable(),
    closable: window.isClosable(),
    alwaysOnTop: window.isAlwaysOnTop(),
    contentProtection: false,
  }

  window.setMinimizable(false)
  window.setMaximizable(false)
  window.setFullScreenable(false)
  window.setAlwaysOnTop(true, 'screen-saver')
  window.setContentProtection(true)
}

function restoreWindowChrome(window: BrowserWindow): void {
  if (!savedChrome) return
  window.setMinimizable(savedChrome.minimizable)
  window.setMaximizable(savedChrome.maximizable)
  window.setFullScreenable(savedChrome.fullscreenable)
  window.setAlwaysOnTop(savedChrome.alwaysOnTop)
  window.setContentProtection(savedChrome.contentProtection)
  savedChrome = null
}

function enterAssessmentLockdown(): { ok: boolean; active: boolean } {
  const window = getDesktopWindow()
  if (!window) return { ok: false, active: false }

  lockdownDepth += 1
  if (lockdownDepth > 1) return { ok: true, active: true }

  const contents = window.webContents
  attachLockdownInputGuards(contents)
  attachWindowGuards(window)

  if (contents.isDevToolsOpened()) {
    contents.closeDevTools()
  }

  menuHiddenForLockdown = true
  window.setMenu(null)

  saveAndHardenWindowChrome(window)
  window.setKiosk(true)

  if (process.platform === 'darwin') {
    app.dock?.hide()
  }

  reassertExamWindow(window)
  startFocusWatch()

  return { ok: true, active: true }
}

function exitAssessmentLockdown(): { ok: boolean; active: boolean } {
  if (lockdownDepth <= 0) return { ok: true, active: false }

  lockdownDepth -= 1
  if (lockdownDepth > 0) return { ok: true, active: true }

  stopFocusWatch()
  detachWindowGuards()

  const window = getDesktopWindow()
  if (!window) return { ok: false, active: false }

  window.setKiosk(false)
  restoreWindowChrome(window)

  if (process.platform === 'darwin') {
    app.dock?.show()
  }

  if (menuHiddenForLockdown) {
    menuHiddenForLockdown = false
    refreshApplicationMenu()
  }

  window.focus()
  return { ok: true, active: false }
}

function reassertAssessmentLockdown(): { ok: boolean } {
  if (lockdownDepth <= 0) return { ok: false }
  const window = getDesktopWindow()
  if (!window) return { ok: false }
  reassertExamWindow(window)
  return { ok: true }
}

export function isAssessmentLockdownActive(): boolean {
  return lockdownDepth > 0
}

let lockdownIpcRegistered = false

export function registerAssessmentLockdownIpc(): void {
  if (lockdownIpcRegistered) return
  lockdownIpcRegistered = true
  ipcMain.handle('assessment:enter-lockdown', () => enterAssessmentLockdown())
  ipcMain.handle('assessment:exit-lockdown', () => exitAssessmentLockdown())
  ipcMain.handle('assessment:reassert-lockdown', () => reassertAssessmentLockdown())
  ipcMain.handle('assessment:is-lockdown-active', () => ({
    active: isAssessmentLockdownActive(),
  }))
}

export function forceExitAssessmentLockdown(): void {
  if (lockdownDepth <= 0) return
  lockdownDepth = 1
  void exitAssessmentLockdown()
}
