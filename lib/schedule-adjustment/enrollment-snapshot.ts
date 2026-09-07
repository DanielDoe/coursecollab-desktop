import { sql } from "@/lib/db"
import { ensureScheduleAdjustmentSchema } from "@/lib/ensure-schedule-adjustment-schema"

export type EnrolledStudentRow = {
  student_id: number
  enrollment_id: number | null
  student_display_name: string
  course_id: number
  section_id: number | null
  section_code: string | null
  enrollment_status: string
}

export function snapshotSectionIdForRequest(
  sectionCode: string | null | undefined,
  sectionId: number | null,
) {
  return sectionCode?.trim().toUpperCase() === "BETA" ? null : sectionId
}

export async function listEnrolledStudentsForCourse(
  courseId: number,
  sectionId?: number | null,
): Promise<EnrolledStudentRow[]> {
  await ensureScheduleAdjustmentSchema()

  const rows = await sql`
    SELECT
      s.id AS student_id,
      s.id AS enrollment_id,
      COALESCE(NULLIF(TRIM(s.full_name), ''), s.student_id) AS student_display_name,
      COALESCE(s.course_id, sess.course_id) AS course_id,
      s.session_id AS section_id,
      COALESCE(sess.code, s.section) AS section_code,
      CASE WHEN s.deleted_at IS NULL THEN 'active' ELSE 'inactive' END AS enrollment_status
    FROM students s
    LEFT JOIN sessions sess ON sess.id = s.session_id
    WHERE s.deleted_at IS NULL
      AND COALESCE(s.course_id, sess.course_id) = ${courseId}
    ORDER BY s.full_name ASC NULLS LAST, s.student_id ASC
  `

  let filtered = rows as EnrolledStudentRow[]
  if (sectionId != null) {
    const sectionBelongs = (await sql`
      SELECT id FROM sessions
      WHERE id = ${sectionId} AND course_id = ${courseId}
      LIMIT 1
    `) as { id: number }[]
    if (sectionBelongs.length > 0) {
      filtered = filtered.filter((r) => r.section_id === sectionId)
    }
  }
  return filtered
}

export async function createEnrollmentSnapshot(requestId: number, courseId: number, sectionId?: number | null) {
  const students = await listEnrolledStudentsForCourse(courseId, sectionId)
  const keepIds = students.map((s) => s.student_id)
  if (keepIds.length > 0) {
    await sql`
      DELETE FROM schedule_availability_responses
      WHERE request_id = ${requestId}
        AND NOT (student_id = ANY(${keepIds}::int[]))
    `
    await sql`
      DELETE FROM schedule_enrollment_snapshots
      WHERE request_id = ${requestId}
        AND NOT (student_id = ANY(${keepIds}::int[]))
    `
  }
  for (const s of students) {
    await sql`
      INSERT INTO schedule_enrollment_snapshots (
        request_id, student_id, enrollment_id, student_display_name,
        course_id, section_id, section_code, enrollment_status
      ) VALUES (
        ${requestId}, ${s.student_id}, ${s.enrollment_id}, ${s.student_display_name},
        ${s.course_id}, ${s.section_id}, ${s.section_code}, ${s.enrollment_status}
      )
      ON CONFLICT (request_id, student_id) DO UPDATE SET
        student_display_name = EXCLUDED.student_display_name,
        section_id = EXCLUDED.section_id,
        section_code = EXCLUDED.section_code,
        enrollment_status = EXCLUDED.enrollment_status,
        snapshot_at = NOW()
    `
  }
  return students.length
}

export async function getSnapshotStudents(requestId: number): Promise<EnrolledStudentRow[]> {
  const rows = await sql`
    SELECT
      student_id,
      enrollment_id,
      student_display_name,
      course_id,
      section_id,
      section_code,
      enrollment_status
    FROM schedule_enrollment_snapshots
    WHERE request_id = ${requestId}
    ORDER BY student_display_name ASC
  `
  return rows as EnrolledStudentRow[]
}

export type EnrollmentDelta = {
  originalCount: number
  currentCount: number
  added: EnrolledStudentRow[]
  dropped: EnrolledStudentRow[]
  changed: boolean
}

export async function compareEnrollmentDelta(
  requestId: number,
  courseId: number,
  sectionId?: number | null,
): Promise<EnrollmentDelta> {
  const snapshot = await getSnapshotStudents(requestId)
  const current = await listEnrolledStudentsForCourse(courseId, sectionId)
  const snapshotIds = new Set(snapshot.map((s) => s.student_id))
  const currentIds = new Set(current.map((s) => s.student_id))

  const added = current.filter((s) => !snapshotIds.has(s.student_id))
  const dropped = snapshot.filter((s) => !currentIds.has(s.student_id))

  return {
    originalCount: snapshot.length,
    currentCount: current.length,
    added,
    dropped,
    changed: added.length > 0 || dropped.length > 0,
  }
}

export async function refreshEnrollmentSnapshotForConsent(
  requestId: number,
  courseId: number,
  sectionId?: number | null,
) {
  const current = await listEnrolledStudentsForCourse(courseId, sectionId)
  const currentIds = current.map((s) => s.student_id)

  if (currentIds.length > 0) {
    await sql`
      DELETE FROM schedule_enrollment_snapshots
      WHERE request_id = ${requestId}
        AND NOT (student_id = ANY(${currentIds}::int[]))
    `
  }
  for (const s of current) {
    await sql`
      INSERT INTO schedule_enrollment_snapshots (
        request_id, student_id, enrollment_id, student_display_name,
        course_id, section_id, section_code, enrollment_status
      ) VALUES (
        ${requestId}, ${s.student_id}, ${s.enrollment_id}, ${s.student_display_name},
        ${s.course_id}, ${s.section_id}, ${s.section_code}, ${s.enrollment_status}
      )
      ON CONFLICT (request_id, student_id) DO UPDATE SET
        student_display_name = EXCLUDED.student_display_name,
        section_id = EXCLUDED.section_id,
        section_code = EXCLUDED.section_code,
        enrollment_status = EXCLUDED.enrollment_status,
        snapshot_at = NOW()
    `
  }

  await sql`
    INSERT INTO schedule_consents (request_id, student_id, status, document_version)
    SELECT ${requestId}, s.student_id, 'pending', r.consent_document_version
    FROM schedule_enrollment_snapshots s
    JOIN schedule_adjustment_requests r ON r.id = ${requestId}
    WHERE s.request_id = ${requestId}
    ON CONFLICT (request_id, student_id, document_version) DO NOTHING
  `

  return current.length
}
