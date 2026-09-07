import { sql } from "@/lib/db"

let ready = false

/** Idempotent schema for Cora AI usage + credit ledgers. */
export async function ensureCoraAiAccountingSchema(): Promise<void> {
  if (ready) return

  await sql`
    CREATE TABLE IF NOT EXISTS cora_agent_runs (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      user_role VARCHAR(16) NOT NULL,
      membership_tier VARCHAR(32),
      institution_id INTEGER,
      course_id INTEGER,
      section_id INTEGER,
      conversation_id TEXT,
      request_id TEXT,
      parent_run_id TEXT,
      feature VARCHAR(48) NOT NULL DEFAULT 'OTHER',
      module VARCHAR(64),
      status VARCHAR(24) NOT NULL DEFAULT 'running',
      model_calls INTEGER NOT NULL DEFAULT 0,
      tool_calls INTEGER NOT NULL DEFAULT 0,
      input_tokens BIGINT NOT NULL DEFAULT 0,
      cached_input_tokens BIGINT NOT NULL DEFAULT 0,
      output_tokens BIGINT NOT NULL DEFAULT 0,
      reasoning_tokens BIGINT NOT NULL DEFAULT 0,
      total_tokens BIGINT NOT NULL DEFAULT 0,
      provider_cost_usd NUMERIC(14, 8) NOT NULL DEFAULT 0,
      credits_charged INTEGER NOT NULL DEFAULT 0,
      latency_ms INTEGER,
      started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMPTZ,
      error_code TEXT
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS cora_usage_events (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      user_role VARCHAR(16) NOT NULL,
      membership_tier VARCHAR(32),
      institution_id INTEGER,
      course_id INTEGER,
      section_id INTEGER,
      conversation_id TEXT,
      request_id TEXT,
      agent_run_id TEXT REFERENCES cora_agent_runs(id) ON DELETE SET NULL,
      parent_run_id TEXT,
      feature VARCHAR(48) NOT NULL DEFAULT 'OTHER',
      module VARCHAR(64),
      operation VARCHAR(64),
      provider VARCHAR(16) NOT NULL DEFAULT 'OPENAI',
      model VARCHAR(128),
      routing_class VARCHAR(32),
      input_tokens INTEGER NOT NULL DEFAULT 0,
      cached_input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      reasoning_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      provider_cost_usd NUMERIC(14, 8) NOT NULL DEFAULT 0,
      internal_cost_usd NUMERIC(14, 8) NOT NULL DEFAULT 0,
      credits_charged INTEGER NOT NULL DEFAULT 0,
      billable BOOLEAN NOT NULL DEFAULT TRUE,
      tool_name VARCHAR(128),
      tool_calls_count INTEGER NOT NULL DEFAULT 0,
      status VARCHAR(24) NOT NULL DEFAULT 'success',
      error_code TEXT,
      latency_ms INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `

  await sql`
    CREATE INDEX IF NOT EXISTS cora_usage_events_user_created_idx
    ON cora_usage_events (user_role, user_id, created_at DESC)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS cora_usage_events_feature_created_idx
    ON cora_usage_events (feature, created_at DESC)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS cora_usage_events_agent_run_idx
    ON cora_usage_events (agent_run_id)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS cora_usage_events_model_created_idx
    ON cora_usage_events (model, created_at DESC)
  `

  await sql`
    CREATE TABLE IF NOT EXISTS cora_provider_charges (
      id BIGSERIAL PRIMARY KEY,
      usage_event_id BIGINT REFERENCES cora_usage_events(id) ON DELETE CASCADE,
      charge_type VARCHAR(32) NOT NULL,
      quantity NUMERIC(18, 6) NOT NULL DEFAULT 0,
      unit VARCHAR(32),
      cost_usd NUMERIC(14, 8) NOT NULL DEFAULT 0,
      provider VARCHAR(16) NOT NULL DEFAULT 'OPENAI',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS cora_credit_accounts (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      user_role VARCHAR(16) NOT NULL,
      membership_tier VARCHAR(32),
      included_balance INTEGER NOT NULL DEFAULT 0,
      purchased_balance INTEGER NOT NULL DEFAULT 0,
      reserved_credits INTEGER NOT NULL DEFAULT 0,
      period_key VARCHAR(32) NOT NULL,
      period_start TIMESTAMPTZ,
      period_end TIMESTAMPTZ,
      lifetime_credits_used BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_role, user_id)
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS cora_credit_transactions (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      user_role VARCHAR(16) NOT NULL,
      type VARCHAR(32) NOT NULL,
      amount INTEGER NOT NULL,
      included_delta INTEGER NOT NULL DEFAULT 0,
      purchased_delta INTEGER NOT NULL DEFAULT 0,
      usage_event_id BIGINT,
      purchase_id TEXT,
      agent_run_id TEXT,
      description TEXT,
      balance_after_included INTEGER,
      balance_after_purchased INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `

  await sql`
    CREATE INDEX IF NOT EXISTS cora_credit_tx_user_created_idx
    ON cora_credit_transactions (user_role, user_id, created_at DESC)
  `

  ready = true
}
