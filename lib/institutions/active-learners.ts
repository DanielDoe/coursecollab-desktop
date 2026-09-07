import { sql } from "@/lib/db"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"
import { INSTITUTION_ACTIVE_LEARNER_DEFINITION } from "@/lib/institutions/active-learner-definition"

export { INSTITUTION_ACTIVE_LEARNER_DEFINITION }

function licenseDateOnly(value: unknown, fallback: string): string {
  if (value == null) return fallback
  const raw = String(value)
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return fallback
  return parsed.toISOString().slice(0, 10)
}

/**
 * Unique active learners on a license during its contract window.
 * One student in multiple covered courses counts once.
 */
export async function countActiveLearners(licenseId: number): Promise<number> {
  await ensureInstitutionSchema()
  const licenseRows = await sql`
    SELECT start_date, end_date FROM institution_licenses WHERE id = ${licenseId} LIMIT 1
  `
  if (licenseRows.length === 0) return 0
  const start = licenseDateOnly(licenseRows[0].start_date, "1900-01-01")
  const end = licenseDateOnly(licenseRows[0].end_date, "9999-12-31")

  const rows = await sql`
    WITH covered AS (
      SELECT st.id, LOWER(TRIM(COALESCE(st.email, ''))) AS email_key
      FROM students st
      JOIN institution_license_scopes s ON s.course_id = st.course_id
      WHERE s.license_id = ${licenseId}
        AND st.deleted_at IS NULL
        AND NOT (
          LOWER(TRIM(COALESCE(st.email, ''))) LIKE 'demo-%'
          OR LOWER(TRIM(COALESCE(st.email, ''))) LIKE '%+demo@%'
          OR LOWER(TRIM(COALESCE(st.email, ''))) LIKE '%@coursecollab.test'
        )
    ),
    active AS (
      SELECT c.id
      FROM covered c
      JOIN quiz_attempts qa ON qa.student_id = c.id AND qa.deleted_at IS NULL
      WHERE COALESCE(qa.started_at, qa.completed_at) IS NOT NULL
        AND COALESCE(qa.started_at, qa.completed_at)::date >= ${start}::date
        AND COALESCE(qa.started_at, qa.completed_at)::date <= ${end}::date
      UNION
      SELECT c.id
      FROM covered c
      JOIN institution_cora_usage u ON u.user_type = 'student' AND u.user_id = c.id
      WHERE u.license_id = ${licenseId}
        AND u.created_at::date >= ${start}::date
        AND u.created_at::date <= ${end}::date
    )
    SELECT COUNT(*)::int AS n
    FROM (
      SELECT DISTINCT COALESCE(NULLIF(c.email_key, ''), 'student:' || c.id::text) AS identity
      FROM covered c
      JOIN active a ON a.id = c.id
    ) uniq
  `
  return Number(rows[0]?.n ?? 0)
}

export async function countUniqueCoveredRoster(licenseId: number): Promise<number> {
  await ensureInstitutionSchema()
  const rows = await sql`
    SELECT COUNT(*)::int AS n
    FROM (
      SELECT DISTINCT COALESCE(NULLIF(LOWER(TRIM(COALESCE(st.email, ''))), ''), 'student:' || st.id::text)
      FROM students st
      JOIN institution_license_scopes s ON s.course_id = st.course_id
      WHERE s.license_id = ${licenseId}
        AND st.deleted_at IS NULL
    ) uniq
  `
  return Number(rows[0]?.n ?? 0)
}
