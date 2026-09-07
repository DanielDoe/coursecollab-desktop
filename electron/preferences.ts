import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

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

const DEFAULT_PREFERENCES: DesktopNotificationPreferences = {
  soundsEnabled: true,
  groupingEnabled: true,
  groupByCourse: true,
  minimizeToTray: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  launchAtLogin: false,
  backgroundSyncEnabled: true,
}

let cached: DesktopNotificationPreferences = { ...DEFAULT_PREFERENCES }

function preferencesPath(): string {
  return join(app.getPath('userData'), 'desktop-notification-preferences.json')
}

export function loadNotificationPreferences(): DesktopNotificationPreferences {
  try {
    const filePath = preferencesPath()
    if (!existsSync(filePath)) {
      cached = { ...DEFAULT_PREFERENCES }
      return cached
    }
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<DesktopNotificationPreferences>
    cached = {
      soundsEnabled: parsed.soundsEnabled ?? DEFAULT_PREFERENCES.soundsEnabled,
      groupingEnabled: parsed.groupingEnabled ?? DEFAULT_PREFERENCES.groupingEnabled,
      groupByCourse: parsed.groupByCourse ?? DEFAULT_PREFERENCES.groupByCourse,
      minimizeToTray: parsed.minimizeToTray ?? DEFAULT_PREFERENCES.minimizeToTray,
      quietHoursEnabled: parsed.quietHoursEnabled ?? DEFAULT_PREFERENCES.quietHoursEnabled,
      quietHoursStart: parsed.quietHoursStart ?? DEFAULT_PREFERENCES.quietHoursStart,
      quietHoursEnd: parsed.quietHoursEnd ?? DEFAULT_PREFERENCES.quietHoursEnd,
      launchAtLogin: parsed.launchAtLogin ?? DEFAULT_PREFERENCES.launchAtLogin,
      backgroundSyncEnabled:
        parsed.backgroundSyncEnabled ?? DEFAULT_PREFERENCES.backgroundSyncEnabled,
    }
  } catch (error) {
    console.warn('[desktop-notifications] failed to load preferences:', error)
    cached = { ...DEFAULT_PREFERENCES }
  }
  return cached
}

export function getNotificationPreferences(): DesktopNotificationPreferences {
  return cached
}

export function saveNotificationPreferences(
  patch: Partial<DesktopNotificationPreferences>,
): DesktopNotificationPreferences {
  cached = { ...cached, ...patch }
  try {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(preferencesPath(), JSON.stringify(cached, null, 2), 'utf8')
  } catch (error) {
    console.warn('[desktop-notifications] failed to save preferences:', error)
  }
  return cached
}
