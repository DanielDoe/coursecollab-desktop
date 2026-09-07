import { sql } from "@/lib/db"
import type { TaPermissionsStore } from "@/lib/ta-permissions"
import {
  courseBelongsToUniversitySql,
  PVAMU_UNIVERSITY_ID,
  UH_UNIVERSITY_ID,
} from "@/lib/instructor-university-scope"

export type FacultyLoginInstructorRow = {
  id: number
  username: string
  email: string
  name: string
  password: string
  role: string
  assigned_instructor_id: number | null
  is_active: boolean
  has_changed_password: boolean
  ta_permissions: TaPermissionsStore | null
  deleted_at: unknown
  university_id: number | null
}

const INSTRUCTOR_LOGIN_COLUMNS = `
  id, username, email, name, password,
  COALESCE(role, 'instructor') AS role,
  assigned_instructor_id,
  COALESCE(is_active, true) AS is_active,
  COALESCE(has_changed_password, true) AS has_changed_password,
  ta_permissions,
  deleted_at,
  university_id
`

/** Shared login aliases — same typed username, different campus account row. */
function loginUsernameAliases(normalizedLogin: string, universityId: number): string[] {
  if (normalizedLogin !== "dmdoe") return []
  if (universityId === UH_UNIVERSITY_ID) return ["dmdoe-uh", "dmdoe"]
  if (universityId === PVAMU_UNIVERSITY_ID) return ["dmdoe"]
  return [normalizedLogin]
}

async function findByUsernameOrEmailAtUniversity(
  normalizedLogin: string,
  universityId: number,
  usernames: string[],
): Promise<FacultyLoginInstructorRow | null> {
  const names = [...new Set([normalizedLogin, ...usernames].filter(Boolean))]
  const rows = (await sql`
    SELECT ${sql.unsafe(INSTRUCTOR_LOGIN_COLUMNS)}
    FROM instructors
    WHERE university_id = ${universityId}
      AND (
        LOWER(TRIM(username)) = ANY(${names}::text[])
        OR LOWER(TRIM(email)) = ${normalizedLogin}
      )
    ORDER BY id ASC
    LIMIT 1
  `) as FacultyLoginInstructorRow[]
  return rows[0] ?? null
}

async function findByTeachingAtUniversity(
  normalizedLogin: string,
  universityId: number,
  usernames: string[],
): Promise<FacultyLoginInstructorRow | null> {
  const names = [...new Set([normalizedLogin, ...usernames].filter(Boolean))]
  const coursePredicate = courseBelongsToUniversitySql(universityId, "c")
  const rows = (await sql`
    SELECT DISTINCT ON (i.id)
      i.id, i.username, i.email, i.name, i.password,
      COALESCE(i.role, 'instructor') AS role,
      i.assigned_instructor_id,
      COALESCE(i.is_active, true) AS is_active,
      COALESCE(i.has_changed_password, true) AS has_changed_password,
      i.ta_permissions,
      i.deleted_at,
      i.university_id
    FROM instructors i
    INNER JOIN course_staff cs ON cs.instructor_id = i.id AND cs.is_active = true
    INNER JOIN courses c ON c.id = cs.course_id AND c.is_active = true
    WHERE LOWER(TRIM(i.username)) = ANY(${names}::text[])
      AND (${sql.unsafe(coursePredicate)})
    ORDER BY i.id ASC
    LIMIT 1
  `) as FacultyLoginInstructorRow[]
  return rows[0] ?? null
}

/**
 * Resolve the faculty row for sign-in. When a university is selected, match that campus
 * (same username/password can map to different instructor ids per school).
 */
export async function resolveFacultyInstructorForLogin(
  loginId: string,
  universityId: number | null,
): Promise<FacultyLoginInstructorRow | null> {
  const normalized = String(loginId ?? "").trim().toLowerCase()
  if (!normalized) return null

  if (universityId != null && Number.isFinite(universityId)) {
    const uid = Math.trunc(universityId)
    const aliases = loginUsernameAliases(normalized, uid)

    const byCampus = await findByUsernameOrEmailAtUniversity(normalized, uid, aliases)
    if (byCampus) return byCampus

    const byCourses = await findByTeachingAtUniversity(normalized, uid, aliases)
    if (byCourses) return byCourses

    return null
  }

  const rows = (await sql`
    SELECT id, username, email, name, password,
           COALESCE(role, 'instructor') AS role,
           assigned_instructor_id,
           COALESCE(is_active, true) AS is_active,
           COALESCE(has_changed_password, true) AS has_changed_password,
           ta_permissions,
           deleted_at,
           university_id
    FROM instructors
    WHERE LOWER(TRIM(username)) = ${normalized}
       OR LOWER(TRIM(email)) = ${normalized}
    ORDER BY id ASC
    LIMIT 1
  `) as FacultyLoginInstructorRow[]

  return rows[0] ?? null
}

/** Whether this instructor owns or teaches courses on the selected campus. */
export async function instructorTeachesAtUniversity(
  instructorId: number,
  universityId: number,
): Promise<boolean> {
  if (!Number.isFinite(instructorId) || !Number.isFinite(universityId)) return false
  const coursePredicate = courseBelongsToUniversitySql(Math.trunc(universityId), "c")
  const rows = (await sql`
    SELECT 1
    FROM course_staff cs
    INNER JOIN courses c ON c.id = cs.course_id AND c.is_active = true
    WHERE cs.instructor_id = ${Math.trunc(instructorId)}
      AND cs.is_active = true
      AND (${sql.unsafe(coursePredicate)})
    LIMIT 1
  `) as unknown[]
  return rows.length > 0
}
