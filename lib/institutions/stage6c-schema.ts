import { sql } from "@/lib/db"
import { runSchemaOnce } from "@/lib/schema-once"
import { ensureStage6bCodebenchIsolation } from "@/lib/institutions/stage6b-schema"

let ensured = false
let inflight: Promise<void> | null = null

/** Stage 6C: protected file metadata. Tenant follows course or enrollment, never students.university_id. */
export async function ensureStage6cStorageIsolation(): Promise<void> {
  if (ensured) return
  if (!inflight) {
    inflight = runSchemaOnce("stage6c-schema", ensureStage6cStorageIsolationUnlocked).finally(() => {
      inflight = null
    })
  }
  return inflight
}

async function ensureStage6cStorageIsolationUnlocked(): Promise<void> {
  if (ensured) return
  await ensureStage6bCodebenchIsolation()

  await sql`
    CREATE TABLE IF NOT EXISTS stored_objects (
      id BIGSERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      object_key TEXT NOT NULL UNIQUE,
      content_type TEXT,
      original_filename TEXT,
      byte_size INTEGER,
      student_id INTEGER,
      course_id INTEGER,
      lecture_id INTEGER,
      created_by_type TEXT,
      created_by_id INTEGER,
      visibility TEXT NOT NULL DEFAULT 'protected',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (visibility IN ('public', 'protected'))
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_stored_objects_student ON stored_objects (student_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_stored_objects_course ON stored_objects (course_id)`

  await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON stored_objects TO coursecollab_tenant`
  const seqs = await sql`
    SELECT pg_get_serial_sequence('stored_objects', 'id') AS seq
  `
  for (const row of seqs as { seq: string | null }[]) {
    if (!row.seq) continue
    const name = row.seq.includes(".") ? row.seq.split(".").pop() : row.seq
    if (!name || !/^[a-zA-Z0-9_]+$/.test(name)) continue
    try {
      await sql`GRANT USAGE, SELECT ON SEQUENCE ${sql.unsafe(name)} TO coursecollab_tenant`
    } catch {
      /* ignore */
    }
  }

  await sql`
    CREATE OR REPLACE FUNCTION enforce_stored_object_same_institution()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY INVOKER
    SET search_path = pg_catalog, public
    AS $$
    DECLARE
      student_uni integer;
      course_uni integer;
    BEGIN
      IF NEW.student_id IS NULL OR NEW.course_id IS NULL THEN
        RETURN NEW;
      END IF;
      SELECT c.university_id INTO student_uni
      FROM public.students s
      JOIN public.courses c ON c.id = s.course_id
      WHERE s.id = NEW.student_id;
      SELECT c.university_id INTO course_uni
      FROM public.courses c
      WHERE c.id = NEW.course_id;
      IF student_uni IS NULL OR course_uni IS NULL OR student_uni IS DISTINCT FROM course_uni THEN
        RAISE EXCEPTION 'cross_tenant_academic_relationship'
          USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$
  `
  await sql`REVOKE ALL ON FUNCTION enforce_stored_object_same_institution() FROM PUBLIC`
  await sql`GRANT EXECUTE ON FUNCTION enforce_stored_object_same_institution() TO coursecollab_tenant`
  await sql`GRANT EXECUTE ON FUNCTION enforce_stored_object_same_institution() TO CURRENT_USER`

  const predicate = `(
    (course_id IS NOT NULL AND course_belongs_to_current_institution(course_id))
    OR
    (course_id IS NULL AND student_id IS NOT NULL AND student_enrollment_belongs_to_current_institution(student_id))
  )`
  await sql`DROP POLICY IF EXISTS tenant_select_stored_objects ON stored_objects`
  await sql`DROP POLICY IF EXISTS tenant_insert_stored_objects ON stored_objects`
  await sql`DROP POLICY IF EXISTS tenant_update_stored_objects ON stored_objects`
  await sql`DROP POLICY IF EXISTS tenant_delete_stored_objects ON stored_objects`
  await sql`
    CREATE POLICY tenant_select_stored_objects ON stored_objects
    FOR SELECT USING (${sql.unsafe(predicate)})
  `
  await sql`
    CREATE POLICY tenant_insert_stored_objects ON stored_objects
    FOR INSERT WITH CHECK (${sql.unsafe(predicate)})
  `
  await sql`
    CREATE POLICY tenant_update_stored_objects ON stored_objects
    FOR UPDATE USING (${sql.unsafe(predicate)}) WITH CHECK (${sql.unsafe(predicate)})
  `
  await sql`
    CREATE POLICY tenant_delete_stored_objects ON stored_objects
    FOR DELETE USING (${sql.unsafe(predicate)})
  `
  await sql`ALTER TABLE stored_objects ENABLE ROW LEVEL SECURITY`
  await sql`ALTER TABLE stored_objects FORCE ROW LEVEL SECURITY`

  await sql`DROP TRIGGER IF EXISTS trg_stored_object_same_institution ON stored_objects`
  await sql`
    CREATE TRIGGER trg_stored_object_same_institution
    BEFORE INSERT OR UPDATE OF student_id, course_id ON stored_objects
    FOR EACH ROW
    EXECUTE FUNCTION enforce_stored_object_same_institution()
  `

  ensured = true
}
