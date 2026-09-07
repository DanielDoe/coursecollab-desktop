import { sql } from "@/lib/db"
import { ensureScheduleAdjustmentSchema } from "@/lib/ensure-schedule-adjustment-schema"

export async function logScheduleAudit(params: {
  requestId: number
  actorId?: number | null
  actorRole?: string | null
  action: string
  metadata?: Record<string, unknown>
}) {
  await ensureScheduleAdjustmentSchema()
  await sql`
    INSERT INTO schedule_audit_logs (request_id, actor_id, actor_role, action, metadata)
    VALUES (
      ${params.requestId},
      ${params.actorId ?? null},
      ${params.actorRole ?? null},
      ${params.action},
      ${JSON.stringify(params.metadata ?? {})}::jsonb
    )
  `
}

export async function getAuditLogs(requestId: number) {
  const rows = await sql`
    SELECT id, actor_id, actor_role, action, metadata, created_at
    FROM schedule_audit_logs
    WHERE request_id = ${requestId}
    ORDER BY created_at ASC
  `
  return rows
}
