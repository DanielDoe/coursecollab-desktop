import { type NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { canonicalEducationDomain, emailHost } from "@/lib/universities-catalog"
import { FALLBACK_UNIVERSITIES } from "@/lib/universities-shared"

export const PVAMU_UNIVERSITY_ID = 1
export const UH_UNIVERSITY_ID = 2

export function parseUniversityIdFromScopeValues(input: {
  universityHeader?: string | null
  institutionHeader?: string | null
  universityQuery?: string | null
  institutionQuery?: string | null
}): number | null {
  const raw =
    input.universityHeader?.trim() ||
    input.institutionHeader?.trim() ||
    input.universityQuery?.trim() ||
    input.institutionQuery?.trim() ||
    ""
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
}

export function parseUniversityIdFromRequest(request: NextRequest): number | null {
  return parseUniversityIdFromScopeValues({
    universityHeader: request.headers.get("x-university-id"),
    institutionHeader: request.headers.get("x-institution-id"),
    universityQuery: request.nextUrl.searchParams.get("universityId"),
    institutionQuery: request.nextUrl.searchParams.get("institutionId"),
  })
}

/** Whether a faculty email belongs to the selected university (PVAMU / UH). */
export function facultyEmailMatchesUniversity(
  email: string | null | undefined,
  universityId: number | null | undefined,
): boolean {
  if (universityId == null || !Number.isFinite(universityId)) return true
  const host = canonicalEducationDomain(emailHost(String(email ?? "")))
  if (!host) return false

  const uni = FALLBACK_UNIVERSITIES.find((u) => u.id === universityId)
  const expectedDomain = uni?.domain?.toLowerCase()
  if (!expectedDomain) return true

  if (expectedDomain === "uh.edu") {
    return host === "uh.edu" || host.endsWith(".uh.edu")
  }
  if (expectedDomain === "pvamu.edu") {
    return host === "pvamu.edu" || host.endsWith(".pvamu.edu")
  }
  return host === expectedDomain || host.endsWith(`.${expectedDomain}`)
}

/** Infer university from course code / legacy text when `university_id` is unset. */
export function inferCourseUniversityId(input: {
  courseCode?: string | null
  universityText?: string | null
}): number | null {
  const code = String(input.courseCode ?? "")
    .trim()
    .toUpperCase()
  if (code === "ECE2202" || code.startsWith("ECE2202")) return UH_UNIVERSITY_ID
  if (code.startsWith("ELEG1301") || code.startsWith("ELEG1304") || code.startsWith("E1301") || code.startsWith("E1304")) {
    return PVAMU_UNIVERSITY_ID
  }

  const legacy = String(input.universityText ?? "").trim().toLowerCase()
  if (legacy.includes("houston") || legacy === "uh") return UH_UNIVERSITY_ID
  if (legacy.includes("prairie view") || legacy === "pvamu") return PVAMU_UNIVERSITY_ID
  return null
}

export async function resolveCourseUniversityId(courseId: number): Promise<number | null> {
  const rows = (await sql`
    SELECT c.university_id, c.course_code, c.university
    FROM courses c
    WHERE c.id = ${courseId}
    LIMIT 1
  `) as { university_id: number | null; course_code: string; university: string | null }[]
  const row = rows[0]
  if (!row) return null
  if (row.university_id != null && Number.isFinite(Number(row.university_id))) {
    return Number(row.university_id)
  }
  return inferCourseUniversityId({
    courseCode: row.course_code,
    universityText: row.university,
  })
}

/** SQL fragment: course row matches active university filter (alias `c`). */
export function courseBelongsToUniversitySql(
  universityId: number | null | undefined,
  courseAlias = "c",
): string {
  if (universityId == null || !Number.isFinite(universityId)) return "TRUE"
  const uid = Math.trunc(universityId)
  return `(
    ${courseAlias}.university_id = ${uid}
    OR (
      ${courseAlias}.university_id IS NULL
      AND (
        (${uid} = ${PVAMU_UNIVERSITY_ID} AND (
          TRIM(UPPER(${courseAlias}.course_code::text)) LIKE 'ELEG1301%'
          OR TRIM(UPPER(${courseAlias}.course_code::text)) LIKE 'ELEG1304%'
          OR TRIM(UPPER(${courseAlias}.course_code::text)) ~ '^E1301P'
          OR TRIM(UPPER(${courseAlias}.course_code::text)) ~ '^E1304P'
          OR COALESCE(${courseAlias}.university::text, '') ILIKE '%prairie view%'
          OR COALESCE(${courseAlias}.university::text, '') ILIKE '%pvamu%'
        ))
        OR (${uid} = ${UH_UNIVERSITY_ID} AND (
          TRIM(UPPER(${courseAlias}.course_code::text)) = 'ECE2202'
          OR TRIM(UPPER(${courseAlias}.course_code::text)) ~ '^ECE2202P'
          OR COALESCE(${courseAlias}.university::text, '') ILIKE '%houston%'
        ))
      )
    )
  )`
}

export function courseRowMatchesUniversity(
  row: { university_id?: number | null; course_code?: string | null; university?: string | null },
  universityId: number | null | undefined,
): boolean {
  if (universityId == null || !Number.isFinite(universityId)) return true
  const uid = Math.trunc(universityId)
  if (row.university_id != null && Number(row.university_id) === uid) return true
  if (row.university_id != null && Number(row.university_id) !== uid) return false
  const inferred = inferCourseUniversityId({
    courseCode: row.course_code,
    universityText: row.university,
  })
  return inferred == null || inferred === uid
}
