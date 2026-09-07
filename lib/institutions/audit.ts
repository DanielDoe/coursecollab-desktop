import { sql } from "@/lib/db"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"

export async function recordInstitutionAudit(input: {
  institutionId?: number | null
  actorUserType?: string | null
  actorUserId?: number | null
  action: string
  entityType: string
  entityId?: number | null
  previousValue?: unknown
  newValue?: unknown
  reason?: string | null
  metadata?: Record<string, unknown>
}): Promise<void> {
  await ensureInstitutionSchema()
  await sql`
    INSERT INTO institution_audit_logs (
      institution_id, actor_user_type, actor_user_id, action, entity_type, entity_id,
      previous_value, new_value, reason, metadata
    ) VALUES (
      ${input.institutionId ?? null},
      ${input.actorUserType ?? null},
      ${input.actorUserId ?? null},
      ${input.action},
      ${input.entityType},
      ${input.entityId ?? null},
      ${JSON.stringify(input.previousValue ?? null)}::jsonb,
      ${JSON.stringify(input.newValue ?? null)}::jsonb,
      ${input.reason ?? null},
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    )
  `
}
