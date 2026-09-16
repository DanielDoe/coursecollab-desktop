import { sql } from "@/lib/db"
import { createBulkNotifications } from "@/lib/create-notification"

type EligibleRow = {
  submission_id: number
  student_id: number
  title: string
  due_at: string
}

async function ensureClassroomPointsReminderSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS classroom_points_reminder_dispatches (
      id SERIAL PRIMARY KEY,
      submission_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      kind VARCHAR(32) NOT NULL,
      dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (submission_id, student_id, kind)
    )
  `
}

async function markDispatched(submissionId: number, studentIds: number[], kind: string): Promise<void> {
  for (const studentId of studentIds) {
    await sql`
      INSERT INTO classroom_points_reminder_dispatches (submission_id, student_id, kind)
      VALUES (${submissionId}, ${studentId}, ${kind})
      ON CONFLICT (submission_id, student_id, kind) DO NOTHING
    `
  }
}

/**
 * Due-soon reminders for classroom points posts (due_at or duration-based expiry).
 */
export async function dispatchClassroomPointsDueReminders(): Promise<{
  submissions: number
  notifications: number
}> {
  await ensureClassroomPointsReminderSchema()

  const rows = (await sql`
    SELECT DISTINCT
      cps.id AS submission_id,
      s.id AS student_id,
      cps.title,
      COALESCE(
        cps.due_at,
        cps.created_at + ((COALESCE(cps.duration_hours, 168)) * INTERVAL '1 hour')
      ) AS due_at
    FROM classroom_point_submissions cps
    INNER JOIN sessions sess ON sess.code = cps.session
    INNER JOIN students s ON s.session_id = sess.id
    WHERE COALESCE(cps.hidden_from_students, false) = false
      AND cps.session IS NOT NULL
      AND COALESCE(
        cps.due_at,
        cps.created_at + ((COALESCE(cps.duration_hours, 168)) * INTERVAL '1 hour')
      ) > NOW()
      AND COALESCE(
        cps.due_at,
        cps.created_at + ((COALESCE(cps.duration_hours, 168)) * INTERVAL '1 hour')
      ) <= NOW() + INTERVAL '24 hours'
      AND NOT EXISTS (
        SELECT 1
        FROM classroom_points cp
        WHERE cp.submission_id = cps.id
          AND cp.student_id = s.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM classroom_points_reminder_dispatches d
        WHERE d.submission_id = cps.id
          AND d.student_id = s.id
          AND d.kind = 'deadline_24h'
      )
  `) as EligibleRow[]

  const bySubmission = new Map<number, EligibleRow[]>()
  for (const row of rows) {
    const list = bySubmission.get(row.submission_id) ?? []
    list.push(row)
    bySubmission.set(row.submission_id, list)
  }

  let notifications = 0
  for (const [submissionId, group] of bySubmission) {
    const sample = group[0]
    const studentIds = [...new Set(group.map((r) => Number(r.student_id)).filter((id) => id > 0))]
    if (studentIds.length === 0) continue

    const msLeft = new Date(sample.due_at).getTime() - Date.now()
    const hoursLeft = Math.max(1, Math.round(msLeft / (1000 * 60 * 60)))

    await createBulkNotifications(studentIds, {
      type: "deadline",
      title: "Classroom points due soon",
      message: `"${sample.title}" is due in about ${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}.`,
      link: "/student/dashboard-v2/classroom-points",
    })
    await markDispatched(submissionId, studentIds, "deadline_24h")
    notifications += studentIds.length
  }

  return { submissions: bySubmission.size, notifications }
}
