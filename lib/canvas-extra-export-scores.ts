import {
  calculateEngagementCredits,
  getAttendanceForCanvasExport,
  getClassroomPoints,
  getProjectScore,
  type AttendanceCanvasExportRosterContext,
  type StudentGradesCanvasSnapshot,
} from "@/lib/grades"
import { getStudentAttendanceSoFar } from "@/lib/attendance-percentage"
import type { CanvasExtraExportKey } from "@/lib/canvas-extra-export-columns"

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, Number(n) || 0))
}

async function resolveAttendanceExportPercent(
  studentId: number,
  sessionCode: string | null | undefined,
  attendanceRosterCtx: AttendanceCanvasExportRosterContext | null | undefined,
  gradeSnapshot: StudentGradesCanvasSnapshot | null | undefined,
): Promise<number> {
  if (gradeSnapshot?.attendance_manual_override) {
    return clampPct(gradeSnapshot.attendance_score)
  }

  const s = sessionCode && String(sessionCode).trim() ? String(sessionCode).trim() : undefined
  const live = await getStudentAttendanceSoFar(studentId, s)
  if (live.sessionsScoredSoFar > 0) {
    return clampPct(live.percentage)
  }

  if (gradeSnapshot != null) {
    return clampPct(gradeSnapshot.attendance_score)
  }

  return getAttendanceForCanvasExport(studentId, s, attendanceRosterCtx ?? null)
}

/**
 * 0–100 course % for Canvas assignment columns (row 2 “Points Possible” = 100 per column).
 * Attendance uses live QR roll data unless the grade row has attendance_manual_override.
 */
export async function getCanvasExtraExportScorePercent(
  studentId: number,
  sessionCode: string | null | undefined,
  key: CanvasExtraExportKey,
  attendanceRosterCtx?: AttendanceCanvasExportRosterContext | null,
  gradeSnapshot?: StudentGradesCanvasSnapshot | null,
): Promise<number> {
  if (key === "attendance") {
    return resolveAttendanceExportPercent(
      studentId,
      sessionCode,
      attendanceRosterCtx,
      gradeSnapshot,
    )
  }

  const s = sessionCode && String(sessionCode).trim() ? String(sessionCode).trim() : undefined

  if (key === "classroom") {
    /* Live approved classroom_points → 10-pt slice → 0–100% (never stale student_grades snapshot). */
    return getClassroomPoints(studentId, s)
  }

  if (gradeSnapshot != null) {
    switch (key) {
      case "project":
        return clampPct(gradeSnapshot.project_score)
      case "engagement":
        return Math.min(Number(gradeSnapshot.engagement_credits) || 0, 100)
    }
  }

  switch (key) {
    case "project":
      return getProjectScore(studentId, s)
    case "engagement": {
      const ec = await calculateEngagementCredits(studentId, s)
      return Math.min((ec.total_credits / 100) * 100, 100)
    }
    default:
      return 0
  }
}
