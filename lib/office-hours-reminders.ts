import { sql } from "@/lib/db"
import { createNotification } from "@/lib/create-notification"

async function ensureOfficeHoursReminderSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS office_hours_reminder_dispatches (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      kind VARCHAR(32) NOT NULL,
      dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (request_id, student_id, kind)
    )
  `
}

/** Remind students ~1 hour before scheduled office hours. */
export async function dispatchOfficeHoursReminders(): Promise<{ sent: number; scanned: number }> {
  await ensureOfficeHoursReminderSchema()

  const rows = (await sql`
    SELECT
      ohr.id AS request_id,
      ohr.student_id,
      ohr.topic,
      ohr.scheduled_date,
      ohr.meeting_link,
      ohr.meeting_venue
    FROM office_hour_requests ohr
    WHERE ohr.status IN ('approved', 'scheduled')
      AND ohr.scheduled_date IS NOT NULL
      AND ohr.scheduled_date > NOW()
      AND ohr.scheduled_date <= NOW() + INTERVAL '75 minutes'
      AND ohr.scheduled_date > NOW() + INTERVAL '15 minutes'
      AND NOT EXISTS (
        SELECT 1
        FROM office_hours_reminder_dispatches d
        WHERE d.request_id = ohr.id
          AND d.student_id = ohr.student_id
          AND d.kind = 'upcoming_1h'
      )
    LIMIT 200
  `) as Array<{
    request_id: number
    student_id: number
    topic: string
    scheduled_date: string
    meeting_link: string | null
    meeting_venue: string | null
  }>

  let sent = 0
  for (const row of rows) {
    const when = new Date(row.scheduled_date).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
    const details: string[] = [`Starts ${when}`]
    if (row.meeting_link) details.push(`Link: ${row.meeting_link}`)
    if (row.meeting_venue) details.push(`Venue: ${row.meeting_venue}`)

    await createNotification({
      studentId: row.student_id,
      type: "office_hours",
      title: "Office hours soon",
      message: `${row.topic}: ${details.join(". ")}`,
      link: "/student/dashboard-v2/office-hours",
    })

    await sql`
      INSERT INTO office_hours_reminder_dispatches (request_id, student_id, kind)
      VALUES (${row.request_id}, ${row.student_id}, 'upcoming_1h')
      ON CONFLICT (request_id, student_id, kind) DO NOTHING
    `
    sent += 1
  }

  return { sent, scanned: rows.length }
}
