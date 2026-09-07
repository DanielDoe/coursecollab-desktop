/**
 * Shared personal calendar event create — used by calendar API paths and Cora confirm.
 */

import { sql } from "@/lib/db"

export type StudentCalendarEventInput = {
  studentDbId: number
  title: string
  description?: string | null
  eventType?: string
  startTime: string
  endTime?: string | null
  color?: string
  reminderMinutes?: number
}

export type StudentCalendarEventResult = {
  eventIds: number[]
  count: number
}

export async function createStudentCalendarEvents(
  events: StudentCalendarEventInput[],
): Promise<StudentCalendarEventResult> {
  if (!events.length) throw new Error("No calendar events to create.")
  if (events.length > 20) throw new Error("Max 20 calendar events per batch.")

  const eventIds: number[] = []
  for (const ev of events) {
    const title = String(ev.title ?? "").trim()
    const startTime = String(ev.startTime ?? "").trim()
    if (!title || !startTime) continue
    const eventType = String(ev.eventType ?? "study_session").trim() || "study_session"
    if (["class", "exam", "official"].includes(eventType.toLowerCase())) {
      throw new Error("Cannot create official course events via Cora.")
    }

    const endTime = ev.endTime ? String(ev.endTime).trim() : null
    const rows = endTime
      ? await sql`
          INSERT INTO calendar_events (
            student_id, title, description, event_type, start_time, end_time, color, reminder_minutes
          ) VALUES (
            ${ev.studentDbId},
            ${title.slice(0, 200)},
            ${ev.description ?? null},
            ${eventType},
            ${startTime}::timestamp,
            ${endTime}::timestamp,
            ${ev.color ?? "#8b5cf6"},
            ${ev.reminderMinutes ?? 30}
          )
          RETURNING id
        `
      : await sql`
          INSERT INTO calendar_events (
            student_id, title, description, event_type, start_time, end_time, color, reminder_minutes
          ) VALUES (
            ${ev.studentDbId},
            ${title.slice(0, 200)},
            ${ev.description ?? null},
            ${eventType},
            ${startTime}::timestamp,
            NULL,
            ${ev.color ?? "#8b5cf6"},
            ${ev.reminderMinutes ?? 30}
          )
          RETURNING id
        `
    const id = Number((rows as { id: number }[])[0]?.id)
    if (Number.isFinite(id)) eventIds.push(id)
  }

  if (!eventIds.length) throw new Error("No valid calendar events were created.")
  return { eventIds, count: eventIds.length }
}
