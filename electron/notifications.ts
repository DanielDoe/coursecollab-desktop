import { BrowserWindow, Notification, app, ipcMain, nativeImage, type NotificationAction } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { resolveAppIcon } from './icon-utils'
import { addTrayPreviewItem } from './notification-store'
import { isQuietHoursActive } from './quiet-hours'
import {
  getNotificationPreferences,
  loadNotificationPreferences,
  saveNotificationPreferences,
  type DesktopNotificationPreferences,
} from './preferences'
import { refreshTrayMenu, setTrayUnreadCount } from './tray'

export type DesktopNotificationPortal = 'student' | 'faculty' | 'admin'

export type DesktopNotificationPayload = {
  id: string
  title: string
  body: string
  link?: string | null
  silent?: boolean
  groupKey?: string
  groupLabel?: string
  notificationId?: number
  /** Every feed id represented by this alert (grouped alerts carry more than one). */
  notificationIds?: number[]
  portal?: DesktopNotificationPortal
  type?: string | null
  supportsReply?: boolean
}

export type DesktopNotificationActionPayload = {
  action: 'mark-read' | 'reply'
  notificationId: number
  /** All ids the alert represents, so grouped alerts mark every item read. */
  notificationIds: number[]
  portal: DesktopNotificationPortal
  reply?: string
}

type GroupBucket = {
  label: string
  items: DesktopNotificationPayload[]
  timer: NodeJS.Timeout | null
}

const GROUP_DELAY_MS = 2500
/** Bounded so a long-lived desktop session cannot grow this set without limit. */
const MAX_DELIVERED_IDS = 500
const MAX_DEFERRED_NOTIFICATIONS = 100
const QUIET_HOURS_CHECK_MS = 60_000

let mainWindow: BrowserWindow | null = null
const deliveredNotificationIds = new Set<string>()
const deliveredNotificationOrder: string[] = []
const groupBuckets = new Map<string, GroupBucket>()
/** Alerts withheld during quiet hours, replayed as one summary when the window ends. */
const deferredNotifications: DesktopNotificationPayload[] = []
let quietHoursTimer: NodeJS.Timeout | null = null
let quietHoursWasActive = false

export function setMainWindow(window: BrowserWindow | null) {
  mainWindow = window
}

function focusMainWindow() {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  if (!mainWindow.isVisible()) mainWindow.show()
  mainWindow.focus()
}

function rememberDelivered(id: string) {
  if (deliveredNotificationIds.has(id)) return
  deliveredNotificationIds.add(id)
  deliveredNotificationOrder.push(id)
  while (deliveredNotificationOrder.length > MAX_DELIVERED_IDS) {
    const evicted = deliveredNotificationOrder.shift()
    if (evicted) deliveredNotificationIds.delete(evicted)
  }
}

function forgetDelivered(id: string) {
  if (!deliveredNotificationIds.delete(id)) return
  const index = deliveredNotificationOrder.indexOf(id)
  if (index >= 0) deliveredNotificationOrder.splice(index, 1)
}

function notificationSoundOptions(silentOverride?: boolean): { silent: boolean; sound?: string } {
  const prefs = getNotificationPreferences()
  const silent = silentOverride ?? !prefs.soundsEnabled
  if (silent) return { silent: true }
  if (process.platform === 'darwin') return { silent: false, sound: 'Ping' }
  return { silent: false }
}

function buildNotificationActions(payload: DesktopNotificationPayload): NotificationAction[] {
  if (process.platform !== 'darwin') return []

  const actions: NotificationAction[] = [{ type: 'button', text: 'Mark as read' }]
  if (payload.supportsReply) {
    actions.push({ type: 'button', text: 'Reply' })
  }
  return actions
}

/** Every feed id an alert stands for; grouped alerts carry the whole batch. */
function resolveNotificationIds(payload: DesktopNotificationPayload): number[] {
  const ids = payload.notificationIds?.filter((id) => Number.isFinite(id)) ?? []
  if (ids.length > 0) return ids
  return payload.notificationId != null ? [payload.notificationId] : []
}

function emitNotificationAction(action: DesktopNotificationActionPayload) {
  focusMainWindow()
  mainWindow?.webContents.send('notification:action', action)
}

function addPreviewItem(payload: DesktopNotificationPayload) {
  addTrayPreviewItem({
    id: payload.id,
    title: payload.title.trim() || 'CourseCollab',
    body: payload.body.trim(),
    link: payload.link,
    createdAt: Date.now(),
  })
  refreshTrayMenu()
}

/**
 * Hold an alert raised during quiet hours instead of discarding it. The renderer
 * has already advanced its "seen" cursor by this point, so dropping it here would
 * lose the notification permanently.
 */
function deferForQuietHours(payload: DesktopNotificationPayload) {
  deferredNotifications.push(payload)
  while (deferredNotifications.length > MAX_DEFERRED_NOTIFICATIONS) {
    deferredNotifications.shift()
  }
  // Still visible in the tray during the quiet window — only the banner is withheld.
  addPreviewItem(payload)
  return { ok: false as const, reason: 'quiet-hours-deferred' as const }
}

function flushDeferredNotifications() {
  if (deferredNotifications.length === 0) return

  const items = deferredNotifications.splice(0, deferredNotifications.length)
  if (items.length === 1) {
    showNativeNotification({ ...items[0], id: `deferred:${items[0].id}` })
    return
  }

  const preview = items
    .slice(0, 3)
    .map((item) => `• ${item.title}`)
    .join('\n')
  const remainder = items.length > 3 ? `\n• +${items.length - 3} more` : ''
  const notificationIds = items.flatMap((item) => resolveNotificationIds(item))

  showNativeNotification({
    id: `deferred:${Date.now()}`,
    title: `${items.length} notifications while you were away`,
    body: `${preview}${remainder}`,
    link: items[0]?.link,
    groupLabel: 'Quiet hours',
    notificationId: notificationIds[0],
    notificationIds,
    portal: items[0]?.portal,
  })
}

/** Watches for the quiet-hours window closing so held alerts get delivered. */
function startQuietHoursWatcher() {
  if (quietHoursTimer) return
  quietHoursWasActive = isQuietHoursActive()
  quietHoursTimer = setInterval(() => {
    const active = isQuietHoursActive()
    if (quietHoursWasActive && !active) {
      flushDeferredNotifications()
    }
    quietHoursWasActive = active
  }, QUIET_HOURS_CHECK_MS)
  quietHoursTimer.unref?.()
}

function showNativeNotification(payload: DesktopNotificationPayload) {
  if (!Notification.isSupported()) {
    return { ok: false as const, reason: 'unsupported' as const }
  }

  if (deliveredNotificationIds.has(payload.id)) {
    return { ok: true as const, deduped: true as const }
  }

  if (isQuietHoursActive()) {
    rememberDelivered(payload.id)
    return deferForQuietHours(payload)
  }

  rememberDelivered(payload.id)

  const soundOptions = notificationSoundOptions(payload.silent)
  const actions = buildNotificationActions(payload)
  const notificationIds = resolveNotificationIds(payload)
  const canMarkRead = notificationIds.length > 0 && payload.portal != null

  const notification = new Notification({
    title: payload.title.trim() || 'CourseCollab',
    body: payload.body.trim(),
    icon: resolveAppIcon(),
    ...soundOptions,
    ...(process.platform === 'darwin' && payload.groupLabel
      ? { subtitle: payload.groupLabel }
      : {}),
    ...(actions.length > 0 ? { actions } : {}),
    ...(process.platform === 'darwin' && payload.supportsReply
      ? { hasReply: true, replyPlaceholder: 'Reply…' }
      : {}),
  })

  notification.on('click', () => {
    focusMainWindow()
    if (payload.link && mainWindow) {
      mainWindow.webContents.send('notification:navigate', payload.link)
    }
  })

  notification.on('action', (_event, index) => {
    if (!canMarkRead || !payload.portal) return

    if (index === 0) {
      emitNotificationAction({
        action: 'mark-read',
        notificationId: notificationIds[0],
        notificationIds,
        portal: payload.portal,
      })
      return
    }

    if (index === 1 && payload.supportsReply) {
      focusMainWindow()
      if (payload.link) {
        mainWindow?.webContents.send('notification:navigate', payload.link)
      }
    }
  })

  notification.on('reply', (_event, reply) => {
    if (!canMarkRead || !payload.portal || !payload.supportsReply) return
    emitNotificationAction({
      action: 'reply',
      notificationId: notificationIds[0],
      notificationIds,
      portal: payload.portal,
      reply,
    })
  })

  notification.on('failed', (_event, error) => {
    forgetDelivered(payload.id)
    console.warn('[desktop-notifications] failed to display notification:', error)
  })

  notification.show()

  addPreviewItem(payload)

  return { ok: true as const }
}

function flushGroup(groupKey: string) {
  const bucket = groupBuckets.get(groupKey)
  if (!bucket) return

  groupBuckets.delete(groupKey)
  if (bucket.timer) {
    clearTimeout(bucket.timer)
    bucket.timer = null
  }

  const items = bucket.items
  if (items.length === 0) return

  if (items.length === 1) {
    showNativeNotification(items[0])
    return
  }

  const preview = items
    .slice(0, 3)
    .map((item) => `• ${item.title}`)
    .join('\n')
  const remainder = items.length > 3 ? `\n• +${items.length - 3} more` : ''
  // Carry every id so "Mark as read" clears the whole group, not just the first item.
  const notificationIds = items.flatMap((item) => resolveNotificationIds(item))

  showNativeNotification({
    id: `group:${groupKey}:${items[items.length - 1]?.id ?? Date.now()}`,
    title: `${items.length} new ${bucket.label}`,
    body: `${preview}${remainder}`,
    link: items[0]?.link,
    groupKey,
    groupLabel: bucket.label,
    notificationId: notificationIds[0],
    notificationIds,
    portal: items[0]?.portal,
  })
}

export function enqueueDesktopNotification(payload: DesktopNotificationPayload) {
  const prefs = getNotificationPreferences()
  if (!prefs.groupingEnabled) {
    return showNativeNotification(payload)
  }

  const groupKey = payload.groupKey ?? 'general'
  const label = payload.groupLabel ?? 'updates'

  let bucket = groupBuckets.get(groupKey)
  if (!bucket) {
    bucket = { label, items: [], timer: null }
    groupBuckets.set(groupKey, bucket)
  }

  bucket.label = label
  bucket.items.push(payload)

  if (bucket.timer) clearTimeout(bucket.timer)
  bucket.timer = setTimeout(() => flushGroup(groupKey), GROUP_DELAY_MS)

  return { ok: true as const, grouped: true as const }
}

/** Windows has no dock badge; an overlay icon on the taskbar button is the equivalent. */
function windowsOverlayIcon(count: number): Electron.NativeImage | null {
  if (count <= 0) return null
  const name = count > 9 ? 'badge-more.png' : `badge-${count}.png`
  const candidates = [
    typeof process.resourcesPath === 'string' ? join(process.resourcesPath, 'badges', name) : '',
    join(__dirname, '../build/badges', name),
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue
    const image = nativeImage.createFromPath(candidate)
    if (!image.isEmpty()) return image
  }
  return null
}

function setBadgeCount(count: number) {
  const normalized = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0))

  if (process.platform === 'darwin' || process.platform === 'linux') {
    app.setBadgeCount(normalized)
  } else if (mainWindow && !mainWindow.isDestroyed()) {
    const overlay = windowsOverlayIcon(normalized)
    if (overlay) {
      mainWindow.setOverlayIcon(overlay, `${normalized} unread notifications`)
    } else {
      mainWindow.setOverlayIcon(null, '')
      if (normalized > 0) mainWindow.flashFrame(true)
    }
  }

  setTrayUnreadCount(normalized)

  return { ok: true as const, count: normalized }
}

export function registerNotificationHandlers() {
  loadNotificationPreferences()
  startQuietHoursWatcher()

  ipcMain.handle('notification:show', (_event, payload: DesktopNotificationPayload) => {
    return enqueueDesktopNotification(payload)
  })

  ipcMain.handle('notification:set-badge', (_event, count: number) => {
    return setBadgeCount(count)
  })

  ipcMain.handle('notification:clear-badge', () => {
    return setBadgeCount(0)
  })

  ipcMain.handle('notification:get-support', () => ({
    supported: Notification.isSupported(),
    platform: process.platform,
    sounds: process.platform === 'darwin' || process.platform === 'win32',
    grouping: true,
    tray: true,
    actions: process.platform === 'darwin',
    quietHours: true,
    backgroundSync: true,
    pushWhenQuit: 'launch-at-login',
  }))

  ipcMain.handle('notification:get-preferences', () => getNotificationPreferences())

  ipcMain.handle(
    'notification:set-preferences',
    (_event, patch: Partial<DesktopNotificationPreferences>) => {
      const next = saveNotificationPreferences(patch)
      // Turning quiet hours off by hand should release anything held immediately.
      if (patch.quietHoursEnabled === false || !isQuietHoursActive()) {
        flushDeferredNotifications()
      }
      quietHoursWasActive = isQuietHoursActive()
      return next
    },
  )
}
