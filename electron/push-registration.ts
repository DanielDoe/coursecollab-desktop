import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { getNotificationPreferences, saveNotificationPreferences } from './preferences'

const DEVICE_ID_FILE = 'desktop-device-id.json'

function deviceIdPath(): string {
  return join(app.getPath('userData'), DEVICE_ID_FILE)
}

export function getOrCreateDesktopDeviceId(): string {
  try {
    const filePath = deviceIdPath()
    if (existsSync(filePath)) {
      const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as { deviceId?: string }
      if (parsed.deviceId) return parsed.deviceId
    }
  } catch (error) {
    console.warn('[desktop-push] failed to read device id:', error)
  }

  const deviceId = randomUUID()
  try {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(deviceIdPath(), JSON.stringify({ deviceId }, null, 2), 'utf8')
  } catch (error) {
    console.warn('[desktop-push] failed to persist device id:', error)
  }
  return deviceId
}

export function applyLaunchAtLogin(enabled: boolean) {
  if (process.platform === 'linux') return

  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      ...(enabled ? { openAsHidden: true } : {}),
    } as Electron.Settings)
  } catch (error) {
    console.warn('[desktop-push] failed to set launch at login:', error)
  }
}

export function syncLaunchAtLoginPreference() {
  applyLaunchAtLogin(getNotificationPreferences().launchAtLogin)
}

export function setLaunchAtLoginPreference(enabled: boolean) {
  saveNotificationPreferences({ launchAtLogin: enabled })
  applyLaunchAtLogin(enabled)
}
