import { PRESENCE_ONLINE_MS } from "@/lib/presence/constants"
import type { ManualPresenceStatus, PresenceStatus } from "@/lib/presence/types"

function formatRelativeElapsed(elapsedMs: number): string {
  const sec = Math.max(0, Math.floor(elapsedMs / 1000))
  if (sec < 45) return "just now"
  const min = Math.floor(sec / 60)
  if (min < 60) return min === 1 ? "1 minute ago" : `${min} minutes ago`
  const hours = Math.floor(min / 60)
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return days === 1 ? "1 day ago" : `${days} days ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`
  const months = Math.floor(days / 30)
  if (months < 12) return months === 1 ? "1 month ago" : `${months} months ago`
  const years = Math.floor(days / 365)
  return years === 1 ? "1 year ago" : `${years} years ago`
}

/** Human-readable last-seen line for chat headers. Returns null when hidden (appear offline). */
export function formatLastSeenLabel(
  status: PresenceStatus | undefined,
  lastSeenAt: string | null | undefined,
  manualStatus?: ManualPresenceStatus | null,
  now = Date.now(),
): string | null {
  if (manualStatus === "appear_offline") return null

  if (!lastSeenAt) {
    if (status === "available") return "Active now"
    if (status === "away") return "Away"
    if (status === "busy") return "Busy"
    if (status === "dnd") return "Do not disturb"
    if (status === "offline") return "Offline"
    return null
  }

  const elapsed = now - new Date(lastSeenAt).getTime()
  if (!Number.isFinite(elapsed) || elapsed < 0) return null

  if (status === "available" && elapsed <= PRESENCE_ONLINE_MS) {
    return "Active now"
  }

  return `Last seen ${formatRelativeElapsed(elapsed)}`
}
