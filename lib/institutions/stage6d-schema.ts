import { sql } from "@/lib/db"
import { runSchemaOnce } from "@/lib/schema-once"
import { ensureStage6cStorageIsolation } from "@/lib/institutions/stage6c-schema"

let ensured = false
let inflight: Promise<void> | null = null

/**
 * Stage 6D: privileged audit columns + institution audit RLS (SELECT only).
 * Owner/BYPASSRLS still bypasses these policies.
 */
export async function ensureStage6dPrivilegedAudit(): Promise<void> {
  if (ensured) return
  if (!inflight) {
    inflight = runSchemaOnce("stage6d-schema", ensureStage6dPrivilegedAuditUnlocked).finally(() => {
      inflight = null
    })
  }
  return inflight
}

async function ensureStage6dPrivilegedAuditUnlocked(): Promise<void> {
  if (ensured) return
  await ensureStage6cStorageIsolation()

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
  await sql`ALTER TABLE security_audit_events ADD COLUMN IF NOT EXISTS institution_id INTEGER`
  await sql`ALTER TABLE security_audit_events ADD COLUMN IF NOT EXISTS reason_code VARCHAR(64)`
  await sql`ALTER TABLE security_audit_events ADD COLUMN IF NOT EXISTS event_scope VARCHAR(16)`
  await sql`ALTER TABLE security_audit_events ADD COLUMN IF NOT EXISTS request_id VARCHAR(128)`
  await sql`ALTER TABLE security_audit_events ADD COLUMN IF NOT EXISTS ip VARCHAR(128)`
  await sql`ALTER TABLE security_audit_events ADD COLUMN IF NOT EXISTS user_agent TEXT`
  await sql`CREATE INDEX IF NOT EXISTS idx_security_audit_created ON security_audit_events (created_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS idx_security_audit_action ON security_audit_events (action)`
  await sql`CREATE INDEX IF NOT EXISTS idx_security_audit_institution ON security_audit_events (institution_id)`

  await sql`ALTER TABLE institution_audit_logs ENABLE ROW LEVEL SECURITY`
  await sql`ALTER TABLE institution_audit_logs FORCE ROW LEVEL SECURITY`
  try {
    await sql`DROP POLICY IF EXISTS institution_audit_logs_tenant_select ON institution_audit_logs`
    await sql`
      CREATE POLICY institution_audit_logs_tenant_select ON institution_audit_logs
      FOR SELECT
      TO coursecollab_tenant
      USING (
        institution_id IS NOT NULL
        AND institution_id = public.current_app_institution_id()
      )
    `
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!/already exists/i.test(message)) throw error
  }
  await sql`REVOKE ALL ON TABLE institution_audit_logs FROM coursecollab_tenant`
  await sql`GRANT SELECT ON TABLE institution_audit_logs TO coursecollab_tenant`
  await sql`REVOKE ALL ON TABLE security_audit_events FROM coursecollab_tenant`

  await sql`ALTER TABLE codebench_submissions ADD COLUMN IF NOT EXISTS detailed_feedback TEXT`
  await sql`ALTER TABLE codebench_submissions ADD COLUMN IF NOT EXISTS classroom_point_id INTEGER`
  await sql`ALTER TABLE codebench_submissions ADD COLUMN IF NOT EXISTS authenticity_score INTEGER`
  await sql`ALTER TABLE codebench_submissions ADD COLUMN IF NOT EXISTS ai_likelihood DECIMAL(3,2)`
  await sql`ALTER TABLE codebench_submissions ADD COLUMN IF NOT EXISTS authorship_reasoning TEXT`
  await sql`ALTER TABLE codebench_submissions ADD COLUMN IF NOT EXISTS flagged_features TEXT[]`
  await sql`ALTER TABLE codebench_submissions ADD COLUMN IF NOT EXISTS ai_suspicion BOOLEAN DEFAULT false`

  ensured = true
}
