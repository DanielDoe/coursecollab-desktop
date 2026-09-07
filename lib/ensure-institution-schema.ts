import { sql } from "@/lib/db"

let ensured = false

/** Idempotent institutional licensing schema. Personal membership tables are never mutated. */
export async function ensureInstitutionSchema(): Promise<void> {
  if (ensured) return

  await sql`ALTER TABLE universities ADD COLUMN IF NOT EXISTS legal_name VARCHAR(255)`
  await sql`ALTER TABLE universities ADD COLUMN IF NOT EXISTS slug VARCHAR(128)`
  await sql`ALTER TABLE universities ADD COLUMN IF NOT EXISTS institution_type VARCHAR(32) NOT NULL DEFAULT 'university'`
  await sql`ALTER TABLE universities ADD COLUMN IF NOT EXISTS country VARCHAR(64)`
  await sql`ALTER TABLE universities ADD COLUMN IF NOT EXISTS state_region VARCHAR(64)`
  await sql`ALTER TABLE universities ADD COLUMN IF NOT EXISTS website VARCHAR(512)`
  await sql`ALTER TABLE universities ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'active'`
  await sql`ALTER TABLE universities ADD COLUMN IF NOT EXISTS logo_url VARCHAR(512)`

  await sql`
    UPDATE universities
    SET slug = LOWER(REPLACE(short_name, ' ', '-'))
    WHERE slug IS NULL OR TRIM(slug) = ''
  `
  await sql`UPDATE universities SET logo_url = logo WHERE logo_url IS NULL AND logo IS NOT NULL`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS universities_slug_uniq ON universities (LOWER(slug))`

  await sql`
    CREATE TABLE IF NOT EXISTS organization_units (
      id SERIAL PRIMARY KEY,
      institution_id INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
      parent_unit_id INTEGER REFERENCES organization_units(id) ON DELETE SET NULL,
      unit_type VARCHAR(32) NOT NULL,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(64),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_org_units_institution ON organization_units(institution_id)`

  await sql`
    CREATE TABLE IF NOT EXISTS institution_members (
      id SERIAL PRIMARY KEY,
      institution_id INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
      user_type VARCHAR(32) NOT NULL,
      user_id INTEGER NOT NULL,
      role VARCHAR(32) NOT NULL,
      organization_unit_id INTEGER REFERENCES organization_units(id) ON DELETE SET NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'invited',
      invited_by INTEGER,
      invited_at TIMESTAMPTZ,
      joined_at TIMESTAMPTZ,
      removed_at TIMESTAMPTZ,
      email VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (institution_id, user_type, user_id)
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_institution_members_email ON institution_members (LOWER(email))`
  await sql`CREATE INDEX IF NOT EXISTS idx_institution_members_user ON institution_members (user_type, user_id)`

  await sql`
    CREATE TABLE IF NOT EXISTS institution_licenses (
      id SERIAL PRIMARY KEY,
      institution_id INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
      plan_id VARCHAR(32) NOT NULL,
      license_type VARCHAR(32) NOT NULL DEFAULT 'program',
      start_date DATE,
      end_date DATE,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      seat_limit_students INTEGER,
      seat_limit_instructors INTEGER,
      scope_type VARCHAR(32) NOT NULL DEFAULT 'course',
      scope_id INTEGER,
      included_cora_credits INTEGER,
      billing_method VARCHAR(32) NOT NULL DEFAULT 'invoice',
      contract_status VARCHAR(32) NOT NULL DEFAULT 'draft',
      stripe_customer_id VARCHAR(255),
      stripe_subscription_id VARCHAR(255),
      purchase_order_id VARCHAR(128),
      invoice_id INTEGER,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_institution_licenses_inst ON institution_licenses(institution_id, status)`

  await sql`
    CREATE TABLE IF NOT EXISTS institution_license_scopes (
      id SERIAL PRIMARY KEY,
      license_id INTEGER NOT NULL REFERENCES institution_licenses(id) ON DELETE CASCADE,
      scope_type VARCHAR(32) NOT NULL,
      scope_id INTEGER,
      course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
      organization_unit_id INTEGER REFERENCES organization_units(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_license_scopes_license ON institution_license_scopes(license_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_license_scopes_course ON institution_license_scopes(course_id)`

  await sql`
    CREATE TABLE IF NOT EXISTS institution_quotes (
      id SERIAL PRIMARY KEY,
      institution_id INTEGER REFERENCES universities(id) ON DELETE SET NULL,
      contact_user_type VARCHAR(32),
      contact_user_id INTEGER,
      contact_email VARCHAR(255),
      contact_name VARCHAR(255),
      job_title VARCHAR(128),
      department VARCHAR(128),
      phone VARCHAR(64),
      plan_id VARCHAR(32) NOT NULL,
      seat_limit INTEGER,
      scope JSONB NOT NULL DEFAULT '{}'::jsonb,
      annual_price_cents INTEGER,
      setup_fee_cents INTEGER NOT NULL DEFAULT 0,
      ai_allowance INTEGER,
      discount_cents INTEGER NOT NULL DEFAULT 0,
      valid_until TIMESTAMPTZ,
      status VARCHAR(32) NOT NULL DEFAULT 'draft',
      notes TEXT,
      created_by INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS institution_invoices (
      id SERIAL PRIMARY KEY,
      institution_id INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
      license_id INTEGER REFERENCES institution_licenses(id) ON DELETE SET NULL,
      quote_id INTEGER REFERENCES institution_quotes(id) ON DELETE SET NULL,
      invoice_number VARCHAR(64),
      po_number VARCHAR(64),
      issue_date DATE,
      due_date DATE,
      amount_cents INTEGER NOT NULL DEFAULT 0,
      payment_status VARCHAR(32) NOT NULL DEFAULT 'pending',
      payment_date DATE,
      payment_reference VARCHAR(128),
      document_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS user_entitlements (
      id SERIAL PRIMARY KEY,
      user_type VARCHAR(32) NOT NULL,
      user_id INTEGER NOT NULL,
      institution_id INTEGER REFERENCES universities(id) ON DELETE SET NULL,
      organization_unit_id INTEGER REFERENCES organization_units(id) ON DELETE SET NULL,
      license_id INTEGER REFERENCES institution_licenses(id) ON DELETE SET NULL,
      scope_type VARCHAR(32) NOT NULL DEFAULT 'user',
      scope_id INTEGER,
      entitlement_type VARCHAR(64) NOT NULL,
      entitlement_source VARCHAR(32) NOT NULL,
      feature_bundle VARCHAR(64) NOT NULL,
      valid_from TIMESTAMPTZ,
      valid_until TIMESTAMPTZ,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      created_by INTEGER,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_user_entitlements_user ON user_entitlements (user_type, user_id, status)`

  await sql`
    CREATE TABLE IF NOT EXISTS institution_cora_allowances (
      id SERIAL PRIMARY KEY,
      institution_id INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
      license_id INTEGER REFERENCES institution_licenses(id) ON DELETE SET NULL,
      included_credits INTEGER NOT NULL DEFAULT 0,
      used_credits INTEGER NOT NULL DEFAULT 0,
      reserved_credits INTEGER NOT NULL DEFAULT 0,
      overage_enabled BOOLEAN NOT NULL DEFAULT false,
      overage_rate_cents INTEGER,
      reset_period VARCHAR(32) NOT NULL DEFAULT 'annual',
      reset_date DATE,
      allocation_policy VARCHAR(32) NOT NULL DEFAULT 'shared_pool',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS institution_cora_allowances_license_uidx
    ON institution_cora_allowances (license_id)
    WHERE license_id IS NOT NULL
  `

  await sql`
    CREATE TABLE IF NOT EXISTS institution_cora_usage (
      id SERIAL PRIMARY KEY,
      institution_id INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
      license_id INTEGER REFERENCES institution_licenses(id) ON DELETE SET NULL,
      user_type VARCHAR(32),
      user_id INTEGER,
      course_id INTEGER,
      workflow_type VARCHAR(64),
      model VARCHAR(128),
      credits INTEGER NOT NULL DEFAULT 0,
      estimated_cost_usd NUMERIC(12, 6),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_institution_cora_usage_inst ON institution_cora_usage (institution_id, created_at DESC)`

  await sql`
    CREATE TABLE IF NOT EXISTS institution_audit_logs (
      id SERIAL PRIMARY KEY,
      institution_id INTEGER REFERENCES universities(id) ON DELETE SET NULL,
      actor_user_type VARCHAR(32),
      actor_user_id INTEGER,
      action VARCHAR(64) NOT NULL,
      entity_type VARCHAR(64) NOT NULL,
      entity_id INTEGER,
      previous_value JSONB,
      new_value JSONB,
      reason TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS institution_access_requests (
      id SERIAL PRIMARY KEY,
      institution_name VARCHAR(255) NOT NULL,
      domain VARCHAR(255),
      institution_type VARCHAR(32),
      contact_name VARCHAR(255) NOT NULL,
      contact_email VARCHAR(255) NOT NULL,
      job_title VARCHAR(128),
      department VARCHAR(128),
      phone VARCHAR(64),
      estimated_students INTEGER,
      estimated_instructors INTEGER,
      desired_scope TEXT,
      desired_plan VARCHAR(32),
      request_kind VARCHAR(32) NOT NULL DEFAULT 'demo',
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`ALTER TABLE institution_licenses ADD COLUMN IF NOT EXISTS list_price_cents INTEGER`
  await sql`ALTER TABLE institution_licenses ADD COLUMN IF NOT EXISTS negotiated_price_cents INTEGER`
  await sql`ALTER TABLE institution_licenses ADD COLUMN IF NOT EXISTS discount_type VARCHAR(32)`
  await sql`ALTER TABLE institution_licenses ADD COLUMN IF NOT EXISTS discount_value INTEGER`
  await sql`ALTER TABLE institution_licenses ADD COLUMN IF NOT EXISTS discount_reason VARCHAR(64)`
  await sql`ALTER TABLE institution_licenses ADD COLUMN IF NOT EXISTS approved_by INTEGER`
  await sql`ALTER TABLE institution_licenses ADD COLUMN IF NOT EXISTS approval_date DATE`
  await sql`ALTER TABLE institution_licenses ADD COLUMN IF NOT EXISTS pricing_version INTEGER`
  await sql`ALTER TABLE institution_licenses ADD COLUMN IF NOT EXISTS billing_period VARCHAR(32) NOT NULL DEFAULT 'annual'`
  await sql`ALTER TABLE institution_licenses ADD COLUMN IF NOT EXISTS contract_term_months INTEGER NOT NULL DEFAULT 12`
  await sql`ALTER TABLE institution_licenses ADD COLUMN IF NOT EXISTS license_year VARCHAR(16)`
  await sql`ALTER TABLE institution_licenses ADD COLUMN IF NOT EXISTS renewal_type VARCHAR(32)`
  await sql`ALTER TABLE institution_licenses ADD COLUMN IF NOT EXISTS renewal_list_price_cents INTEGER`
  await sql`ALTER TABLE institution_licenses ADD COLUMN IF NOT EXISTS renewal_negotiated_price_cents INTEGER`
  await sql`ALTER TABLE institution_licenses ADD COLUMN IF NOT EXISTS renewal_date DATE`
  await sql`ALTER TABLE institution_licenses ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT false`
  await sql`ALTER TABLE institution_licenses ADD COLUMN IF NOT EXISTS renewal_notice_days INTEGER`
  await sql`ALTER TABLE institution_licenses ADD COLUMN IF NOT EXISTS founding_partner BOOLEAN NOT NULL DEFAULT false`
  await sql`ALTER TABLE institution_licenses ADD COLUMN IF NOT EXISTS quote_id INTEGER`

  await sql`ALTER TABLE institution_quotes ADD COLUMN IF NOT EXISTS list_price_cents INTEGER`
  await sql`ALTER TABLE institution_quotes ADD COLUMN IF NOT EXISTS discount_type VARCHAR(32)`
  await sql`ALTER TABLE institution_quotes ADD COLUMN IF NOT EXISTS discount_value INTEGER`
  await sql`ALTER TABLE institution_quotes ADD COLUMN IF NOT EXISTS negotiated_price_cents INTEGER`
  await sql`ALTER TABLE institution_quotes ADD COLUMN IF NOT EXISTS discount_reason VARCHAR(64)`
  await sql`ALTER TABLE institution_quotes ADD COLUMN IF NOT EXISTS approved_by INTEGER`
  await sql`ALTER TABLE institution_quotes ADD COLUMN IF NOT EXISTS approval_date DATE`
  await sql`ALTER TABLE institution_quotes ADD COLUMN IF NOT EXISTS pricing_version INTEGER`
  await sql`ALTER TABLE institution_quotes ADD COLUMN IF NOT EXISTS contract_term_months INTEGER NOT NULL DEFAULT 12`
  await sql`ALTER TABLE institution_quotes ADD COLUMN IF NOT EXISTS founding_partner BOOLEAN NOT NULL DEFAULT false`
  await sql`ALTER TABLE institution_quotes ADD COLUMN IF NOT EXISTS license_id INTEGER`

  await sql`ALTER TABLE institution_cora_allowances ADD COLUMN IF NOT EXISTS overage_unit VARCHAR(32)`
  await sql`ALTER TABLE institution_cora_allowances ADD COLUMN IF NOT EXISTS hard_limit BOOLEAN NOT NULL DEFAULT true`
  await sql`ALTER TABLE institution_cora_allowances ADD COLUMN IF NOT EXISTS soft_limit BOOLEAN NOT NULL DEFAULT false`
  await sql`ALTER TABLE institution_cora_allowances ADD COLUMN IF NOT EXISTS warning_thresholds JSONB NOT NULL DEFAULT '[70, 85, 95, 100]'::jsonb`
  await sql`ALTER TABLE institution_cora_allowances ADD COLUMN IF NOT EXISTS additional_credits_purchased INTEGER NOT NULL DEFAULT 0`

  await sql`
    CREATE TABLE IF NOT EXISTS institution_plan_pricing_versions (
      id SERIAL PRIMARY KEY,
      plan_id VARCHAR(32) NOT NULL,
      pricing_version INTEGER NOT NULL,
      list_price_cents INTEGER,
      student_capacity INTEGER,
      instructor_capacity INTEGER,
      included_cora_credits INTEGER,
      included_features JSONB NOT NULL DEFAULT '[]'::jsonb,
      effective_from DATE NOT NULL,
      effective_until DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (plan_id, pricing_version)
    )
  `

  await sql`
    INSERT INTO institution_plan_pricing_versions (
      plan_id, pricing_version, list_price_cents, student_capacity, instructor_capacity,
      included_cora_credits, effective_from, effective_until
    ) VALUES
      ('course_pilot', 2, 950000, 125, 3, 250000, '2026-08-26', NULL),
      ('program', 2, 1850000, 250, NULL, 500000, '2026-08-26', NULL),
      ('department', 2, 2950000, 500, NULL, 875000, '2026-08-26', NULL),
      ('department_plus', 2, 4950000, 1000, NULL, 1500000, '2026-08-26', NULL),
      ('college', 2, 8950000, 2500, NULL, 3000000, '2026-08-26', NULL),
      ('college_plus', 2, 14950000, 5000, NULL, 5000000, '2026-08-26', NULL),
      ('university_enterprise', 2, NULL, NULL, NULL, NULL, '2026-08-26', NULL)
    ON CONFLICT (plan_id, pricing_version) DO NOTHING
  `

  await sql`
    CREATE TABLE IF NOT EXISTS institution_admin_accounts (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS institution_admin_accounts_email_uniq ON institution_admin_accounts (LOWER(email))`
  await sql`ALTER TABLE institution_access_requests ADD COLUMN IF NOT EXISTS institution_id INTEGER REFERENCES universities(id) ON DELETE SET NULL`

  await sql`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id BIGSERIAL PRIMARY KEY,
      institution_id INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
      user_id INTEGER,
      user_type VARCHAR(32),
      course_id INTEGER,
      section_id INTEGER,
      session_id VARCHAR(128),
      event_type VARCHAR(64) NOT NULL,
      feature VARCHAR(64),
      workflow VARCHAR(64),
      concept_id VARCHAR(128),
      assessment_id INTEGER,
      question_id INTEGER,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      duration_ms INTEGER,
      metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      research_context_json JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_analytics_events_inst_time ON analytics_events (institution_id, occurred_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events (institution_id, event_type)`

  await sql`
    CREATE TABLE IF NOT EXISTS ai_learning_interactions (
      id BIGSERIAL PRIMARY KEY,
      institution_id INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
      research_student_id VARCHAR(64) NOT NULL,
      student_id INTEGER NOT NULL,
      course_id INTEGER,
      concept_id VARCHAR(128),
      session_id VARCHAR(128),
      cora_usage_id INTEGER,
      assessment_id INTEGER,
      assistance_type VARCHAR(64) NOT NULL DEFAULT 'other',
      assistance_depth SMALLINT NOT NULL DEFAULT 0,
      classification_confidence NUMERIC(4, 3),
      attempt_count_before_ai INTEGER,
      student_attempt_before_ai BOOLEAN,
      student_attempt_after_ai BOOLEAN,
      time_to_next_attempt_hours NUMERIC(10, 2),
      next_attempt_correct BOOLEAN,
      next_independent_score NUMERIC(6, 2),
      next_assessment_score NUMERIC(6, 2),
      delayed_assessment_score NUMERIC(6, 2),
      course_context_used BOOLEAN NOT NULL DEFAULT false,
      active_assessment_context BOOLEAN NOT NULL DEFAULT false,
      credits INTEGER,
      latency_ms INTEGER,
      metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_ai_learning_interactions_inst_time ON ai_learning_interactions (institution_id, created_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS idx_ai_learning_interactions_student ON ai_learning_interactions (institution_id, student_id, created_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS idx_ai_learning_interactions_type ON ai_learning_interactions (institution_id, assistance_type)`

  await sql`
    CREATE TABLE IF NOT EXISTS cora_usage_events (
      id BIGSERIAL PRIMARY KEY,
      institution_id INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
      usage_id INTEGER,
      user_type VARCHAR(32),
      user_id INTEGER,
      course_id INTEGER,
      workflow_type VARCHAR(64),
      tool_calls_count INTEGER NOT NULL DEFAULT 0,
      latency_ms INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_cora_usage_events_inst ON cora_usage_events (institution_id, created_at DESC)`

  await sql`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS ai_policy VARCHAR(32)`
  await sql`CREATE INDEX IF NOT EXISTS idx_quizzes_ai_policy ON quizzes (ai_policy) WHERE ai_policy IS NOT NULL`

  await sql`
    CREATE TABLE IF NOT EXISTS institution_interventions (
      id SERIAL PRIMARY KEY,
      institution_id INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
      course_id INTEGER,
      student_id INTEGER,
      trigger VARCHAR(64) NOT NULL DEFAULT 'manual',
      intervention_type VARCHAR(64) NOT NULL,
      channel VARCHAR(32),
      content_summary TEXT,
      cora_involved BOOLEAN NOT NULL DEFAULT false,
      triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      delivered_at TIMESTAMPTZ,
      viewed_at TIMESTAMPTZ,
      engaged_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_institution_interventions_inst ON institution_interventions (institution_id, triggered_at DESC)`

  await sql`
    CREATE TABLE IF NOT EXISTS institution_research_studies (
      id SERIAL PRIMARY KEY,
      institution_id INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      design VARCHAR(32) NOT NULL DEFAULT 'observational',
      status VARCHAR(32) NOT NULL DEFAULT 'draft',
      outcome_metric VARCHAR(64) NOT NULL DEFAULT 'assessment_score',
      from_date DATE,
      to_date DATE,
      authorization_note TEXT,
      assignment_changes_experience BOOLEAN NOT NULL DEFAULT false,
      created_by_user_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_institution_research_studies_inst ON institution_research_studies (institution_id, updated_at DESC)`

  await sql`
    CREATE TABLE IF NOT EXISTS institution_research_cohorts (
      id SERIAL PRIMARY KEY,
      study_id INTEGER NOT NULL REFERENCES institution_research_studies(id) ON DELETE CASCADE,
      institution_id INTEGER NOT NULL,
      name VARCHAR(120) NOT NULL,
      role_in_study VARCHAR(32) NOT NULL DEFAULT 'group',
      definition_type VARCHAR(32) NOT NULL DEFAULT 'roster',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_institution_research_cohorts_study ON institution_research_cohorts (study_id)`

  await sql`
    CREATE TABLE IF NOT EXISTS institution_research_export_logs (
      id SERIAL PRIMARY KEY,
      institution_id INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
      actor_user_id INTEGER,
      actor_email VARCHAR(255),
      dataset VARCHAR(64) NOT NULL,
      filters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      study_id VARCHAR(128),
      row_count INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS institution_research_models (
      id SERIAL PRIMARY KEY,
      institution_id INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
      name VARCHAR(200) NOT NULL,
      outcome VARCHAR(64) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'draft',
      algorithm VARCHAR(64),
      validation_design TEXT,
      held_out_n INTEGER,
      held_out_metric_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_institution_research_models_inst ON institution_research_models (institution_id, created_at DESC)`

  await sql`
    CREATE TABLE IF NOT EXISTS institution_research_instruments (
      id SERIAL PRIMARY KEY,
      institution_id INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
      study_id INTEGER REFERENCES institution_research_studies(id) ON DELETE CASCADE,
      instrument_role VARCHAR(16) NOT NULL CHECK (instrument_role IN ('pre', 'post')),
      quiz_id INTEGER,
      label VARCHAR(200) NOT NULL,
      max_score NUMERIC(8,2) NOT NULL DEFAULT 100,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (study_id, instrument_role)
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_institution_research_instruments_inst ON institution_research_instruments (institution_id, study_id)`

  await sql`
    CREATE TABLE IF NOT EXISTS institution_survey_instruments (
      id SERIAL PRIMARY KEY,
      institution_id INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
      name VARCHAR(200) NOT NULL,
      construct VARCHAR(64) NOT NULL,
      scale_min NUMERIC(8,2) NOT NULL DEFAULT 1,
      scale_max NUMERIC(8,2) NOT NULL DEFAULT 5,
      item_count INTEGER NOT NULL DEFAULT 0,
      source_citation TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_institution_survey_instruments_inst ON institution_survey_instruments (institution_id, construct)`

  await sql`
    CREATE TABLE IF NOT EXISTS institution_survey_responses (
      id SERIAL PRIMARY KEY,
      instrument_id INTEGER NOT NULL REFERENCES institution_survey_instruments(id) ON DELETE CASCADE,
      institution_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      course_id INTEGER,
      total_score NUMERIC(8,2) NOT NULL,
      item_scores_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_institution_survey_responses_inst ON institution_survey_responses (institution_id, instrument_id)`

  await sql`
    CREATE TABLE IF NOT EXISTS institution_equity_attributes (
      id SERIAL PRIMARY KEY,
      institution_id INTEGER NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL,
      attribute_key VARCHAR(64) NOT NULL,
      attribute_value VARCHAR(64) NOT NULL,
      authorized_by_user_id INTEGER,
      authorized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (institution_id, student_id, attribute_key)
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_institution_equity_attributes_inst ON institution_equity_attributes (institution_id, attribute_key, attribute_value)`

  try {
    await sql`ALTER TABLE auth_refresh_tokens DROP CONSTRAINT IF EXISTS auth_refresh_tokens_user_type_check`
    await sql`
      ALTER TABLE auth_refresh_tokens
      ADD CONSTRAINT auth_refresh_tokens_user_type_check
      CHECK (user_type IN ('student', 'instructor', 'admin', 'institution_admin'))
    `
  } catch (err) {
    console.warn("[institution-schema] auth_refresh_tokens user_type check", err)
  }

  ensured = true
}
