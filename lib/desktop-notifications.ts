import {
  desktopNotificationGroupKey,
  desktopNotificationGroupLabel,
  desktopNotificationHubLink,
  extractCourseKeyFromLink,
  extractCourseLabel,
  notificationSupportsReply,
} from '@/lib/desktop-notification-groups'
import {
  DESKTOP_REFRESH_TOKEN_HEADER,
  readDesktopRefreshToken,
} from '@/lib/desktop-refresh-token'
import { DESKTOP_CLIENT_HEADER, isDesktopAppShell } from '@/lib/desktop-auth-policy'

export type DesktopNotificationPayload = {
  id: string
  title: string
  body: string
  link?: string | null
  silent?: boolean
  groupKey?: string
  groupLabel?: string
  notificationId?: number
  /** Every feed id the alert represents (grouped alerts carry more than one). */
  notificationIds?: number[]
  portal?: 'student' | 'faculty' | 'admin'
  type?: string | null
  supportsReply?: boolean
}

export type DesktopNotificationActionPayload = {
  action: 'mark-read' | 'reply'
  notificationId: number
  /** All ids the alert stood for, so a grouped alert marks every item read. */
  notificationIds?: number[]
  portal: 'student' | 'faculty' | 'admin'
  reply?: string
}

export type DesktopNotificationPreferences = {
  soundsEnabled: boolean
  groupingEnabled: boolean
  groupByCourse: boolean
  minimizeToTray: boolean
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
  launchAtLogin: boolean
  backgroundSyncEnabled: boolean
}

export type NotificationSyncContext = {
  portal: 'student' | 'faculty' | 'admin'
  pollUrl: string
  headers: Record<string, string>
}

export type FeedNotification = {
  id: number
  title: string
  message: string
  link: string | null
  is_read: boolean
  type?: string | null
  source_name?: string | null
}

function resolveApiBaseUrl(): string {
  // `import.meta.env` only exists under Vite. The same module is bundled into the
  // Next web app, where reading a property off it can throw, so probe defensively.
  let fromEnv: string | undefined
  try {
    fromEnv = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_URL?.trim()
  } catch {
    fromEnv = undefined
  }
  if (fromEnv) return fromEnv.replace(/\/+$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

export function isDesktopElectronShell(): boolean {
  return typeof window !== 'undefined' && window.courseCollabDesktop?.isDesktopShell === true
}

export function shouldKeepNotificationPollingWhenHidden(): boolean {
  return isDesktopElectronShell()
}

export async function showDesktopNotification(payload: DesktopNotificationPayload): Promise<void> {
  if (!isDesktopElectronShell() || !window.courseCollabDesktop?.showNotification) return
  try {
    await window.courseCollabDesktop.showNotification(payload)
  } catch (error) {
    console.warn('[desktop-notifications] show failed:', error)
  }
}

export async function setDesktopBadgeCount(count: number): Promise<void> {
  if (!isDesktopElectronShell() || !window.courseCollabDesktop?.setBadgeCount) return
  try {
    await window.courseCollabDesktop.setBadgeCount(count)
  } catch (error) {
    console.warn('[desktop-notifications] badge update failed:', error)
  }
}

export async function clearDesktopBadgeCount(): Promise<void> {
  if (!isDesktopElectronShell() || !window.courseCollabDesktop?.clearBadgeCount) return
  try {
    await window.courseCollabDesktop.clearBadgeCount()
  } catch (error) {
    console.warn('[desktop-notifications] badge clear failed:', error)
  }
}

export function onDesktopNotificationNavigate(handler: (link: string) => void): () => void {
  if (!isDesktopElectronShell() || !window.courseCollabDesktop?.onNotificationNavigate) {
    return () => {}
  }
  return window.courseCollabDesktop.onNotificationNavigate(handler)
}

export function onDesktopNotificationAction(
  handler: (payload: DesktopNotificationActionPayload) => void,
): () => void {
  if (!isDesktopElectronShell() || !window.courseCollabDesktop?.onNotificationAction) {
    return () => {}
  }
  return window.courseCollabDesktop.onNotificationAction(handler)
}

export async function getDesktopNotificationPreferences(): Promise<DesktopNotificationPreferences | null> {
  if (!window.courseCollabDesktop?.getNotificationPreferences) return null
  return window.courseCollabDesktop.getNotificationPreferences()
}

export async function setDesktopNotificationPreferences(
  patch: Partial<DesktopNotificationPreferences>,
): Promise<DesktopNotificationPreferences | null> {
  if (!window.courseCollabDesktop?.setNotificationPreferences) return null
  return window.courseCollabDesktop.setNotificationPreferences(patch)
}

export async function registerDesktopNotificationSync(
  context: NotificationSyncContext | null,
): Promise<void> {
  if (!window.courseCollabDesktop?.setNotificationSyncContext) return
  try {
    await window.courseCollabDesktop.setNotificationSyncContext(context)
  } catch (error) {
    console.warn('[desktop-notifications] sync registration failed:', error)
  }
}

/**
 * Build the context the main process polls with.
 *
 * The identity headers alone are not a session: the server treats `x-student-id`
 * and `x-instructor-id` as claims, not proof, and requires the refresh token
 * (cookie or `x-cc-refresh`). The main process cannot read the renderer's
 * localStorage, so the token has to travel with the context or every background
 * poll comes back 401.
 */
export function buildDesktopNotificationSyncContext(
  portal: NotificationSyncContext['portal'],
  pollPath: string,
  headers: Record<string, string>,
): NotificationSyncContext {
  const base = resolveApiBaseUrl()
  const path = pollPath.startsWith('/') ? pollPath : `/${pollPath}`

  const authedHeaders: Record<string, string> = { ...headers }
  if (isDesktopAppShell()) {
    authedHeaders[DESKTOP_CLIENT_HEADER] = 'desktop'
  }
  const refreshToken = readDesktopRefreshToken()
  if (refreshToken) {
    authedHeaders[DESKTOP_REFRESH_TOKEN_HEADER] = refreshToken
  }

  return {
    portal,
    pollUrl: `${base}${path}`,
    headers: authedHeaders,
  }
}

/** Show OS notifications for newly arrived unread feed items (skips initial sync). */
export async function deliverNewDesktopNotifications(
  knownIds: Set<number>,
  notifications: FeedNotification[],
  options: { initialized: boolean; portal: NotificationSyncContext['portal'] },
): Promise<Set<number>> {
  const nextKnownIds = new Set(notifications.map((item) => item.id))

  if (!options.initialized || !isDesktopElectronShell()) {
    return nextKnownIds
  }

  const hubLink = desktopNotificationHubLink(options.portal)
  const prefs = await getDesktopNotificationPreferences()
  const groupByCourse = prefs?.groupByCourse ?? true

  for (const notification of notifications) {
    if (knownIds.has(notification.id) || notification.is_read) continue

    const courseKey = extractCourseKeyFromLink(notification.link)
    const courseLabel = extractCourseLabel(notification)

    await showDesktopNotification({
      id: `${options.portal}:${notification.id}`,
      title: notification.title,
      body: notification.message,
      link: notification.link ?? hubLink,
      groupKey: desktopNotificationGroupKey(
        options.portal,
        notification.type,
        courseKey,
        groupByCourse,
      ),
      groupLabel: desktopNotificationGroupLabel(
        options.portal,
        notification.type,
        courseLabel,
      ),
      notificationId: notification.id,
      notificationIds: [notification.id],
      portal: options.portal,
      type: notification.type,
      supportsReply: notificationSupportsReply(notification.type),
    })
  }

  return nextKnownIds
}
