import { sql } from "@/lib/db"
import { createNotification } from "@/lib/create-notification"
import { createInstructorNotification } from "@/lib/create-instructor-notification"
import { instructorCanAccessCourse } from "@/lib/instructor-actor-scope"
import { studentBelongsToCourse } from "@/lib/instructor-course-scope"
import {
  ensureOfficeHoursCourseScopeColumns,
  hasOfficeHourRequestsCourseIdColumn,
  hasRegularOfficeHoursCourseIdColumn,
  officeHourRequestInCourseScope,
} from "@/lib/office-hours-course-scope"

export async function createOfficeHourMeetingRequest(params: {
  instructorId: number
  courseId: number
  studentId: number
  topic: string
  areaOfConcern?: string | null
  description?: string | null
  priority?: string | null
  preferredDates?: string[] | null
}): Promise<{ requestId: number; topic: string; href: string }> {
  const topic = String(params.topic ?? "").trim()
  if (!topic) throw new Error("topic is required.")

  const studentId = Number(params.studentId)
  if (!Number.isFinite(studentId) || studentId <= 0) throw new Error("studentId is required.")

  const allowed = await instructorCanAccessCourse(params.instructorId, params.courseId)
  if (!allowed) throw new Error("Instructor cannot create office hour requests for this course.")
  if (!(await studentBelongsToCourse(studentId, params.courseId))) {
    throw new Error("Student is not enrolled in this course.")
  }

  await ensureOfficeHoursCourseScopeColumns()
  const hasCourseCol = await hasOfficeHourRequestsCourseIdColumn()
  const priority = String(params.priority ?? "medium").trim() || "medium"

  const inserted = hasCourseCol
    ? ((await sql`
        INSERT INTO office_hour_requests (
          student_id, course_id, topic, area_of_concern, description, priority, status, instructor_id
        )
        VALUES (
          ${studentId},
          ${params.courseId},
          ${topic},
          ${params.areaOfConcern ?? null},
          ${params.description ?? null},
          ${priority},
          'pending',
          ${params.instructorId}
        )
        RETURNING id
      `) as { id: number }[])
    : ((await sql`
        INSERT INTO office_hour_requests (
          student_id, topic, area_of_concern, description, priority, status, instructor_id
        )
        VALUES (
          ${studentId},
          ${topic},
          ${params.areaOfConcern ?? null},
          ${params.description ?? null},
          ${priority},
          'pending',
          ${params.instructorId}
        )
        RETURNING id
      `) as { id: number }[])

  const requestId = Number(inserted[0]?.id ?? 0)
  if (!requestId) throw new Error("Failed to create office hour request.")

  const preferredDates = Array.isArray(params.preferredDates) ? params.preferredDates : []
  for (const d of preferredDates) {
    if (!d) continue
    await sql`
      INSERT INTO office_hour_preferred_dates (request_id, preferred_date)
      VALUES (${requestId}, ${new Date(d)})
    `
  }

  const student = (await sql`
    SELECT full_name, student_id FROM students WHERE id = ${studentId} LIMIT 1
  `) as { full_name?: string; student_id?: string }[]
  const name = student[0]?.full_name || student[0]?.student_id || "A student"
  try {
    await createInstructorNotification({
      type: "office_hour_request",
      title: `Office Hours Request: ${topic}`,
      message: `${name} — office hours requested for ${topic}.`,
      link: "/instructor/office-hours",
      source_type: "office_hour",
      source_id: String(requestId),
    })
  } catch {
    /* non-critical */
  }

  return { requestId, topic, href: "/module/office-hours" }
}

export async function updateOfficeHourRequest(params: {
  instructorId: number
  courseId: number
  requestId: number
  status: string
  scheduledDate?: string | null
  meetingLink?: string | null
  meetingVenue?: string | null
  instructorNotes?: string | null
}): Promise<{ requestId: number; status: string; href: string }> {
  const allowed = await instructorCanAccessCourse(params.instructorId, params.courseId)
  if (!allowed) throw new Error("Instructor cannot update office hour requests for this course.")

  const requestId = Number(params.requestId)
  if (!Number.isFinite(requestId) || requestId <= 0) throw new Error("requestId is required.")

  const inScope = await officeHourRequestInCourseScope(requestId, params.courseId)
  if (!inScope) throw new Error("Office hour request not found in this course.")

  const current = (await sql`
    SELECT * FROM office_hour_requests WHERE id = ${requestId} LIMIT 1
  `) as Record<string, unknown>[]
  if (current.length === 0) throw new Error("Office hour request not found.")

  const row = current[0]
  const newStatus = String(params.status ?? row.status ?? "pending")
  const newScheduled =
    params.scheduledDate !== undefined
      ? params.scheduledDate
        ? new Date(params.scheduledDate)
        : null
      : (row.scheduled_date as Date | null | undefined) ?? null
  const newLink =
    params.meetingLink !== undefined ? params.meetingLink || null : (row.meeting_link as string | null) ?? null
  const newVenue =
    params.meetingVenue !== undefined ? params.meetingVenue || null : (row.meeting_venue as string | null) ?? null
  const newNotes =
    params.instructorNotes !== undefined
      ? params.instructorNotes || null
      : (row.instructor_notes as string | null) ?? null

  const updated = (await sql`
    UPDATE office_hour_requests
    SET status = ${newStatus},
        scheduled_date = ${newScheduled},
        meeting_link = ${newLink},
        meeting_venue = ${newVenue},
        instructor_notes = ${newNotes},
        instructor_id = ${params.instructorId},
        updated_at = NOW()
    WHERE id = ${requestId}
    RETURNING id, status, student_id, topic, scheduled_date, meeting_link, meeting_venue
  `) as {
    id: number
    status: string
    student_id: number
    topic: string
    scheduled_date: Date | null
    meeting_link: string | null
    meeting_venue: string | null
  }[]

  const result = updated[0]
  if (!result) throw new Error("Failed to update office hour request.")

  if (["approved", "scheduled"].includes(newStatus)) {
    const details: string[] = []
    if (result.scheduled_date) {
      details.push(`Scheduled: ${new Date(result.scheduled_date).toLocaleString()}`)
    }
    if (result.meeting_link) details.push(`Meeting link: ${result.meeting_link}`)
    if (result.meeting_venue) details.push(`Venue: ${result.meeting_venue}`)
    const message = details.length
      ? `Your office hours request (${result.topic}) has been ${newStatus}. ${details.join(". ")}`
      : `Your office hours request (${result.topic}) has been ${newStatus}.`
    await createNotification({
      studentId: result.student_id,
      type: "office_hours",
      title: "Office Hours Update",
      message,
      link: "/student/dashboard-v2/office-hours",
    })
  }

  return { requestId: result.id, status: result.status, href: "/module/office-hours" }
}

export type RegularOfficeHourSlot = {
  dayOfWeek: number
  startTime: string
  endTime: string
}

export async function manageRegularOfficeHours(params: {
  instructorId: number
  courseId: number
  slots: RegularOfficeHourSlot[]
  semesterLabel?: string | null
}): Promise<{ slotCount: number; href: string }> {
  const allowed = await instructorCanAccessCourse(params.instructorId, params.courseId)
  if (!allowed) throw new Error("Instructor cannot manage office hours for this course.")

  await ensureOfficeHoursCourseScopeColumns()
  const hasCourseCol = await hasRegularOfficeHoursCourseIdColumn()
  if (!hasCourseCol) {
    throw new Error("Office hours course scope is not available yet.")
  }

  const slots = Array.isArray(params.slots) ? params.slots : []
  if (slots.length === 0) throw new Error("At least one availability slot is required.")

  const semesterLabel = String(params.semesterLabel ?? "current").trim() || "current"

  await sql`
    DELETE FROM regular_office_hours
    WHERE semester_label = ${semesterLabel}
      AND course_id = ${params.courseId}
  `

  let inserted = 0
  for (const slot of slots) {
    const dayOfWeek = Number(slot.dayOfWeek)
    const startTime = String(slot.startTime ?? "").trim()
    const endTime = String(slot.endTime ?? "").trim()
    if (!Number.isFinite(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 || !startTime || !endTime) {
      continue
    }
    await sql`
      INSERT INTO regular_office_hours (day_of_week, start_time, end_time, semester_label, course_id, updated_at)
      VALUES (${dayOfWeek}, ${startTime}, ${endTime}, ${semesterLabel}, ${params.courseId}, NOW())
    `
    inserted++
  }

  if (inserted === 0) throw new Error("No valid availability slots were provided.")

  return { slotCount: inserted, href: "/module/office-hours" }
}
