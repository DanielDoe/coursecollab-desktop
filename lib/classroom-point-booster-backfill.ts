import { sql } from "@/lib/db"
import {
  applyTimingBoosterBackfill,
  resolveClassroomSubmissionBooster,
} from "@/lib/classroom-point-booster"

export type ClassroomBoosterBackfillRow = {
  classroomPointId: number
  studentDbId: number
  previousPoints: number
  nextPoints: number
  previousBooster: number
  nextBooster: number
  updated: boolean
}

export async function backfillClassroomPointTimingBoosters(opts: {
  courseId?: number | null
  dryRun?: boolean
  limit?: number
}): Promise<{
  updated: ClassroomBoosterBackfillRow[]
  summary: { scanned: number; updated: number; unchanged: number }
}> {
  const limit = Math.min(Math.max(opts.limit ?? 500, 1), 2000)
  const courseId = opts.courseId ?? null

  const rows = (await sql`
    SELECT
      cp.id,
      cp.student_id,
      cp.points,
      cp.point_booster,
      cp.created_at,
      cp.submission_id,
      cps.created_at AS opened_at,
      COALESCE(cps.due_at, cps.created_at + ((COALESCE(cps.duration_hours, 168)) * INTERVAL '1 hour')) AS deadline
    FROM classroom_points cp
    INNER JOIN students s ON s.id = cp.student_id
    INNER JOIN classroom_point_submissions cps ON cps.id = cp.submission_id
    WHERE cp.category IN ('code_submission', 'solution_submission')
      AND cp.submission_id IS NOT NULL
      AND (${courseId}::int IS NULL OR s.course_id = ${courseId})
    ORDER BY cp.created_at DESC
    LIMIT ${limit}
  `) as Array<{
    id: number
    student_id: number
    points: number | string | null
    point_booster: number | null
    created_at: string | Date
    submission_id: number
    opened_at: string | Date
    deadline: string | Date | null
  }>

  const updated: ClassroomBoosterBackfillRow[] = []
  let unchanged = 0

  for (const row of rows) {
    const previousPoints = Number(row.points) || 0
    const previousBooster = Math.max(1, Number(row.point_booster) || 1)
    const nextBooster = resolveClassroomSubmissionBooster({
      submissionId: row.submission_id,
      openedAt: row.opened_at,
      deadline: row.deadline,
      submittedAt: row.created_at,
    })
    const next = applyTimingBoosterBackfill({
      storedPoints: previousPoints,
      storedBooster: previousBooster,
      nextBooster,
    })
    const result: ClassroomBoosterBackfillRow = {
      classroomPointId: row.id,
      studentDbId: row.student_id,
      previousPoints,
      nextPoints: next.points,
      previousBooster,
      nextBooster: next.booster,
      updated: next.changed,
    }
    if (!next.changed) {
      unchanged += 1
      continue
    }
    if (!opts.dryRun) {
      await sql`
        UPDATE classroom_points
        SET points = ${next.points}, point_booster = ${next.booster}
        WHERE id = ${row.id}
      `
    }
    updated.push(result)
  }

  return {
    updated,
    summary: {
      scanned: rows.length,
      updated: updated.length,
      unchanged,
    },
  }
}
