import { Menu, Tray, app, type BrowserWindow } from 'electron'
import { focusDesktopWindow, navigateDesktopPath, setDesktopWindowGetter } from './desktop-window'
import { setAppQuitting } from './app-state'
import { resolveTrayIcon, resolveTrayIconPath } from './icon-utils'
import { getTrayPreviewItems } from './notification-store'
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  type DesktopNotificationPreferences,
} from './preferences'
import { setLaunchAtLoginPreference } from './push-registration'
import {
  getUpdateStatus,
  onDesktopUpdateStatusChange,
  requestDownloadUpdate,
  requestInstallDownloadedUpdate,
  requestManualUpdateCheck,
} from './updater'

let tray: Tray | null = null
let unreadCount = 0
let onPreferencesChange: ((prefs: DesktopNotificationPreferences) => void) | null = null

function focusWindow() {
  focusDesktopWindow()
}

function navigateFromTray(link: string) {
  navigateDesktopPath(link)
}

function updateTrayLabel(): string {
  const update = getUpdateStatus()
  if (update.state === 'ready') return `Restart to install ${update.version ?? 'update'}`
  if (update.state === 'available') return `Download update ${update.version ?? ''}`.trim()
  if (update.state === 'downloading') {
    return update.percent != null ? `Downloading update… ${update.percent}%` : 'Downloading update…'
  }
  return 'Check for updates'
}

function truncatePreview(text: string, max = 48): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

export function buildTrayMenu() {
  const prefs = getNotificationPreferences()
  const previewItems = getTrayPreviewItems()
  const unreadLabel =
    unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'No unread notifications'

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Show CourseCollab',
      click: () => focusWindow(),
    },
    {
      label: unreadLabel,
      enabled: false,
    },
  ]

  if (previewItems.length > 0) {
    template.push({ type: 'separator' })
    template.push({ label: 'Recent notifications', enabled: false })
    for (const item of previewItems) {
      template.push({
        label: `${truncatePreview(item.title)} — ${truncatePreview(item.body, 32)}`,
        click: () => {
          if (item.link) navigateFromTray(item.link)
          else focusWindow()
        },
      })
    }
  }

  template.push(
    { type: 'separator' },
    {
      label: 'Notification sounds',
      type: 'checkbox',
      checked: prefs.soundsEnabled,
      click: (menuItem) => {
        const next = saveNotificationPreferences({ soundsEnabled: menuItem.checked })
        onPreferencesChange?.(next)
        tray?.setContextMenu(buildTrayMenu())
      },
    },
    {
      label: 'Group notifications',
      type: 'checkbox',
      checked: prefs.groupingEnabled,
      click: (menuItem) => {
        const next = saveNotificationPreferences({ groupingEnabled: menuItem.checked })
        onPreferencesChange?.(next)
        tray?.setContextMenu(buildTrayMenu())
      },
    },
    {
      label: 'Group by course',
      type: 'checkbox',
      checked: prefs.groupByCourse,
      click: (menuItem) => {
        const next = saveNotificationPreferences({ groupByCourse: menuItem.checked })
        onPreferencesChange?.(next)
        tray?.setContextMenu(buildTrayMenu())
      },
    },
    {
      label: 'Quiet hours',
      type: 'checkbox',
      checked: prefs.quietHoursEnabled,
      click: (menuItem) => {
        const next = saveNotificationPreferences({ quietHoursEnabled: menuItem.checked })
        onPreferencesChange?.(next)
        tray?.setContextMenu(buildTrayMenu())
      },
    },
    {
      label: `Quiet hours (${prefs.quietHoursStart}–${prefs.quietHoursEnd})`,
      enabled: false,
    },
    {
      label: 'Background sync (tray)',
      type: 'checkbox',
      checked: prefs.backgroundSyncEnabled,
      click: (menuItem) => {
        const next = saveNotificationPreferences({ backgroundSyncEnabled: menuItem.checked })
        onPreferencesChange?.(next)
        tray?.setContextMenu(buildTrayMenu())
      },
    },
    {
      label: 'Launch at login (stay in tray)',
      type: 'checkbox',
      checked: prefs.launchAtLogin,
      click: (menuItem) => {
        setLaunchAtLoginPreference(menuItem.checked)
        const next = getNotificationPreferences()
        onPreferencesChange?.(next)
        tray?.setContextMenu(buildTrayMenu())
      },
    },
    {
      label: 'Minimize to tray on close',
      type: 'checkbox',
      checked: prefs.minimizeToTray,
      click: (menuItem) => {
        const next = saveNotificationPreferences({ minimizeToTray: menuItem.checked })
        onPreferencesChange?.(next)
        tray?.setContextMenu(buildTrayMenu())
      },
    },
    { type: 'separator' },
    {
      label: updateTrayLabel(),
      click: () => {
        focusWindow()
        const update = getUpdateStatus()
        if (update.state === 'ready') {
          requestInstallDownloadedUpdate()
          return
        }
        if (update.state === 'available') {
          void requestDownloadUpdate()
          return
        }
        void requestManualUpdateCheck()
      },
    },
    {
      label: 'Quit CourseCollab',
      click: () => {
        setAppQuitting(true)
        app.quit()
      },
    },
  )

  return Menu.buildFromTemplate(template)
}

function refreshTooltip() {
  if (!tray) return
  tray.setToolTip(
    unreadCount > 0 ? `CourseCollab — ${unreadCount} unread` : 'CourseCollab — Desktop',
  )
}

export function refreshTrayMenu() {
  tray?.setContextMenu(buildTrayMenu())
}

export function createDesktopTray(options: {
  getMainWindow: () => BrowserWindow | null
  onPreferencesUpdated?: (prefs: DesktopNotificationPreferences) => void
}) {
  if (tray) return tray

  setDesktopWindowGetter(options.getMainWindow)
  onPreferencesChange = options.onPreferencesUpdated ?? null
  onDesktopUpdateStatusChange(() => refreshTrayMenu())

  const trayPath = resolveTrayIconPath()
  tray = new Tray(
    process.platform === 'win32' && trayPath ? trayPath : resolveTrayIcon(),
  )
  tray.setToolTip('CourseCollab — Desktop')
  tray.setContextMenu(buildTrayMenu())

  tray.on('double-click', () => focusWindow())
  tray.on('click', () => {
    if (process.platform === 'darwin') focusWindow()
  })

  return tray
}

export function setTrayUnreadCount(count: number) {
  unreadCount = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0))
  refreshTooltip()
  refreshTrayMenu()
}

export function destroyDesktopTray() {
  tray?.destroy()
  tray = null
  onPreferencesChange = null
  onDesktopUpdateStatusChange(null)
  unreadCount = 0
}

export function shouldMinimizeToTrayOnClose(): boolean {
  return getNotificationPreferences().minimizeToTray
}
