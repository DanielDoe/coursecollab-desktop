import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, ipcMain } from 'electron'
import { resolveAppIcon } from './icon-utils'
import { installLanguageEnvironments, scanLanguageEnvironments } from './codebench/language-setup'
import {
  SETUP_VERSION,
  isUsableSetupState,
  shouldShowFirstRunSetup,
  type SetupState,
} from './first-run-setup-state'

export { SETUP_VERSION } from './first-run-setup-state'

function userDataFile(name: string): string {
  return join(app.getPath('userData'), name)
}

function setupStatePath(): string {
  return userDataFile('codebench-setup.json')
}

function userInstallInstancePath(): string {
  return userDataFile('install-instance.json')
}

function installerStampPath(): string | null {
  const resourcesPath = process.resourcesPath
  if (!resourcesPath) return null
  return join(resourcesPath, 'install-instance.json')
}

function readInstallIdFromFile(filePath: string): string | null {
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as { id?: unknown }
    return typeof parsed.id === 'string' && parsed.id.trim() ? parsed.id.trim() : null
  } catch {
    return null
  }
}

/**
 * Installer-written stamp (Windows NSIS) wins so a reinstall gets a new id
 * even if leftover AppData still has an old completion file.
 * Never treat a missing stamp as "already set up".
 */
export function currentInstallId(): string {
  const stamped = installerStampPath()
  if (stamped) {
    const fromInstaller = readInstallIdFromFile(stamped)
    if (fromInstaller) return fromInstaller
  }

  const existing = readInstallIdFromFile(userInstallInstancePath())
  if (existing) return existing

  const id = randomUUID()
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(userInstallInstancePath(), `${JSON.stringify({ id }, null, 2)}\n`, 'utf8')
  return id
}

/** Stable key for the machine profile CodeBench setup applies to. */
export function setupProfileKey(): string {
  return `${process.platform}-${process.arch}`
}

export function isFirstRunSetupComplete(): boolean {
  try {
    const parsed = JSON.parse(readFileSync(setupStatePath(), 'utf8')) as unknown
    return isUsableSetupState(parsed, {
      platform: process.platform,
      arch: process.arch,
      installId: currentInstallId(),
    })
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
    installId: currentInstallId(),
  }
  writeFileSync(setupStatePath(), `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

export function shouldRunFirstRunSetup(): boolean {
  return shouldShowFirstRunSetup({
    isPackaged: app.isPackaged,
    skipEnv: process.env.CC_SKIP_SETUP,
    forceEnv: process.env.CC_FORCE_SETUP,
    previewEnv: process.env.CC_PACKAGED_PREVIEW,
    resetSwitch: app.commandLine.hasSwitch('reset-setup'),
    setupComplete: isFirstRunSetupComplete(),
  })
}

function setupPagePath(): string {
  const candidates = [
    join(__dirname, 'setup', 'index.html'),
    process.resourcesPath ? join(process.resourcesPath, 'setup', 'index.html') : '',
  ]
  return candidates.find((path) => path && existsSync(path)) ?? candidates[0]
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
  const page = setupPagePath()
  if (!existsSync(page)) {
    console.error('[setup] setup page is missing; not marking this install complete')
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
    void window.loadFile(page)
  })
}
