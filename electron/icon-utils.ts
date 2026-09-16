import { app, nativeImage } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const TRAY_SIZE = process.platform === 'darwin' ? 22 : process.platform === 'win32' ? 32 : 16

function iconCandidates(): string[] {
  const resources = typeof process.resourcesPath === 'string' ? process.resourcesPath : ''
  return [
    resources ? join(resources, 'icon.png') : '',
    resources ? join(resources, 'tray-icon-win.png') : '',
    resources ? join(resources, 'tray-icon.png') : '',
    join(__dirname, '../build/icon.png'),
    join(__dirname, '../public/brand/course-collab-mark-1024.png'),
    join(__dirname, '../public/brand/course-collab-mark-512.png'),
    join(__dirname, '../public/brand/course-collab-mark.png'),
    join(__dirname, '../public/icon.png'),
    join(__dirname, '../build/icon.png'),
    join(__dirname, '../public/icon.svg'),
  ].filter(Boolean)
}

function trayCandidates(): string[] {
  const resources = typeof process.resourcesPath === 'string' ? process.resourcesPath : ''
  // Windows must not use the macOS white template tray-icon.png — it vanishes on light taskbars.
  if (process.platform === 'win32') {
    return [
      resources ? join(resources, 'tray-icon-win.png') : '',
      resources ? join(resources, 'tray-icon-win-tile.png') : '',
      resources ? join(resources, 'icon.png') : '',
      join(__dirname, '../build/tray-icon-win.png'),
      join(__dirname, '../build/tray-icon-win-tile.png'),
      join(__dirname, '../build/icon.png'),
      join(__dirname, '../public/icon.png'),
      ...iconCandidates(),
    ].filter(Boolean)
  }
  return [
    resources ? join(resources, 'tray-icon.png') : '',
    join(__dirname, '../build/tray-icon.png'),
    join(__dirname, '../public/icon.png'),
    ...iconCandidates(),
  ].filter(Boolean)
}

function loadIconFromCandidates(paths: string[], size?: number): Electron.NativeImage | undefined {
  for (const candidate of paths) {
    if (!existsSync(candidate)) continue
    const image = nativeImage.createFromPath(candidate)
    if (image.isEmpty()) continue
    if (size) {
      return image.resize({ width: size, height: size })
    }
    return image
  }
  return undefined
}

/** Fallback 16×16 purple tile when no packaged icon exists (dev builds). */
function fallbackIcon(size: number): Electron.NativeImage {
  const canvas = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHUlEQVR42mP8z8BQz0BFwMiAqcLILQzj4eER' +
      'YGAYBQABBgABxgABwAAAAABJRU5ErkJggg==',
    'base64',
  )
  return nativeImage.createFromBuffer(canvas).resize({ width: size, height: size })
}

export function resolveAppIcon(): Electron.NativeImage {
  return loadIconFromCandidates(iconCandidates()) ?? fallbackIcon(32)
}

export function resolveAppIconPath(): string | undefined {
  return iconCandidates().find((candidate) => existsSync(candidate))
}

export function resolveTrayIcon(): Electron.NativeImage {
  const trayPath = trayCandidates().find((candidate) => existsSync(candidate))
  const icon = loadIconFromCandidates(trayCandidates(), TRAY_SIZE) ?? fallbackIcon(TRAY_SIZE)
  if (process.platform === 'darwin' && trayPath?.includes('tray-icon')) {
    icon.setTemplateImage(true)
  }
  return icon
}

export function applyNativeAppIcon(): void {
  const icon = resolveAppIcon()
  if (process.platform === 'darwin') {
    app.dock?.setIcon(icon)
  }
}
