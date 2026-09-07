import { sql } from "@/lib/db"

export async function recordAttendanceAudit(params: {
  sessionId: number
  studentId: number
  originalStatus: string | null
  newStatus: string
  checkInTimestamp?: Date | null
  scheduleVersion?: number | null
  sessionType?: string | null
  instructorOverride?: boolean
  overrideReason?: string | null
  actorId?: number | null
}) {
  await sql`
    INSERT INTO attendance_audit_logs (
      session_id, student_id, original_status, new_status, check_in_timestamp,
      schedule_version, session_type, instructor_override, override_reason, actor_id
    ) VALUES (
      ${params.sessionId}, ${params.studentId}, ${params.originalStatus}, ${params.newStatus},
      ${params.checkInTimestamp ?? null}, ${params.scheduleVersion ?? null}, ${params.sessionType ?? null},
      ${params.instructorOverride === true}, ${params.overrideReason ?? null}, ${params.actorId ?? null}
    )
  `
}
