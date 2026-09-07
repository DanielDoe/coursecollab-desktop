import { getNotificationPreferences } from './preferences'

function parseMinutes(value: string | undefined, fallback: number): number {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return fallback
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return fallback
  return hours * 60 + minutes
}

export function isQuietHoursActive(now = new Date()): boolean {
  const prefs = getNotificationPreferences()
  if (!prefs.quietHoursEnabled) return false

  const current = now.getHours() * 60 + now.getMinutes()
  const start = parseMinutes(prefs.quietHoursStart, 22 * 60)
  const end = parseMinutes(prefs.quietHoursEnd, 7 * 60)

  if (start === end) return false
  if (start < end) return current >= start && current < end
  return current >= start || current < end
}
