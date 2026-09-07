/** Canonical manual / instructor attendance statuses and credit weights (0–1). */
export type AttendanceStatus = "present" | "absent" | "excused" | "late"

export const ATTENDANCE_STATUS_OPTIONS: {
  value: AttendanceStatus
  label: string
  points: number
  shortLabel: string
}[] = [
  { value: "present", label: "Present", points: 1, shortLabel: "P" },
  { value: "late", label: "Late", points: 0.75, shortLabel: "L" },
  { value: "excused", label: "Absent (excused)", points: 0.5, shortLabel: "E" },
  { value: "absent", label: "Absent", points: 0, shortLabel: "A" },
]

export function isAttendanceStatus(value: string): value is AttendanceStatus {
  return ATTENDANCE_STATUS_OPTIONS.some((o) => o.value === value)
}

export function attendancePointsForStatus(status: AttendanceStatus): number {
  return ATTENDANCE_STATUS_OPTIONS.find((o) => o.value === status)?.points ?? 0
}

export function attendanceStatusLabel(status: string): string {
  return ATTENDANCE_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status
}

export function isAttendedAttendanceStatus(status: string): boolean {
  return status === "present" || status === "late" || status === "excused"
}

export function isMissedAttendanceStatus(status: string): boolean {
  return status === "absent"
}
