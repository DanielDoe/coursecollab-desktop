import { formatCentralDate, formatCentralDateTime } from "@/lib/timezone"

export type AttendanceMeetingOption = {
  id: number
  section: string
  class_title?: string | null
  start_time?: string | null
  end_time?: string | null
  is_active?: boolean
  is_cancelled?: boolean
  total_attended?: number | string | null
}

export function formatMeetingDayLabel(meeting: AttendanceMeetingOption): string {
  if (!meeting.start_time) return "Unscheduled"
  return formatCentralDate(meeting.start_time, "EEE, MMM d, yyyy")
}

/** Compact day label for toolbar triggers (saves horizontal space). */
export function formatMeetingTriggerDayLabel(meeting: AttendanceMeetingOption): string {
  if (!meeting.start_time) return "Unscheduled"
  return formatCentralDate(meeting.start_time, "EEE, MMM d")
}

export function formatMeetingShortLabel(meeting: AttendanceMeetingOption): string {
  if (!meeting.start_time) return `No date · ${meeting.section}`
  const day = formatCentralDate(meeting.start_time, "MMM d, yyyy")
  return `${day} · ${meeting.section}`
}

export function formatMeetingTimeRange(meeting: AttendanceMeetingOption): string | null {
  if (!meeting.start_time) return null
  const start = formatCentralDateTime(meeting.start_time, "h:mm a")
  const end = meeting.end_time ? formatCentralDateTime(meeting.end_time, "h:mm a") : null
  const tz = formatCentralDateTime(meeting.start_time, "z")
  return end ? `${start} – ${end} ${tz}` : `${start} ${tz}`
}

export function formatMeetingRowLabel(meeting: AttendanceMeetingOption): string {
  const day = formatMeetingDayLabel(meeting)
  const time = formatMeetingTimeRange(meeting)
  return time ? `${day} ${time}` : day
}

export function attendedCountLabel(meeting: AttendanceMeetingOption): string | null {
  const n = Number(meeting.total_attended)
  if (!Number.isFinite(n) || n < 0) return null
  return n === 1 ? "1" : String(n)
}

export function isMeetingMarked(meeting: AttendanceMeetingOption): boolean {
  const n = Number(meeting.total_attended)
  return Number.isFinite(n) && n > 0
}

export function isMeetingCancelled(meeting: AttendanceMeetingOption): boolean {
  return meeting.is_cancelled === true
}

export type MeetingStatusBadge = {
  label: "Cancelled" | "Marked" | "Active" | "Off"
  variant: "cancelled" | "marked" | "active" | "off"
}

/** Cancelled → excluded from totals; roll taken → Marked; QR open → Active; else Off */
export function getMeetingStatusBadge(meeting: AttendanceMeetingOption): MeetingStatusBadge {
  if (isMeetingCancelled(meeting)) {
    return { label: "Cancelled", variant: "cancelled" }
  }
  if (isMeetingMarked(meeting)) {
    return { label: "Marked", variant: "marked" }
  }
  if (meeting.is_active) {
    return { label: "Active", variant: "active" }
  }
  return { label: "Off", variant: "off" }
}

export function meetingStatusBadgeClassName(variant: MeetingStatusBadge["variant"]): string {
  switch (variant) {
    case "cancelled":
      return "border-[var(--cc-sem-warning)]/30 bg-[var(--cc-sem-warning)]/10 text-[var(--cc-sem-warning)]"
    case "marked":
      return "border-[var(--cc-sem-info)]/30 bg-[var(--cc-sem-info)]/10 text-[var(--cc-sem-info)]"
    case "active":
      return "border-[var(--cc-sem-success)]/30 bg-[var(--cc-sem-success)]/10 text-[var(--cc-sem-success)]"
    default:
      return "border-[var(--border)] bg-muted text-[var(--cc-text-muted)]"
  }
}

export function groupMeetingsByMonth(
  meetings: AttendanceMeetingOption[],
): { month: string; items: AttendanceMeetingOption[] }[] {
  const groups = new Map<string, AttendanceMeetingOption[]>()
  for (const meeting of meetings) {
    const month = meeting.start_time
      ? formatCentralDate(meeting.start_time, "MMMM yyyy")
      : "Unscheduled"
    const list = groups.get(month) ?? []
    list.push(meeting)
    groups.set(month, list)
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => {
      const ta = groups.get(a)?.[0]?.start_time
      const tb = groups.get(b)?.[0]?.start_time
      const da = ta ? Date.parse(ta) : 0
      const db = tb ? Date.parse(tb) : 0
      return db - da
    })
    .map(([month, items]) => ({
      month,
      items: items.sort((a, b) => {
        const da = a.start_time ? Date.parse(a.start_time) : 0
        const db = b.start_time ? Date.parse(b.start_time) : 0
        return db - da
      }),
    }))
}

export function filterMeetingsBySection(
  meetings: AttendanceMeetingOption[],
  section?: string,
): AttendanceMeetingOption[] {
  const code = section?.trim()
  if (!code) return meetings
  const upper = code.toUpperCase()
  return meetings.filter((m) => m.section.trim().toUpperCase() === upper)
}
