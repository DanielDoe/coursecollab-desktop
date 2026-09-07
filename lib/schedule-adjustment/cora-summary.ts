import { sql } from "@/lib/db"
import { ensureScheduleAdjustmentSchema } from "@/lib/ensure-schedule-adjustment-schema"

/** Summarize schedule adjustment state for Cora (read-only). */
export async function buildScheduleAdjustmentCoraSummary(courseId: number) {
  await ensureScheduleAdjustmentSchema()
  const rows = await sql`
    SELECT id, status, section_code, adjustment_mode,
           instructor_led_day, instructor_led_start_time, instructor_led_end_time,
           structured_session_day, structured_session_start_time, structured_session_end_time,
           effective_date
    FROM schedule_adjustment_requests
    WHERE course_id = ${courseId}
      AND status NOT IN ('CANCELLED', 'REJECTED', 'COMPLETED')
    ORDER BY created_at DESC
    LIMIT 1
  `
  if (!rows.length) return null

  const requestId = Number((rows[0] as { id: number }).id)
  const enrolled = await sql`
    SELECT COUNT(*)::int AS c FROM schedule_enrollment_snapshots WHERE request_id = ${requestId}
  `
  const responded = await sql`
    SELECT COUNT(*)::int AS c FROM schedule_availability_responses
    WHERE request_id = ${requestId} AND submitted_at IS NOT NULL
  `
  const unanimous = await sql`
    SELECT day_of_week, start_time, end_time, available_count, agreement_percentage
    FROM schedule_candidates
    WHERE request_id = ${requestId} AND consensus_category = 'unanimous'
    ORDER BY agreement_percentage DESC
    LIMIT 3
  `

  const total = Number((enrolled[0] as { c: number } | undefined)?.c ?? 0)
  const responseCount = Number((responded[0] as { c: number } | undefined)?.c ?? 0)

  return {
    requestId,
    status: (rows[0] as { status: string }).status,
    sectionCode: (rows[0] as { section_code: string | null }).section_code,
    adjustmentMode: (rows[0] as { adjustment_mode?: string }).adjustment_mode ?? "AVAILABILITY_BASED",
    instructorLed: {
      day: (rows[0] as { instructor_led_day?: string | null }).instructor_led_day,
      start: (rows[0] as { instructor_led_start_time?: string | null }).instructor_led_start_time,
      end: (rows[0] as { instructor_led_end_time?: string | null }).instructor_led_end_time,
    },
    structured: {
      day: (rows[0] as { structured_session_day?: string | null }).structured_session_day,
      start: (rows[0] as { structured_session_start_time?: string | null }).structured_session_start_time,
      end: (rows[0] as { structured_session_end_time?: string | null }).structured_session_end_time,
    },
    effectiveDate: (rows[0] as { effective_date?: string | null }).effective_date,
    enrolled: total,
    responded: responseCount,
    unanimousOptions: unanimous as Array<{
      day_of_week: string
      start_time: string
      end_time: string
      available_count: number
      agreement_percentage: number
    }>,
    disclaimer:
      "Cora uses the active CourseCollab schedule service. Cora can summarize the current or proposed arrangement, but cannot select, approve, consent to, or finalize schedule changes.",
  }
}
