import { sql } from "@/lib/db"

let ensured = false

export async function ensureProjectPhase3Schema(): Promise<void> {
  if (ensured) return

  await sql`
    ALTER TABLE course_project_assignments
      ADD COLUMN IF NOT EXISTS integrity_settings JSONB NOT NULL DEFAULT '{}'::jsonb
  `
  await sql`
    ALTER TABLE course_project_assignments
      ADD COLUMN IF NOT EXISTS ai_grading_settings JSONB NOT NULL DEFAULT '{}'::jsonb
  `
  await sql`
    ALTER TABLE course_project_assignments
      ADD COLUMN IF NOT EXISTS feedback_release JSONB NOT NULL DEFAULT '{}'::jsonb
  `

  await sql`
    CREATE TABLE IF NOT EXISTS project_ai_grading_runs (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      workspace_section_id INTEGER REFERENCES project_workspace_sections(id) ON DELETE SET NULL,
      run_kind VARCHAR(32) NOT NULL,
      scope VARCHAR(32) NOT NULL DEFAULT 'section',
      status VARCHAR(32) NOT NULL DEFAULT 'completed',
      model_id VARCHAR(128),
      prompt_version VARCHAR(32) NOT NULL DEFAULT 'v1',
      created_by_instructor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS project_ai_grading_results (
      id SERIAL PRIMARY KEY,
      run_id INTEGER NOT NULL REFERENCES project_ai_grading_runs(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      workspace_section_id INTEGER REFERENCES project_workspace_sections(id) ON DELETE SET NULL,
      suggested_score NUMERIC(8, 2) NOT NULL DEFAULT 0,
      max_score NUMERIC(8, 2) NOT NULL DEFAULT 0,
      rubric_results JSONB NOT NULL DEFAULT '[]'::jsonb,
      strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
      areas_for_improvement JSONB NOT NULL DEFAULT '[]'::jsonb,
      missing_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
      missing_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
      feedback TEXT,
      confidence NUMERIC(5, 4),
      requires_human_review BOOLEAN NOT NULL DEFAULT FALSE,
      raw_model_output JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS project_instructor_grade_entries (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      workspace_section_id INTEGER REFERENCES project_workspace_sections(id) ON DELETE SET NULL,
      instructor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
      score NUMERIC(8, 2) NOT NULL DEFAULT 0,
      max_score NUMERIC(8, 2) NOT NULL DEFAULT 0,
      feedback TEXT,
      ai_suggestion_result_id INTEGER REFERENCES project_ai_grading_results(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (project_id, workspace_section_id)
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS project_grading_audit_log (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      event_type VARCHAR(64) NOT NULL,
      actor_instructor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
      actor_student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
      comment TEXT,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS project_integrity_events (
      id SERIAL PRIMARY KEY,
      workspace_id INTEGER NOT NULL REFERENCES project_workspaces(id) ON DELETE CASCADE,
      workspace_section_id INTEGER REFERENCES project_workspace_sections(id) ON DELETE SET NULL,
      student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
      event_type VARCHAR(64) NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  ensured = true
}
