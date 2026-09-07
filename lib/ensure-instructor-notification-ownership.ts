import { sql } from "@/lib/db"

let ensured = false

/**
 * Runtime guard so deployments pick up the notification owner columns without a
 * manual migration step. Mirrors migrations/add-instructor-notification-ownership.sql.
 */
export async function ensureInstructorNotificationOwnershipColumns() {
  if (ensured) return
  try {
    await sql`ALTER TABLE instructor_notifications ADD COLUMN IF NOT EXISTS instructor_id INTEGER`
    await sql`ALTER TABLE instructor_notifications ADD COLUMN IF NOT EXISTS course_id INTEGER`
    await sql`
      CREATE INDEX IF NOT EXISTS idx_instructor_notifications_instructor
        ON instructor_notifications (instructor_id, created_at DESC)
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_instructor_notifications_course
        ON instructor_notifications (course_id, created_at DESC)
    `
    ensured = true
  } catch (error) {
    console.warn("[Notifications] ensure instructor notification ownership columns:", error)
  }
}

/**
 * Rows an instructor may see: their own, plus anything scoped to the course they
 * are currently teaching. Rows with no owner are excluded — they predate the
 * ownership columns and cannot be attributed to anyone.
 *
 * Built with sql.unsafe over truncated integers, matching the fragment pattern in
 * lib/office-hours-course-scope.ts (the driver does not compose tagged templates).
 */
export function instructorNotificationOwnershipSqlFragment(
  alias: string,
  instructorId: number,
  courseId?: number | null,
) {
  const table = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(alias) ? alias : "n"
  const iid = Math.trunc(Number(instructorId))
  if (!Number.isFinite(iid) || iid < 1) {
    return sql.unsafe(`(FALSE)`)
  }

  const cid = Math.trunc(Number(courseId))
  if (Number.isFinite(cid) && cid > 0) {
    return sql.unsafe(`(${table}.instructor_id = ${iid} OR ${table}.course_id = ${cid})`)
  }
  return sql.unsafe(`(${table}.instructor_id = ${iid})`)
}
