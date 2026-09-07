import { sql } from "@/lib/db"
import {
  CLASSROOM_BASE_POINTS,
  classroomPointsWithBooster,
} from "@/lib/classroom-point-booster"
import { ensureClassroomPointsSchema } from "@/lib/ensure-classroom-points-schema"
import { instructorCanAccessCourse } from "@/lib/instructor-actor-scope"
import { studentBelongsToCourse } from "@/lib/instructor-course-scope"
import {
  courseRequiresSubmissionSession,
  resolveDefaultCourseSession,
  sessionBelongsToCourse,
} from "@/lib/classroom-submission-scope"

export async function createClassroomPointsAssignment(params: {
  instructorId: number
  courseId: number
  title: string
  description?: string | null
  session?: string | null
  durationHours?: number | null
  dueAt?: string | null
  submissionKind?: string | null
}): Promise<{ submissionId: number; title: string; href: string }> {
  const title = String(params.title ?? "").trim()
  if (!title) throw new Error("Assignment title is required.")

  const allowed = await instructorCanAccessCourse(params.instructorId, params.courseId)
  if (!allowed) throw new Error("Instructor cannot create classroom assignments for this course.")

  let resolvedSession =
    typeof params.session === "string" && params.session.trim() && params.session.trim().toUpperCase() !== "ALL"
      ? params.session.trim()
      : null

  const requiresSession = await courseRequiresSubmissionSession(params.courseId)
  if (requiresSession && !resolvedSession) {
    resolvedSession = await resolveDefaultCourseSession(params.courseId)
  }
  if (requiresSession && !resolvedSession) {
    throw new Error("Session is required when creating assignments for this course.")
  }
  if (resolvedSession) {
    const sessionOk = await sessionBelongsToCourse(resolvedSession, params.courseId)
    if (!sessionOk) throw new Error("Session does not belong to the selected course.")
  }

  const description = params.description != null ? String(params.description) : null
  const duration =
    params.durationHours != null && params.durationHours > 0
      ? parseInt(String(params.durationHours), 10)
      : null
  let dueAtValue: Date | null = null
  if (params.dueAt) {
    const parsed = new Date(String(params.dueAt))
    if (Number.isNaN(parsed.getTime())) throw new Error("Invalid due date.")
    dueAtValue = parsed
  }
  const effectiveDuration = dueAtValue ? null : duration
  const kind =
    String(params.submissionKind ?? "code").trim().toLowerCase() === "solution" ? "solution" : "code"

  try {
    await sql`ALTER TABLE classroom_point_submissions ADD COLUMN IF NOT EXISTS submission_kind TEXT NOT NULL DEFAULT 'code'`
    await sql`ALTER TABLE classroom_point_submissions ADD COLUMN IF NOT EXISTS question_config JSONB`
    await sql`ALTER TABLE classroom_point_submissions ADD COLUMN IF NOT EXISTS due_at TIMESTAMP`
  } catch {
    /* schema may already exist */
  }

  const inserted = (await sql`
    INSERT INTO classroom_point_submissions (
      title,
      description,
      session,
      created_by,
      created_at,
      duration_hours,
      due_at,
      submission_kind
    ) VALUES (
      ${title},
      ${description},
      ${resolvedSession},
      ${params.instructorId},
      NOW(),
      ${effectiveDuration},
      ${dueAtValue},
      ${kind}
    )
    RETURNING id
  `) as { id: number }[]

  const submissionId = Number(inserted[0]?.id ?? 0)
  if (!submissionId) throw new Error("Failed to create classroom assignment.")

  return {
    submissionId,
    title,
    href: "/module/classroom-points",
  }
}

export async function approveClassroomPoint(params: {
  instructorId: number
  courseId: number
  pointId: number
  points?: number | null
}): Promise<{ pointId: number; points: number; href: string }> {
  await ensureClassroomPointsSchema()

  const allowed = await instructorCanAccessCourse(params.instructorId, params.courseId)
  if (!allowed) throw new Error("Instructor cannot approve classroom points for this course.")

  const pointId = Number(params.pointId)
  if (!Number.isFinite(pointId) || pointId <= 0) throw new Error("pointId is required.")

  const rows = (await sql`
    SELECT cp.id, cp.student_id, cp.points, cp.reason, cp.point_booster, cp.status, cp.category
    FROM classroom_points cp
    INNER JOIN students s ON s.id = cp.student_id
    LEFT JOIN sessions sess ON sess.id = s.session_id
    WHERE cp.id = ${pointId}
      AND cp.status = 'pending'
      AND cp.category IN ('code_submission', 'solution_submission')
      AND (s.course_id = ${params.courseId} OR sess.course_id = ${params.courseId})
    LIMIT 1
  `) as {
    id: number
    student_id: number
    points: number
    reason: string | null
    point_booster: number | null
    status: string
    category: string
  }[]

  if (rows.length === 0) {
    throw new Error("Pending classroom point not found in this course.")
  }

  const point = rows[0]
  const booster = Math.max(1, Number(point.point_booster) || 1)
  const pointsToAward =
    params.points != null && params.points > 0
      ? Number(params.points)
      : Number(point.points) > 0
        ? Number(point.points)
        : classroomPointsWithBooster(CLASSROOM_BASE_POINTS, booster)

  const updated = (await sql`
    UPDATE classroom_points
    SET status = 'approved',
        awarded_at = COALESCE(awarded_at, NOW()),
        points = ${pointsToAward}
    WHERE id = ${pointId}
      AND status = 'pending'
    RETURNING id, points
  `) as { id: number; points: number }[]

  if (updated.length === 0) throw new Error("Point not found or already approved.")

  try {
    await sql`
      UPDATE codebench_submissions
      SET status = 'approved',
          points_awarded = ${pointsToAward}
      WHERE classroom_point_id = ${pointId}
        AND status = 'pending'
    `
  } catch {
    /* non-critical */
  }

  return {
    pointId: updated[0].id,
    points: Number(updated[0].points),
    href: "/module/classroom-points",
  }
}

export async function awardClassroomPoints(params: {
  instructorId: number
  courseId: number
  studentId: number
  points: number
  reason: string
  category?: string | null
  session?: string | null
}): Promise<{ awardId: number; points: number; href: string }> {
  await ensureClassroomPointsSchema()

  const allowed = await instructorCanAccessCourse(params.instructorId, params.courseId)
  if (!allowed) throw new Error("Instructor cannot award classroom points for this course.")

  const studentId = Number(params.studentId)
  const points = Number(params.points)
  const reason = String(params.reason ?? "").trim()
  if (!Number.isFinite(studentId) || studentId <= 0) throw new Error("studentId is required.")
  if (!Number.isFinite(points) || points <= 0) throw new Error("Points must be greater than 0.")
  if (!reason) throw new Error("Reason is required.")

  if (!(await studentBelongsToCourse(studentId, params.courseId))) {
    throw new Error("Student is not enrolled in this course.")
  }

  let session = params.session != null ? String(params.session).trim() : ""
  if (!session) {
    session = (await resolveDefaultCourseSession(params.courseId)) ?? ""
  }
  if (!session) throw new Error("session is required.")

  const sessionOk = await sessionBelongsToCourse(session, params.courseId)
  if (!sessionOk) throw new Error("Session does not belong to the selected course.")

  const category = String(params.category ?? "other").trim() || "other"
  const inserted = (await sql`
    INSERT INTO classroom_points (
      student_id,
      points,
      reason,
      category,
      awarded_by,
      session,
      status
    ) VALUES (
      ${studentId},
      ${points},
      ${reason},
      ${category},
      ${params.instructorId},
      ${session},
      ${category === "code_submission" ? "pending" : "approved"}
    )
    RETURNING id, points
  `) as { id: number; points: number }[]

  const awardId = Number(inserted[0]?.id ?? 0)
  if (!awardId) throw new Error("Failed to award classroom points.")

  return {
    awardId,
    points: Number(inserted[0].points),
    href: "/module/classroom-points",
  }
}
