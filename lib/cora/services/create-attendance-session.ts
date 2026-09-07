import crypto from "crypto"
import { sql } from "@/lib/db"
import { generateFallbackCode } from "@/lib/attendance-utils"
import { instructorCanAccessCourse } from "@/lib/instructor-actor-scope"

function generateQRCode(sessionId: number, section: string): string {
  const timestamp = Date.now()
  const random = crypto.randomBytes(16).toString("hex")
  return `ATTEND_${sessionId}_${section}_${timestamp}_${random}`
}

export async function createInstructorAttendanceSession(params: {
  instructorId: number
  courseId: number
  section: string
  classTitle: string
  startTime: string
  endTime: string
  requireLocation?: boolean
  locationLat?: number | null
  locationLong?: number | null
  radiusMeters?: number
  qrExpiryMinutes?: number
}): Promise<{ sessionId: number; classTitle: string; href: string }> {
  const section = String(params.section ?? "").trim()
  const classTitle = String(params.classTitle ?? "").trim()
  if (!section || !classTitle) {
    throw new Error("Section and class title are required.")
  }

  const allowed = await instructorCanAccessCourse(params.instructorId, params.courseId)
  if (!allowed) throw new Error("Instructor cannot create attendance for this course.")

  const inCourse = await sql`
    SELECT 1 FROM sessions
    WHERE course_id = ${params.courseId}
      AND TRIM(code) = TRIM(${section})
    LIMIT 1
  `
  if (inCourse.length === 0) {
    throw new Error("Section is not part of the selected course.")
  }

  const startTimeUTC = new Date(params.startTime)
  const endTimeUTC = new Date(params.endTime)
  if (Number.isNaN(startTimeUTC.getTime()) || Number.isNaN(endTimeUTC.getTime())) {
    throw new Error("Invalid start or end time.")
  }

  const requireLocation = params.requireLocation === true
  const locationLat = params.locationLat ?? null
  const locationLong = params.locationLong ?? null
  const radiusMeters = params.radiusMeters ?? 100
  const qrExpiryMinutes = params.qrExpiryMinutes ?? 30
  const qrExpiresAtUTC = new Date(endTimeUTC.getTime() + qrExpiryMinutes * 60000)

  if (requireLocation && (locationLat == null || locationLong == null)) {
    throw new Error("Location coordinates are required when location verification is enabled.")
  }

  const columnCheck = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'attendance_sessions'
      AND column_name IN ('fallback_code', 'require_location', 'course_id')
  `
  const columns = new Set(
    (columnCheck as { column_name: string }[]).map((row) => row.column_name),
  )
  const hasFallbackCode = columns.has("fallback_code")
  const hasRequireLocation = columns.has("require_location")
  const hasCourseId = columns.has("course_id")

  let inserted: { id: number }[]
  if (hasRequireLocation && hasCourseId) {
    inserted = (await sql`
      INSERT INTO attendance_sessions (
        instructor_id, section, class_title, start_time, end_time,
        require_location, location_lat, location_long, radius_meters,
        qr_code, qr_expires_at, is_active, course_id
      ) VALUES (
        ${params.instructorId}, ${section}, ${classTitle},
        ${startTimeUTC.toISOString()}::timestamp,
        ${endTimeUTC.toISOString()}::timestamp,
        ${requireLocation},
        ${requireLocation ? locationLat : null},
        ${requireLocation ? locationLong : null},
        ${requireLocation ? radiusMeters : null},
        'temp',
        ${qrExpiresAtUTC.toISOString()}::timestamp,
        true,
        ${params.courseId}
      )
      RETURNING id
    `) as { id: number }[]
  } else if (hasRequireLocation) {
    inserted = (await sql`
      INSERT INTO attendance_sessions (
        instructor_id, section, class_title, start_time, end_time,
        require_location, location_lat, location_long, radius_meters,
        qr_code, qr_expires_at, is_active
      ) VALUES (
        ${params.instructorId}, ${section}, ${classTitle},
        ${startTimeUTC.toISOString()}::timestamp,
        ${endTimeUTC.toISOString()}::timestamp,
        ${requireLocation},
        ${requireLocation ? locationLat : null},
        ${requireLocation ? locationLong : null},
        ${requireLocation ? radiusMeters : null},
        'temp',
        ${qrExpiresAtUTC.toISOString()}::timestamp,
        true
      )
      RETURNING id
    `) as { id: number }[]
  } else if (hasCourseId) {
    inserted = (await sql`
      INSERT INTO attendance_sessions (
        instructor_id, section, class_title, start_time, end_time,
        location_lat, location_long, radius_meters,
        qr_code, qr_expires_at, is_active, course_id
      ) VALUES (
        ${params.instructorId}, ${section}, ${classTitle},
        ${startTimeUTC.toISOString()}::timestamp,
        ${endTimeUTC.toISOString()}::timestamp,
        ${requireLocation ? locationLat : null},
        ${requireLocation ? locationLong : null},
        ${requireLocation ? radiusMeters : null},
        'temp',
        ${qrExpiresAtUTC.toISOString()}::timestamp,
        true,
        ${params.courseId}
      )
      RETURNING id
    `) as { id: number }[]
  } else {
    inserted = (await sql`
      INSERT INTO attendance_sessions (
        instructor_id, section, class_title, start_time, end_time,
        location_lat, location_long, radius_meters,
        qr_code, qr_expires_at, is_active
      ) VALUES (
        ${params.instructorId}, ${section}, ${classTitle},
        ${startTimeUTC.toISOString()}::timestamp,
        ${endTimeUTC.toISOString()}::timestamp,
        ${requireLocation ? locationLat : null},
        ${requireLocation ? locationLong : null},
        ${requireLocation ? radiusMeters : null},
        'temp',
        ${qrExpiresAtUTC.toISOString()}::timestamp,
        true
      )
      RETURNING id
    `) as { id: number }[]
  }

  const sessionId = Number(inserted[0]?.id)
  if (!Number.isFinite(sessionId) || sessionId <= 0) {
    throw new Error("Failed to create attendance session.")
  }

  const qrCode = generateQRCode(sessionId, section)
  if (hasFallbackCode) {
    const fallbackCode = generateFallbackCode(6)
    await sql`
      UPDATE attendance_sessions
      SET qr_code = ${qrCode}, fallback_code = ${fallbackCode}
      WHERE id = ${sessionId}
    `
  } else {
    await sql`
      UPDATE attendance_sessions
      SET qr_code = ${qrCode}
      WHERE id = ${sessionId}
    `
  }

  return {
    sessionId,
    classTitle,
    href: "/module/attendance",
  }
}
