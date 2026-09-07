import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const FILE = 'desktop-last-route.json'

export function isResumableDesktopPath(path: string): boolean {
  if (!path.startsWith('/')) return false
  if (path.includes('/login') || path.startsWith('/auth')) return false
  return (
    path.startsWith('/student/') ||
    path.startsWith('/faculty/') ||
    path.startsWith('/instructor/') ||
    path.startsWith('/admin/') ||
    path.startsWith('/guest/')
  )
}

function filePath(): string {
  return join(app.getPath('userData'), FILE)
}

export function readLastDesktopRoute(): string | null {
  try {
    if (!existsSync(filePath())) return null
    const parsed = JSON.parse(readFileSync(filePath(), 'utf8')) as { path?: unknown }
    if (typeof parsed.path !== 'string' || !isResumableDesktopPath(parsed.path)) return null
    return parsed.path
  } catch {
    return null
  }
}

export function writeLastDesktopRoute(path: string): { ok: boolean; path: string | null } {
  if (!isResumableDesktopPath(path)) {
    return { ok: false, path: readLastDesktopRoute() }
  }
  try {
    writeFileSync(filePath(), `${JSON.stringify({ path }, null, 2)}\n`, 'utf8')
    return { ok: true, path }
  } catch {
    return { ok: false, path }
  }
}

export function clearLastDesktopRoute(): void {
  try {
    writeFileSync(filePath(), `${JSON.stringify({ path: null }, null, 2)}\n`, 'utf8')
  } catch {
    /* ignore */
  }
}
