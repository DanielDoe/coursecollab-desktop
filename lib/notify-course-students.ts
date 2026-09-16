import { sql } from "@/lib/db"
import {
  createBulkNotifications,
  createNotification,
  type CreateNotificationParams,
} from "@/lib/create-notification"

export type CourseNotifyPayload = {
  type: CreateNotificationParams["type"]
  title: string
  message: string
  link?: string
}

/** Resolve student DB ids for a course offering and optional section. */
export async function listStudentIdsForCourse(params: {
  courseId?: number | null
  sessionCode?: string | null
  sessionId?: number | null
}): Promise<number[]> {
  const courseId = params.courseId != null ? Number(params.courseId) : null
  const sessionId = params.sessionId != null ? Number(params.sessionId) : null
  const sessionCode = params.sessionCode?.trim() || null

  if (sessionId != null && Number.isFinite(sessionId) && sessionId > 0) {
    const rows = (await sql`
      SELECT id FROM students WHERE session_id = ${sessionId}
    `) as Array<{ id: number }>
    return rows.map((r) => Number(r.id)).filter((id) => id > 0)
  }

  if (sessionCode && courseId != null && Number.isFinite(courseId) && courseId > 0) {
    const rows = (await sql`
      SELECT s.id
      FROM students s
      INNER JOIN sessions sess ON sess.id = s.session_id
      WHERE sess.code = ${sessionCode}
        AND sess.course_id = ${courseId}
    `) as Array<{ id: number }>
    return rows.map((r) => Number(r.id)).filter((id) => id > 0)
  }

  if (sessionCode) {
    const rows = (await sql`
      SELECT s.id
      FROM students s
      INNER JOIN sessions sess ON sess.id = s.session_id
      WHERE sess.code = ${sessionCode}
    `) as Array<{ id: number }>
    return rows.map((r) => Number(r.id)).filter((id) => id > 0)
  }

  if (courseId != null && Number.isFinite(courseId) && courseId > 0) {
    const rows = (await sql`
      SELECT DISTINCT s.id
      FROM students s
      LEFT JOIN sessions sess ON sess.id = s.session_id
      WHERE sess.course_id = ${courseId}
         OR s.course_id = ${courseId}
    `) as Array<{ id: number }>
    return rows.map((r) => Number(r.id)).filter((id) => id > 0)
  }

  return []
}

export async function notifyStudents(
  studentIds: Array<number | string>,
  payload: CourseNotifyPayload,
): Promise<number> {
  const ids = [
    ...new Set(
      studentIds
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  ]
  if (ids.length === 0) return 0
  await createBulkNotifications(ids, {
    type: payload.type,
    title: payload.title,
    message: payload.message,
    link: payload.link,
  })
  return ids.length
}

export async function notifyCourseStudents(
  scope: {
    courseId?: number | null
    sessionCode?: string | null
    sessionId?: number | null
  },
  payload: CourseNotifyPayload,
): Promise<number> {
  const ids = await listStudentIdsForCourse(scope)
  return notifyStudents(ids, payload)
}

export async function notifyStudentQuietly(
  studentId: number,
  payload: CourseNotifyPayload,
): Promise<void> {
  if (!Number.isFinite(studentId) || studentId <= 0) return
  await createNotification({
    studentId,
    type: payload.type,
    title: payload.title,
    message: payload.message,
    link: payload.link,
  })
}

export function notificationTypeForAssessment(
  assessmentType: string | null | undefined,
): "quiz" | "homework" | "exam" {
  const t = String(assessmentType ?? "quiz").toLowerCase()
  if (t === "homework") return "homework"
  if (t.includes("mid") || t === "exam" || t === "final") return "exam"
  return "quiz"
}
