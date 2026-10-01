import { sql } from "@/lib/db"
import { runSchemaOnce } from "@/lib/schema-once"
import { DEFAULT_INSTITUTION_AI_POLICY, INSTITUTION_AI_POLICY_VERSION } from "@/lib/cora/governance/policy"

let ensured = false
let inflight: Promise<void> | null = null

/** Stage 6A: institution AI policy + deterministic Cora event tenant columns. */
export async function ensureStage6aCoraGovernance(): Promise<void> {
  if (ensured) return
  if (!inflight) {
    inflight = runSchemaOnce("stage6a-schema", ensureStage6aCoraGovernanceUnlocked).finally(() => {
      inflight = null
    })
  }
  return inflight
}

async function ensureStage6aCoraGovernanceUnlocked(): Promise<void> {
  if (ensured) return

  await sql`
    CREATE TABLE IF NOT EXISTS institution_ai_policies (
      institution_id INTEGER PRIMARY KEY REFERENCES universities(id) ON DELETE RESTRICT,
      enabled BOOLEAN NOT NULL DEFAULT true,
      student_use_allowed BOOLEAN NOT NULL DEFAULT true,
      faculty_use_allowed BOOLEAN NOT NULL DEFAULT true,
      allowed_providers TEXT[] NOT NULL DEFAULT ARRAY['OPENAI', 'ANTHROPIC']::text[],
      allowed_models TEXT[],
      conversation_logging BOOLEAN NOT NULL DEFAULT true,
      analytics_level TEXT NOT NULL DEFAULT 'operational',
      policy_version INTEGER NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`ALTER TABLE cora_interaction_events ADD COLUMN IF NOT EXISTS institution_id INTEGER`
  await sql`ALTER TABLE cora_interaction_events ADD COLUMN IF NOT EXISTS scope_kind TEXT`
  await sql`
    UPDATE cora_interaction_events e
    SET institution_id = c.university_id,
        scope_kind = 'institutional'
    FROM courses c
    WHERE e.course_id = c.id
      AND c.university_id IS NOT NULL
      AND e.institution_id IS NULL
  `
  await sql`
    UPDATE cora_interaction_events
    SET scope_kind = COALESCE(scope_kind, 'unscoped')
    WHERE institution_id IS NULL
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_cora_interaction_events_institution
    ON cora_interaction_events (institution_id)
    WHERE institution_id IS NOT NULL
  `

  await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON institution_ai_policies TO coursecollab_tenant`
  await sql`DROP POLICY IF EXISTS tenant_select_institution_ai_policies ON institution_ai_policies`
  await sql`DROP POLICY IF EXISTS tenant_write_institution_ai_policies ON institution_ai_policies`
  await sql`
    CREATE POLICY tenant_select_institution_ai_policies ON institution_ai_policies
    FOR SELECT USING (institution_id = current_app_institution_id())
  `
  await sql`
    CREATE POLICY tenant_write_institution_ai_policies ON institution_ai_policies
    FOR ALL USING (institution_id = current_app_institution_id())
    WITH CHECK (institution_id = current_app_institution_id())
  `
  await sql`ALTER TABLE institution_ai_policies ENABLE ROW LEVEL SECURITY`
  await sql`ALTER TABLE institution_ai_policies FORCE ROW LEVEL SECURITY`

  ensured = true
}

export async function readInstitutionAiPolicy(institutionId: number) {
  await ensureStage6aCoraGovernance()
  const rows = (await sql`
    SELECT institution_id, enabled, student_use_allowed, faculty_use_allowed,
           allowed_providers, allowed_models, conversation_logging, analytics_level, policy_version
    FROM institution_ai_policies
    WHERE institution_id = ${institutionId}
    LIMIT 1
  `) as {
    institution_id: number
    enabled: boolean
    student_use_allowed: boolean
    faculty_use_allowed: boolean
    allowed_providers: string[] | null
    allowed_models: string[] | null
    conversation_logging: boolean
    analytics_level: string
    policy_version: number
  }[]
  const row = rows[0]
  if (!row) {
    return { ...DEFAULT_INSTITUTION_AI_POLICY, institutionId }
  }
  return {
    institutionId,
    enabled: row.enabled !== false,
    studentUseAllowed: row.student_use_allowed !== false,
    facultyUseAllowed: row.faculty_use_allowed !== false,
    allowedProviders: row.allowed_providers?.length
      ? row.allowed_providers
      : DEFAULT_INSTITUTION_AI_POLICY.allowedProviders,
    allowedModels: row.allowed_models,
    conversationLogging: row.conversation_logging !== false,
    analyticsLevel: row.analytics_level === "none" ? "none" : "operational",
    policyVersion: Number(row.policy_version) || INSTITUTION_AI_POLICY_VERSION,
  }
}
