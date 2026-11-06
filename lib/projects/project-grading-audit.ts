import { sql } from "@/lib/db"
import { ensureProjectPhase3Schema } from "@/lib/ensure-project-phase3-schema"

export async function logProjectGradingAudit(params: {
  projectId: number
  eventType: string
  actorInstructorId?: number | null
  actorStudentId?: number | null
  comment?: string | null
  payload?: Record<string, unknown>
}) {
  await ensureProjectPhase3Schema()
  await sql`
    INSERT INTO project_grading_audit_log (
      project_id, event_type, actor_instructor_id, actor_student_id, comment, payload
    )
    VALUES (
      ${params.projectId},
      ${params.eventType},
      ${params.actorInstructorId ?? null},
      ${params.actorStudentId ?? null},
      ${params.comment ?? null},
      ${JSON.stringify(params.payload ?? {})}::jsonb
    )
  `
}
