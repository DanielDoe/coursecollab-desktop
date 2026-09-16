import { shell, type WebContents } from 'electron'
import { getAppOrigin } from './app-protocol'

export function resolveViteDevServerUrl(): string {
  return process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173'
}

export function isAllowedInAppNavigation(url: string, viteDevServerUrl: string): boolean {
  if (!url || url === 'about:blank') return false
  if (url.startsWith('file://')) return true
  if (url.startsWith(viteDevServerUrl)) return true
  const appOrigin = getAppOrigin()
  if (url === appOrigin || url.startsWith(`${appOrigin}/`)) return true
  if (url.startsWith('blob:') || url.startsWith('data:')) return true
  return false
}

/**
 * Deny popup BrowserWindows for all web contents (including after login).
 * In-app URLs load in the current window; external URLs use the system browser.
 */
export function attachSingleWindowNavigationPolicy(
  contents: WebContents,
  viteDevServerUrl: string,
): void {
  contents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })

  contents.setWindowOpenHandler(({ url }) => {
    if (isAllowedInAppNavigation(url, viteDevServerUrl)) {
      void contents.loadURL(url)
      return { action: 'deny' }
    }
    if (url && url !== 'about:blank') {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  contents.on('will-navigate', (event, url) => {
    if (!isAllowedInAppNavigation(url, viteDevServerUrl)) {
      event.preventDefault()
      if (url) void shell.openExternal(url)
    }
  })
}
