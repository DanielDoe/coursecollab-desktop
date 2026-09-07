import { sql } from "@/lib/db"
import { redactObject } from "@/lib/compliance/log-redact"

let schemaReady = false

export async function ensureSecurityAuditSchema(): Promise<void> {
  if (schemaReady) return
  await sql`
    CREATE TABLE IF NOT EXISTS security_audit_events (
      id BIGSERIAL PRIMARY KEY,
      actor_role VARCHAR(32),
      actor_id INTEGER,
      action VARCHAR(64) NOT NULL,
      resource_type VARCHAR(64),
      resource_id VARCHAR(64),
      outcome VARCHAR(16) NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_security_audit_created ON security_audit_events (created_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS idx_security_audit_action ON security_audit_events (action)`
  schemaReady = true
}

export async function recordSecurityEvent(input: {
  actorRole?: string | null
  actorId?: number | null
  action: string
  resourceType?: string | null
  resourceId?: string | number | null
  outcome: "success" | "denied" | "error"
  metadata?: Record<string, unknown>
}): Promise<void> {
  await ensureSecurityAuditSchema()
  const metadata = redactObject(input.metadata ?? {})
  await sql`
    INSERT INTO security_audit_events (
      actor_role, actor_id, action, resource_type, resource_id, outcome, metadata
    ) VALUES (
      ${input.actorRole ?? null},
      ${input.actorId ?? null},
      ${input.action},
      ${input.resourceType ?? null},
      ${input.resourceId == null ? null : String(input.resourceId)},
      ${input.outcome},
      ${JSON.stringify(metadata)}::jsonb
    )
  `
}
