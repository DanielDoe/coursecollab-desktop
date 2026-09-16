import { sql } from "@/lib/db"

let ready = false

/** Structured Cora Insights events + daily rollups. Idempotent. */
export async function ensureCoraInsightsSchema(): Promise<void> {
  if (ready) return

  await sql`
    CREATE TABLE IF NOT EXISTS cora_interaction_events (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      course_id INTEGER,
      section_id INTEGER,
      conversation_id TEXT,
      assessment_id INTEGER,
      question_id INTEGER,
      question_type TEXT,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      interaction_category TEXT NOT NULL DEFAULT 'other',
      concept TEXT,
      subconcept TEXT,
      assistance_level SMALLINT,
      intent TEXT,
      answer_seeking_detected BOOLEAN NOT NULL DEFAULT false,
      answer_blocked BOOLEAN NOT NULL DEFAULT false,
      assessment_protected BOOLEAN NOT NULL DEFAULT false,
      attempt_before INTEGER,
      attempt_after INTEGER,
      correct_after BOOLEAN,
      independent_followup BOOLEAN,
      independent_correct BOOLEAN,
      latency_ms INTEGER,
      tokens_in INTEGER,
      tokens_out INTEGER,
      credits_used INTEGER,
      source TEXT NOT NULL DEFAULT 'usage',
      source_ref TEXT,
      metadata JSONB
    )
  `
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS cora_interaction_events_source_ref_uidx
    ON cora_interaction_events (source, source_ref)
    WHERE source_ref IS NOT NULL
  `.catch(() => undefined)
  await sql`
    CREATE INDEX IF NOT EXISTS cora_interaction_events_course_time_idx
    ON cora_interaction_events (course_id, occurred_at DESC)
  `.catch(() => undefined)
  await sql`
    CREATE INDEX IF NOT EXISTS cora_interaction_events_user_time_idx
    ON cora_interaction_events (user_id, occurred_at DESC)
  `.catch(() => undefined)
  await sql`
    CREATE INDEX IF NOT EXISTS cora_interaction_events_concept_idx
    ON cora_interaction_events (course_id, concept, occurred_at DESC)
  `.catch(() => undefined)

  await sql`
    CREATE TABLE IF NOT EXISTS cora_insights_daily (
      course_id INTEGER NOT NULL,
      day DATE NOT NULL,
      student_id INTEGER NOT NULL,
      concept TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'other',
      assistance_level SMALLINT NOT NULL DEFAULT 0,
      interactions INTEGER NOT NULL DEFAULT 0,
      answer_seeking INTEGER NOT NULL DEFAULT 0,
      answers_blocked INTEGER NOT NULL DEFAULT 0,
      known_after INTEGER NOT NULL DEFAULT 0,
      correct_after INTEGER NOT NULL DEFAULT 0,
      independent_known INTEGER NOT NULL DEFAULT 0,
      independent_correct INTEGER NOT NULL DEFAULT 0,
      tokens_in BIGINT NOT NULL DEFAULT 0,
      tokens_out BIGINT NOT NULL DEFAULT 0,
      credits_used INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (course_id, day, student_id, concept, category, assistance_level)
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS cora_insights_daily_course_day_idx
    ON cora_insights_daily (course_id, day)
  `

  ready = true
}
