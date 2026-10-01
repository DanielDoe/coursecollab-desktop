import { sql } from "@/lib/db"
import { runSchemaOnce } from "@/lib/schema-once"
import { ensureStage6aCoraGovernance } from "@/lib/institutions/stage6a-schema"

let ensured = false
let inflight: Promise<void> | null = null

const PROTECTED = [
  "codebench_submissions",
  "codebench_ide_workspaces",
  "codebench_live_snapshots",
  "codebench_live_sessions",
  "codebench_studio_events",
] as const

/**
 * Stage 5C revokes every table grant, then later stages run before 6B.
 * Live push writes as coursecollab_tenant, so restore these grants immediately
 * after that revoke. Idempotent. Policies are installed by ensureStage6b.
 */
export async function grantCodebenchTenantPrivileges(): Promise<void> {
  const existing = await existingPublicTables([...PROTECTED])
  const tables = PROTECTED.filter((t) => existing.has(t))
  if (tables.length > 0) {
    await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON ${sql.unsafe(tables.join(", "))} TO coursecollab_tenant`
  }

  const seqs = await sql`
    SELECT pg_get_serial_sequence(n.tbl, n.col) AS seq
    FROM (
      VALUES
        ('codebench_submissions','id'),
        ('codebench_live_snapshots','id'),
        ('codebench_live_sessions','id'),
        ('codebench_studio_events','id')
    ) AS n(tbl, col)
  `
  for (const row of seqs as { seq: string | null }[]) {
    if (!row.seq) continue
    const name = row.seq.includes(".") ? row.seq.split(".").pop() : row.seq
    if (!name || !/^[a-zA-Z0-9_]+$/.test(name)) continue
    try {
      await sql`GRANT USAGE, SELECT ON SEQUENCE ${sql.unsafe(name)} TO coursecollab_tenant`
    } catch {
      /* sequence name may differ */
    }
  }
}

/** Stage 6B: CodeBench tenant RLS. Ownership follows enrollment → course, never the enrollment campus field. */
export async function ensureStage6bCodebenchIsolation(): Promise<void> {
  if (ensured) return
  if (!inflight) {
    inflight = runSchemaOnce("stage6b-schema", ensureStage6bCodebenchIsolationUnlocked).finally(() => {
      inflight = null
    })
  }
  return inflight
}

async function ensureStage6bCodebenchIsolationUnlocked(): Promise<void> {
  if (ensured) return
  await ensureStage6aCoraGovernance()

  await sql`
    CREATE TABLE IF NOT EXISTS codebench_submissions (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL,
      assignment_id INTEGER,
      code TEXT NOT NULL,
      score DECIMAL(4,1),
      points_awarded DECIMAL(5,2),
      feedback TEXT,
      detailed_feedback TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      classroom_point_id INTEGER,
      authenticity_score INTEGER,
      ai_likelihood DECIMAL(3,2),
      authorship_reasoning TEXT,
      flagged_features TEXT[],
      ai_suspicion BOOLEAN DEFAULT false,
      submitted_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(student_id, assignment_id)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS codebench_ide_workspaces (
      student_id INTEGER PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
      workspace JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS codebench_live_snapshots (
      id bigserial PRIMARY KEY,
      student_id integer NOT NULL,
      assignment_id integer NOT NULL,
      course_id integer,
      language text,
      file_name text,
      code text NOT NULL DEFAULT '',
      typing_replay jsonb,
      updated_at timestamptz NOT NULL DEFAULT NOW(),
      UNIQUE (student_id, assignment_id)
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS codebench_live_sessions (
      id bigserial PRIMARY KEY,
      assignment_id integer NOT NULL,
      course_id integer NOT NULL,
      instructor_id integer NOT NULL,
      started_at timestamptz NOT NULL DEFAULT NOW(),
      ended_at timestamptz
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS codebench_studio_events (
      id bigserial PRIMARY KEY,
      student_id integer NOT NULL,
      course_id integer,
      event_type text NOT NULL,
      language text,
      error_family text,
      error_message text,
      tool text,
      file_name text,
      success boolean,
      created_at timestamptz NOT NULL DEFAULT NOW()
    )
  `

  const existing = await existingPublicTables([...PROTECTED])
  await grantCodebenchTenantPrivileges()

  await sql`
    CREATE OR REPLACE FUNCTION enforce_codebench_snapshot_same_institution()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY INVOKER
    SET search_path = pg_catalog, public
    AS $$
    DECLARE
      student_uni integer;
      snap_uni integer;
    BEGIN
      IF NEW.course_id IS NULL THEN
        RETURN NEW;
      END IF;
      SELECT c.university_id INTO student_uni
      FROM public.students s
      JOIN public.courses c ON c.id = s.course_id
      WHERE s.id = NEW.student_id;
      SELECT c.university_id INTO snap_uni
      FROM public.courses c
      WHERE c.id = NEW.course_id;
      IF student_uni IS NULL OR snap_uni IS NULL OR student_uni IS DISTINCT FROM snap_uni THEN
        RAISE EXCEPTION 'cross_tenant_academic_relationship'
          USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$
  `
  await sql`
    CREATE OR REPLACE FUNCTION enforce_codebench_live_session_same_course()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY INVOKER
    SET search_path = pg_catalog, public
    AS $$
    DECLARE
      assign_course integer;
    BEGIN
      -- classroom_point_submissions has no course_id. Section code points at sessions.course_id.
      SELECT sess.course_id INTO assign_course
      FROM public.classroom_point_submissions cps
      JOIN public.sessions sess
        ON TRIM(sess.code) = TRIM(cps.session)
       AND sess.course_id = NEW.course_id
      WHERE cps.id = NEW.assignment_id
      LIMIT 1;
      IF assign_course IS NULL OR assign_course IS DISTINCT FROM NEW.course_id THEN
        RAISE EXCEPTION 'cross_tenant_academic_relationship'
          USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$
  `

  const helperFns = [
    "enforce_codebench_snapshot_same_institution()",
    "enforce_codebench_live_session_same_course()",
  ]
  for (const fn of helperFns) {
    await sql`REVOKE ALL ON FUNCTION ${sql.unsafe(fn)} FROM PUBLIC`
    await sql`GRANT EXECUTE ON FUNCTION ${sql.unsafe(fn)} TO coursecollab_tenant`
    await sql`GRANT EXECUTE ON FUNCTION ${sql.unsafe(fn)} TO CURRENT_USER`
  }

  if (existing.has("codebench_submissions")) {
    await applyPolicies(
      "codebench_submissions",
      "student_enrollment_belongs_to_current_institution(student_id)",
    )
  }
  if (existing.has("codebench_ide_workspaces")) {
    await applyPolicies(
      "codebench_ide_workspaces",
      "student_enrollment_belongs_to_current_institution(student_id)",
    )
  }
  if (existing.has("codebench_live_sessions")) {
    await applyPolicies(
      "codebench_live_sessions",
      "course_belongs_to_current_institution(course_id)",
    )
  }
  if (existing.has("codebench_live_snapshots")) {
    await applyPolicies(
      "codebench_live_snapshots",
      `(
        (course_id IS NOT NULL AND course_belongs_to_current_institution(course_id))
        OR
        (course_id IS NULL AND student_enrollment_belongs_to_current_institution(student_id))
      )`,
    )
  }
  if (existing.has("codebench_studio_events")) {
    await applyPolicies(
      "codebench_studio_events",
      `(
        (course_id IS NOT NULL AND course_belongs_to_current_institution(course_id))
        OR
        (course_id IS NULL AND student_enrollment_belongs_to_current_institution(student_id))
      )`,
    )
  }

  if (existing.has("codebench_live_snapshots")) {
    await sql`DROP TRIGGER IF EXISTS trg_codebench_snapshot_same_institution ON codebench_live_snapshots`
    await sql`
      CREATE TRIGGER trg_codebench_snapshot_same_institution
      BEFORE INSERT OR UPDATE OF student_id, course_id ON codebench_live_snapshots
      FOR EACH ROW
      EXECUTE FUNCTION enforce_codebench_snapshot_same_institution()
    `
  }
  if (existing.has("codebench_live_sessions")) {
    const hasClassroom = (await sql`
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'classroom_point_submissions'
    `) as unknown[]
    if (hasClassroom.length > 0) {
      await sql`DROP TRIGGER IF EXISTS trg_codebench_live_session_same_course ON codebench_live_sessions`
      await sql`
        CREATE TRIGGER trg_codebench_live_session_same_course
        BEFORE INSERT OR UPDATE OF assignment_id, course_id ON codebench_live_sessions
        FOR EACH ROW
        EXECUTE FUNCTION enforce_codebench_live_session_same_course()
      `
    }
  }

  ensured = true
}

async function existingPublicTables(names: readonly string[]): Promise<Set<string>> {
  const rows = (await sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = ANY(${names as unknown as string[]})
  `) as { tablename: string }[]
  return new Set(rows.map((r) => r.tablename))
}

async function applyPolicies(table: string, predicate: string) {
  await sql`DROP POLICY IF EXISTS ${sql.unsafe(`tenant_select_${table}`)} ON ${sql.unsafe(table)}`
  await sql`DROP POLICY IF EXISTS ${sql.unsafe(`tenant_insert_${table}`)} ON ${sql.unsafe(table)}`
  await sql`DROP POLICY IF EXISTS ${sql.unsafe(`tenant_update_${table}`)} ON ${sql.unsafe(table)}`
  await sql`DROP POLICY IF EXISTS ${sql.unsafe(`tenant_delete_${table}`)} ON ${sql.unsafe(table)}`
  await sql`
    CREATE POLICY ${sql.unsafe(`tenant_select_${table}`)} ON ${sql.unsafe(table)}
    FOR SELECT USING (${sql.unsafe(predicate)})
  `
  await sql`
    CREATE POLICY ${sql.unsafe(`tenant_insert_${table}`)} ON ${sql.unsafe(table)}
    FOR INSERT WITH CHECK (${sql.unsafe(predicate)})
  `
  await sql`
    CREATE POLICY ${sql.unsafe(`tenant_update_${table}`)} ON ${sql.unsafe(table)}
    FOR UPDATE USING (${sql.unsafe(predicate)}) WITH CHECK (${sql.unsafe(predicate)})
  `
  await sql`
    CREATE POLICY ${sql.unsafe(`tenant_delete_${table}`)} ON ${sql.unsafe(table)}
    FOR DELETE USING (${sql.unsafe(predicate)})
  `
  await sql`ALTER TABLE ${sql.unsafe(table)} ENABLE ROW LEVEL SECURITY`
  await sql`ALTER TABLE ${sql.unsafe(table)} FORCE ROW LEVEL SECURITY`
}
