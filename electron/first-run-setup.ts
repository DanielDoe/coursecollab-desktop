import { app, BrowserWindow, ipcMain } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveAppIcon } from './icon-utils'
import { installLanguageEnvironments, scanLanguageEnvironments } from './codebench/language-setup'

const SETUP_VERSION = 2

type SetupState = {
  version: number
  completedAt: string
  /** OS + CPU profile that finished setup (darwin/win32/linux × arch). */
  platform: NodeJS.Platform
  arch: string
}

function setupStatePath(): string {
  // Lives under Electron userData (%APPDATA%/CourseCollab on Windows), not in the repo or installer bundle.
  return join(app.getPath('userData'), 'codebench-setup.json')
}

/** Stable key for the machine profile CodeBench setup applies to. */
export function setupProfileKey(): string {
  return `${process.platform}-${process.arch}`
}

function setupMatchesCurrentProfile(parsed: SetupState): boolean {
  return parsed.platform === process.platform && parsed.arch === process.arch
}

export function isFirstRunSetupComplete(): boolean {
  try {
    const raw = readFileSync(setupStatePath(), 'utf8')
    const parsed = JSON.parse(raw) as SetupState
    if (parsed.version !== SETUP_VERSION || !parsed.completedAt) return false
    // Older global flags (e.g. copied from another OS) must not skip setup here.
    if (!parsed.platform || !parsed.arch) return false
    return setupMatchesCurrentProfile(parsed)
  } catch {
    return false
  }
}

export function markFirstRunSetupComplete(): void {
  mkdirSync(app.getPath('userData'), { recursive: true })
  const state: SetupState = {
    version: SETUP_VERSION,
    completedAt: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
  }
  writeFileSync(setupStatePath(), `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

export function shouldRunFirstRunSetup(): boolean {
  if (process.env.CC_SKIP_SETUP === '1') return false
  if (process.env.CC_FORCE_SETUP === '1') return true
  if (!app.isPackaged && process.env.CC_PACKAGED_PREVIEW !== '1') return false
  return !isFirstRunSetupComplete()
}

function setupPagePath(): string {
  return join(__dirname, 'setup', 'index.html')
}

let setupIpcRegistered = false

export function registerFirstRunSetupIpc(): void {
  if (setupIpcRegistered) return
  setupIpcRegistered = true
  ipcMain.handle('setup:scan', () => scanLanguageEnvironments())
  ipcMain.handle('setup:install', () => installLanguageEnvironments())
  ipcMain.handle('setup:finish', (event) => {
    markFirstRunSetupComplete()
    BrowserWindow.fromWebContents(event.sender)?.close()
    return { ok: true }
  })
}

export function runFirstRunSetupWindow(): Promise<void> {
  if (!existsSync(setupPagePath())) {
    markFirstRunSetupComplete()
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const window = new BrowserWindow({
      width: 760,
      height: 800,
      minWidth: 680,
      minHeight: 700,
      resizable: false,
      show: false,
      backgroundColor: '#f4f5f8',
      title: 'CourseCollab Setup',
      icon: resolveAppIcon(),
      webPreferences: {
        preload: join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })

    window.once('ready-to-show', () => window.show())
    window.on('closed', () => resolve())
    void window.loadFile(setupPagePath())
  })
}
