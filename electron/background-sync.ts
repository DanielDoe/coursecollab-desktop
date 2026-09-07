import { session } from 'electron'
import {
  desktopNotificationGroupKey,
  desktopNotificationGroupLabel,
  extractCourseKeyFromLink,
  notificationSupportsReply,
} from './notification-groups'
import { enqueueDesktopNotification, type DesktopNotificationPayload } from './notifications'
import { getNotificationPreferences } from './preferences'

export type NotificationSyncContext = {
  portal: 'student' | 'faculty' | 'admin'
  pollUrl: string
  headers: Record<string, string>
}

const POLL_MS = 30_000
/** Matches the server's REFRESH_TOKEN_HEADER and the renderer's desktop-refresh-token module. */
const REFRESH_TOKEN_HEADER = 'x-cc-refresh'
const SESSION_PARTITION = 'persist:coursecollab'

let syncContext: NotificationSyncContext | null = null
let pollTimer: NodeJS.Timeout | null = null
let knownIds = new Set<number>()
let initialized = false
let unauthorizedLogged = false

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

/**
 * Poll through Electron's net stack bound to the renderer's session partition.
 * Node's global fetch has no cookie jar and no access to the session, so the
 * server never saw a valid session and every background poll came back 401.
 */
async function fetchNotifications(): Promise<{
  notifications?: Array<Record<string, unknown>>
  unread_count?: number
} | null> {
  if (!syncContext) return null

  try {
    // ses.fetch() issues the request from the renderer's session, so the session
    // cookies set at login travel with it. net.fetch()/global fetch cannot.
    const response = await session.fromPartition(SESSION_PARTITION).fetch(syncContext.pollUrl, {
      method: 'GET',
      headers: syncContext.headers,
      credentials: 'include',
    })

    // The server rotates refresh tokens; keep the stored one current or the
    // next poll authenticates with a token the server has already retired.
    const rotated = response.headers.get(REFRESH_TOKEN_HEADER)?.trim()
    if (rotated && syncContext) {
      syncContext.headers = { ...syncContext.headers, [REFRESH_TOKEN_HEADER]: rotated }
    }

    if (response.status === 401 || response.status === 403) {
      if (!unauthorizedLogged) {
        console.warn(
          '[desktop-notifications] background sync unauthorized — the renderer must re-register a sync context with a valid session token',
        )
        unauthorizedLogged = true
      }
      return null
    }

    unauthorizedLogged = false
    if (!response.ok) return null
    return (await response.json()) as { notifications?: Array<Record<string, unknown>> }
  } catch (error) {
    console.warn('[desktop-notifications] background poll failed:', error)
    return null
  }
}

function buildPayload(
  raw: Record<string, unknown>,
  portal: NotificationSyncContext['portal'],
): DesktopNotificationPayload {
  const id = Number(raw.id)
  const type = typeof raw.type === 'string' ? raw.type : null
  const link = typeof raw.link === 'string' ? raw.link : null
  const sourceName = typeof raw.source_name === 'string' ? raw.source_name : null
  const prefs = getNotificationPreferences()
  const courseKey = extractCourseKeyFromLink(link)
  const courseLabel = sourceName ?? (courseKey ? courseKey.replace(/^course:/, '') : null)

  return {
    id: `${portal}:${id}`,
    title: String(raw.title ?? 'CourseCollab'),
    body: String(raw.message ?? raw.body ?? ''),
    link,
    groupKey: desktopNotificationGroupKey(portal, type, courseKey, prefs.groupByCourse),
    groupLabel: desktopNotificationGroupLabel(portal, type, courseLabel),
    notificationId: id,
    notificationIds: [id],
    portal,
    type,
    supportsReply: notificationSupportsReply(type),
  }
}

async function pollOnce() {
  if (!syncContext) return
  if (!getNotificationPreferences().backgroundSyncEnabled) return

  const data = await fetchNotifications()
  if (!data?.notifications) return

  for (const raw of data.notifications) {
    const id = Number(raw.id)
    if (!Number.isFinite(id)) continue
    const isRead = Boolean(raw.is_read)
    // Quiet hours are handled downstream so the alert is deferred, not discarded.
    if (initialized && !knownIds.has(id) && !isRead) {
      enqueueDesktopNotification(buildPayload(raw, syncContext.portal))
    }
    knownIds.add(id)
  }

  initialized = true
}

export function setNotificationSyncContext(context: NotificationSyncContext | null) {
  syncContext = context
  knownIds = new Set()
  initialized = false
  unauthorizedLogged = false
  stopPolling()

  if (!context) return

  void pollOnce()
  pollTimer = setInterval(() => {
    void pollOnce()
  }, POLL_MS)
  pollTimer.unref?.()
}

export function getNotificationSyncContext() {
  return syncContext
}
