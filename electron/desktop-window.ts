import { BrowserWindow } from 'electron'

let getWindow: (() => BrowserWindow | null) | null = null

export function setDesktopWindowGetter(getter: () => BrowserWindow | null): void {
  getWindow = getter
}

export function getDesktopWindow(): BrowserWindow | null {
  return getWindow?.() ?? BrowserWindow.getAllWindows()[0] ?? null
}

export function focusDesktopWindow(): BrowserWindow | null {
  const window = getDesktopWindow()
  if (!window) return null
  if (window.isMinimized()) window.restore()
  if (!window.isVisible()) window.show()
  window.focus()
  return window
}

export function navigateDesktopPath(path: string): void {
  const window = focusDesktopWindow()
  if (!window || !path.trim()) return
  const target = path.startsWith('/') || path.startsWith('desktop:') ? path.trim() : `/${path.trim()}`
  window.webContents.send('notification:navigate', target)
}
