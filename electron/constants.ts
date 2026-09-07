export const DESKTOP_APP_UA_TOKEN = 'CourseCollab-Desktop'

/** Desktop startup — portal picker (student, faculty, career, summer, admin). */
export const DESKTOP_LOGIN_PATH = '/auth/welcome'

export const DEFAULT_COURSECOLLAB_URL = 'http://localhost:3000'

const DESKTOP_MARKETING_PATHS = new Set([
  '/',
  '/pitch',
  '/institutions',
  '/institutions/pricing',
  '/institutions/request-demo',
  '/institutions/request-quote',
])

export function isDesktopMarketingPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (DESKTOP_MARKETING_PATHS.has(path)) return true
  if (path.startsWith('/institutions/') && !path.startsWith('/institution/')) return true
  return false
}

export function isDesktopWebAuthPath(_pathname: string): boolean {
  return false
}

export function isDesktopBlockedShellPath(pathname: string): boolean {
  return isDesktopMarketingPath(pathname) || isDesktopWebAuthPath(pathname)
}

export function resolveCourseCollabUrl(): string {
  const raw = process.env.COURSECOLLAB_URL?.trim() || DEFAULT_COURSECOLLAB_URL
  return raw.replace(/\/+$/, '')
}

export function resolveStartupPath(): string {
  const path = process.env.COURSECOLLAB_START_PATH?.trim() || DESKTOP_LOGIN_PATH
  return path.startsWith('/') ? path : `/${path}`
}

export function buildDesktopUserAgent(appVersion: string): string {
  return `Mozilla/5.0 CourseCollab-Desktop/${appVersion}`
}

export function isCourseCollabUrl(urlString: string, baseUrl: string): boolean {
  try {
    const target = new URL(urlString)
    const base = new URL(baseUrl)
    return target.origin === base.origin
  } catch {
    return false
  }
}

export function resolveDesktopRedirectUrl(urlString: string, courseCollabUrl: string): string | null {
  if (!isCourseCollabUrl(urlString, courseCollabUrl)) return null
  const target = new URL(urlString)
  if (!isDesktopBlockedShellPath(target.pathname)) return null
  return `${courseCollabUrl}${DESKTOP_LOGIN_PATH}`
}
