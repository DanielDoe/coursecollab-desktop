import type { AvailabilitySlotState } from "@/lib/schedule-adjustment/types"

export const DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const
export type DayCode = (typeof DAY_CODES)[number]

export const DAY_CODE_LABELS: Record<DayCode, string> = {
  MO: "Monday",
  TU: "Tuesday",
  WE: "Wednesday",
  TH: "Thursday",
  FR: "Friday",
  SA: "Saturday",
  SU: "Sunday",
}

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map((v) => Number.parseInt(v, 10))
  return h * 60 + (m || 0)
}

export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`
}

export function formatTime12h(time: string): string {
  const mins = parseTimeToMinutes(time)
  const h24 = Math.floor(mins / 60)
  const m = mins % 60
  const mer = h24 >= 12 ? "PM" : "AM"
  let h12 = h24 % 12
  if (h12 === 0) h12 = 12
  return `${h12}:${String(m).padStart(2, "0")} ${mer}`
}

export function slotKey(day: string, time: string): string {
  const mins = parseTimeToMinutes(time)
  const hh = String(Math.floor(mins / 60)).padStart(2, "0")
  const mm = String(mins % 60).padStart(2, "0")
  return `${day}-${hh}:${mm}`
}

export function generateTimeSlots(
  startTime: string,
  endTime: string,
  incrementMinutes: number,
): string[] {
  const start = parseTimeToMinutes(startTime)
  const end = parseTimeToMinutes(endTime)
  const slots: string[] = []
  for (let t = start; t < end; t += incrementMinutes) {
    slots.push(minutesToTime(t))
  }
  return slots
}

export function slotsForMeetingWindow(
  day: string,
  startTime: string,
  durationMinutes: number,
  incrementMinutes: number,
): string[] {
  const start = parseTimeToMinutes(startTime)
  const end = start + durationMinutes
  const keys: string[] = []
  for (let t = start; t < end; t += incrementMinutes) {
    keys.push(slotKey(day, minutesToTime(t)))
  }
  return keys
}

export function isStudentAvailableForWindow(
  slots: Record<string, AvailabilitySlotState>,
  windowKeys: string[],
): { available: boolean; preferredCount: number } {
  let preferredCount = 0
  for (const key of windowKeys) {
    const state = slots[key]
    if (state === "unavailable" || state == null) {
      return { available: false, preferredCount }
    }
    if (state === "preferred") preferredCount++
  }
  return { available: true, preferredCount }
}

export function formatScheduleBlock(dayCode: string, start: string, end: string): string {
  const label = DAY_CODE_LABELS[dayCode as DayCode] ?? dayCode
  return `${label}\n${formatTime12h(start)} to ${formatTime12h(end)}`
}

export function scheduleTextFromParts(
  dayCode: string,
  start: string,
  end: string,
): string {
  const label = DAY_CODE_LABELS[dayCode as DayCode] ?? dayCode
  return `${label} — ${formatTime12h(start)}–${formatTime12h(end)}`
}
