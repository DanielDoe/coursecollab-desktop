import { sql } from "@/lib/db"
import { createBulkNotifications } from "@/lib/create-notification"

type EligibleRow = {
  project_id: number
  student_id: number
  title: string
  deadline: string
}

async function ensureProjectReminderSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS project_reminder_dispatches (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      kind VARCHAR(32) NOT NULL,
      dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (project_id, student_id, kind)
    )
  `
}

/** Due-soon reminders for project members. */
export async function dispatchProjectDueReminders(): Promise<{
  projects: number
  notifications: number
}> {
  await ensureProjectReminderSchema()

  const rows = (await sql`
    SELECT DISTINCT
      p.id AS project_id,
      pm.student_id,
      p.title,
      p.deadline
    FROM projects p
    INNER JOIN project_members pm ON pm.project_id = p.id
    WHERE p.deadline IS NOT NULL
      AND p.deadline > NOW()
      AND p.deadline <= NOW() + INTERVAL '24 hours'
      AND COALESCE(p.status, 'approved') NOT IN ('rejected', 'deleted')
      AND NOT EXISTS (
        SELECT 1
        FROM project_reminder_dispatches d
        WHERE d.project_id = p.id
          AND d.student_id = pm.student_id
          AND d.kind = 'deadline_24h'
      )
  `) as EligibleRow[]

  const byProject = new Map<number, EligibleRow[]>()
  for (const row of rows) {
    const list = byProject.get(row.project_id) ?? []
    list.push(row)
    byProject.set(row.project_id, list)
  }

  let notifications = 0
  for (const [projectId, group] of byProject) {
    const sample = group[0]
    const studentIds = [...new Set(group.map((r) => Number(r.student_id)).filter((id) => id > 0))]
    if (studentIds.length === 0) continue

    const msLeft = new Date(sample.deadline).getTime() - Date.now()
    const hoursLeft = Math.max(1, Math.round(msLeft / (1000 * 60 * 60)))

    await createBulkNotifications(studentIds, {
      type: "project",
      title: "Project deadline approaching",
      message: `"${sample.title}" is due in about ${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}.`,
      link: "/student/dashboard-v2/projects",
    })

    for (const studentId of studentIds) {
      await sql`
        INSERT INTO project_reminder_dispatches (project_id, student_id, kind)
        VALUES (${projectId}, ${studentId}, 'deadline_24h')
        ON CONFLICT (project_id, student_id, kind) DO NOTHING
      `
    }
    notifications += studentIds.length
  }

  return { projects: byProject.size, notifications }
}
