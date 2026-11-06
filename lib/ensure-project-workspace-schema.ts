import { sql } from "@/lib/db"
import { ensureProjectAssignmentsSchema } from "@/lib/ensure-project-assignments-schema"

let workspaceEnsured = false

export async function ensureProjectWorkspaceSchema(): Promise<void> {
  await ensureProjectAssignmentsSchema()
  if (workspaceEnsured) return

  await sql`ALTER TABLE course_project_assignments ADD COLUMN IF NOT EXISTS submission_mode VARCHAR(48) NOT NULL DEFAULT 'FREEFORM_SUBMISSION'`
  await sql`ALTER TABLE course_project_assignments ADD COLUMN IF NOT EXISTS submission_workflow JSONB NOT NULL DEFAULT '{}'::jsonb`

  await sql`
    CREATE TABLE IF NOT EXISTS project_template_sections (
      id SERIAL PRIMARY KEY,
      assignment_id INTEGER NOT NULL REFERENCES course_project_assignments(id) ON DELETE CASCADE,
      section_key VARCHAR(64) NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      title VARCHAR(512) NOT NULL,
      instructions TEXT,
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (assignment_id, section_key)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS project_workspaces (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
      assignment_id INTEGER REFERENCES course_project_assignments(id) ON DELETE SET NULL,
      submission_status VARCHAR(48) NOT NULL DEFAULT 'DRAFT',
      submission_workflow JSONB NOT NULL DEFAULT '{}'::jsonb,
      collab_doc_version INTEGER NOT NULL DEFAULT 0,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      submitted_at TIMESTAMPTZ,
      finalized_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS project_workspace_sections (
      id SERIAL PRIMARY KEY,
      workspace_id INTEGER NOT NULL REFERENCES project_workspaces(id) ON DELETE CASCADE,
      template_section_id INTEGER REFERENCES project_template_sections(id) ON DELETE SET NULL,
      section_key VARCHAR(64) NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      title VARCHAR(512) NOT NULL,
      instructions TEXT,
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      status VARCHAR(32) NOT NULL DEFAULT 'NOT_STARTED',
      current_revision_id INTEGER,
      yjs_state BYTEA,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, section_key)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS project_section_revisions (
      id SERIAL PRIMARY KEY,
      workspace_section_id INTEGER NOT NULL REFERENCES project_workspace_sections(id) ON DELETE CASCADE,
      revision_number INTEGER NOT NULL,
      content JSONB NOT NULL DEFAULT '{"blocks":[]}'::jsonb,
      change_summary TEXT,
      created_by_student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
      created_by_instructor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_section_id, revision_number)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS project_workspace_comments (
      id SERIAL PRIMARY KEY,
      workspace_section_id INTEGER NOT NULL REFERENCES project_workspace_sections(id) ON DELETE CASCADE,
      author_student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
      author_instructor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
      body TEXT NOT NULL,
      parent_comment_id INTEGER REFERENCES project_workspace_comments(id) ON DELETE CASCADE,
      resolved_at TIMESTAMPTZ,
      resolved_by_student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
      resolved_by_instructor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS project_workspace_references (
      id SERIAL PRIMARY KEY,
      workspace_id INTEGER NOT NULL REFERENCES project_workspaces(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      authors TEXT,
      year INTEGER,
      source TEXT,
      url TEXT,
      doi TEXT,
      created_by_student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS project_workspace_files (
      id SERIAL PRIMARY KEY,
      workspace_id INTEGER NOT NULL REFERENCES project_workspaces(id) ON DELETE CASCADE,
      workspace_section_id INTEGER REFERENCES project_workspace_sections(id) ON DELETE SET NULL,
      file_name VARCHAR(512) NOT NULL,
      storage_url TEXT NOT NULL,
      mime_type VARCHAR(128),
      byte_size INTEGER,
      evidence_kind VARCHAR(64),
      uploaded_by_student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS project_activity_events (
      id SERIAL PRIMARY KEY,
      workspace_id INTEGER NOT NULL REFERENCES project_workspaces(id) ON DELETE CASCADE,
      workspace_section_id INTEGER REFERENCES project_workspace_sections(id) ON DELETE SET NULL,
      event_type VARCHAR(64) NOT NULL,
      actor_student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
      actor_instructor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
      summary TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS project_submission_confirmations (
      workspace_id INTEGER NOT NULL REFERENCES project_workspaces(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (workspace_id, student_id)
    )
  `

  await sql`ALTER TABLE project_workspace_comments ALTER COLUMN workspace_section_id DROP NOT NULL`
  await sql`ALTER TABLE project_workspace_comments ADD COLUMN IF NOT EXISTS workspace_id INTEGER REFERENCES project_workspaces(id) ON DELETE CASCADE`
  await sql`ALTER TABLE project_workspace_comments ADD COLUMN IF NOT EXISTS topic VARCHAR(32)`
  await sql`
    UPDATE project_workspace_comments c
    SET workspace_id = ws.workspace_id
    FROM project_workspace_sections ws
    WHERE c.workspace_section_id = ws.id AND c.workspace_id IS NULL
  `

  workspaceEnsured = true
}
