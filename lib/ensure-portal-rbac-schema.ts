import { sql } from "@/lib/db"
import { ensurePortalRbacSeed } from "@/lib/ensure-portal-rbac-seed"

let ddlEnsured = false

/** Lightweight runtime guard — full DDL lives in migrations/portal-rbac/*.sql */
export async function ensurePortalRbacSchema(): Promise<void> {
  if (!ddlEnsured) {
  await sql`
    CREATE TABLE IF NOT EXISTS permissions (
      id SERIAL PRIMARY KEY,
      code VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id SERIAL PRIMARY KEY,
      role VARCHAR(50) NOT NULL,
      permission_code VARCHAR(100) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (role, permission_code)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS course_staff (
      id SERIAL PRIMARY KEY,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      instructor_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
      role VARCHAR(50) NOT NULL,
      assigned_by INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (course_id, instructor_id)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS course_staff_permissions (
      id SERIAL PRIMARY KEY,
      course_staff_id INTEGER NOT NULL REFERENCES course_staff(id) ON DELETE CASCADE,
      permission_code VARCHAR(100) NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (course_staff_id, permission_code)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS course_owners (
      id SERIAL PRIMARY KEY,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      instructor_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
      ownership_type VARCHAR(50) NOT NULL DEFAULT 'PRIMARY',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (course_id, instructor_id)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS course_policies (
      id SERIAL PRIMARY KEY,
      course_id INTEGER NOT NULL UNIQUE REFERENCES courses(id) ON DELETE CASCADE,
      attendance_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
      grading_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
      rewards_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
      ai_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
      project_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_by INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`ALTER TABLE course_policies ADD COLUMN IF NOT EXISTS playground_policy JSONB NOT NULL DEFAULT '{}'::jsonb`
  await sql`
    ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'PLATFORM_ADMIN'
  `

  await sql`
    CREATE TABLE IF NOT EXISTS admin_user_permissions (
      id SERIAL PRIMARY KEY,
      admin_user_id INTEGER NOT NULL,
      permission_code VARCHAR(100) NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (admin_user_id, permission_code)
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      actor_id INTEGER,
      actor_type VARCHAR(32) NOT NULL DEFAULT 'instructor',
      action VARCHAR(200) NOT NULL,
      entity_type VARCHAR(100),
      entity_id INTEGER,
      course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    INSERT INTO permissions (code, description) VALUES
      ('manage_classroom_points', 'Create and manage classroom points activities'),
      ('edit_quizzes', 'Create and edit quizzes and question bank without student release'),
      ('edit_homework', 'Create and edit homework without student release'),
      ('publish_classroom_points', 'Release classroom points activities to students')
    ON CONFLICT (code) DO NOTHING
  `

    ddlEnsured = true
  }

  await ensurePortalRbacSeed()
}
