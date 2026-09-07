import { sql } from "@/lib/db"
import { ensureSyllabusSchema } from "@/lib/ensure-syllabus-schema"
import { getSyllabusByCourseId } from "@/lib/syllabus/syllabus-service"

/** Engagement credits awarded the first time a student views the published syllabus (one time only). */
export const SYLLABUS_VIEW_POINTS = 1.5

export type SyllabusViewResult = {
  recorded: boolean
  pointsAwarded: number
  alreadyViewed: boolean
  totalEngagementCredits?: number
}

export async function getSyllabusEngagementCredits(studentId: number): Promise<number> {
  try {
    await ensureSyllabusSchema()
    const result = await sql`
      SELECT COALESCE(SUM(points_awarded), 0) AS total
      FROM syllabus_views
      WHERE student_id = ${studentId}
        AND points_awarded > 0
    `
    return Number((result[0] as { total?: number })?.total) || 0
  } catch {
    return 0
  }
}

export async function recordSyllabusView(
  courseId: number,
  studentDbId: number,
  sessionId?: number | null,
): Promise<SyllabusViewResult> {
  await ensureSyllabusSchema()

  const syllabus = await getSyllabusByCourseId(courseId, sessionId)
  if (!syllabus || syllabus.status !== "published") {
    return { recorded: false, pointsAwarded: 0, alreadyViewed: false }
  }

  const revision = syllabus.updatedAt

  const priorAward = await sql`
    SELECT id FROM syllabus_views
    WHERE syllabus_id = ${syllabus.id}
      AND student_id = ${studentDbId}
      AND points_awarded > 0
    LIMIT 1
  `
  if (priorAward.length) {
    const totalEngagementCredits = await getSyllabusEngagementCredits(studentDbId)
    return {
      recorded: true,
      pointsAwarded: 0,
      alreadyViewed: true,
      totalEngagementCredits,
    }
  }

  const studentRows = await sql`
    SELECT section FROM students WHERE id = ${studentDbId} LIMIT 1
  `
  if (!studentRows.length) {
    return { recorded: false, pointsAwarded: 0, alreadyViewed: false }
  }
  const student = studentRows[0] as { section: string | null }
  const session = student.section?.trim() || "ALL"

  await sql`
    INSERT INTO syllabus_views (syllabus_id, student_id, syllabus_revision, points_awarded)
    VALUES (${syllabus.id}, ${studentDbId}, ${revision}::timestamptz, ${SYLLABUS_VIEW_POINTS})
    ON CONFLICT (syllabus_id, student_id, syllabus_revision) DO UPDATE
      SET points_awarded = EXCLUDED.points_awarded
      WHERE syllabus_views.points_awarded = 0
  `

  const insertedView = await sql`
    SELECT points_awarded FROM syllabus_views
    WHERE syllabus_id = ${syllabus.id}
      AND student_id = ${studentDbId}
      AND points_awarded > 0
    LIMIT 1
  `
  if (!insertedView.length) {
    return { recorded: true, pointsAwarded: 0, alreadyViewed: true }
  }

  try {
    const { recalculateAndSaveGrade } = await import("@/lib/grades")
    await recalculateAndSaveGrade(studentDbId, session)
  } catch {
    /* non-critical */
  }

  const { calculateEngagementCredits } = await import("@/lib/grades")
  const engagement = await calculateEngagementCredits(studentDbId, session)

  return {
    recorded: true,
    pointsAwarded: SYLLABUS_VIEW_POINTS,
    alreadyViewed: false,
    totalEngagementCredits: engagement.total_credits,
  }
}
