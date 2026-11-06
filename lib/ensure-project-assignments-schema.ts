import { sql } from "@/lib/db"

let ensured = false

/** Idempotent DDL for course project assignments (Phase 1). */
export async function ensureProjectAssignmentsSchema(): Promise<void> {
  if (ensured) return
  await sql`
    CREATE TABLE IF NOT EXISTS course_project_assignments (
      id SERIAL PRIMARY KEY,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      session VARCHAR(64),
      title VARCHAR(512) NOT NULL,
      description TEXT,
      instructions TEXT,
      project_mode VARCHAR(32) NOT NULL DEFAULT 'group',
      status VARCHAR(32) NOT NULL DEFAULT 'draft',
      available_from TIMESTAMPTZ,
      available_until TIMESTAMPTZ,
      due_at TIMESTAMPTZ,
      late_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
      min_group_size INTEGER,
      max_group_size INTEGER,
      counts_toward_course_grade BOOLEAN NOT NULL DEFAULT TRUE,
      max_points NUMERIC(8, 2) NOT NULL DEFAULT 50,
      required_deliverables JSONB NOT NULL DEFAULT '[]'::jsonb,
      resources JSONB NOT NULL DEFAULT '[]'::jsonb,
      resubmissions JSONB NOT NULL DEFAULT '{}'::jsonb,
      grading_mode VARCHAR(64) NOT NULL DEFAULT 'INSTRUCTOR_ONLY',
      grading_components JSONB NOT NULL DEFAULT '[]'::jsonb,
      rubric JSONB NOT NULL DEFAULT '{}'::jsonb,
      peer_voting JSONB NOT NULL DEFAULT '{}'::jsonb,
      submission JSONB NOT NULL DEFAULT '{}'::jsonb,
      presentation JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by_instructor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_course_project_assignments_course ON course_project_assignments (course_id)`
  await sql`
    ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS assignment_id INTEGER
      REFERENCES course_project_assignments(id) ON DELETE SET NULL
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_projects_assignment_id ON projects (assignment_id)`
  await sql`
    CREATE TABLE IF NOT EXISTS project_component_scores (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      component_key VARCHAR(64) NOT NULL,
      points_earned NUMERIC(8, 2) NOT NULL DEFAULT 0,
      points_possible NUMERIC(8, 2),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (project_id, component_key)
    )
  `
  ensured = true
}
