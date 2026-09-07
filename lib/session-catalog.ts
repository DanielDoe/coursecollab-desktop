import { sql } from "@/lib/db"
import {
  canonicalSessionCode,
  dedupeLegacyAliasSessionEntries,
  sectionFilterCodesForSql,
} from "@/lib/session-code-aliases"
import { getActiveAcademicTerm } from "@/lib/active-academic-term"

export type SessionCatalogEntry = {
  id: number
  code: string
  label: string
}

const TTL_MS = 2 * 60 * 1000

type CatalogCache = { at: number; entries: SessionCatalogEntry[]; key: string }

let catalogCache: CatalogCache | null = null

/** Clears in-memory cache (e.g. after creating/updating sessions). */
export function invalidateSessionCatalogCache(): void {
  catalogCache = null
}

export type SessionCatalogOptions = {
  /** When set, only sections belonging to this course are returned. */
  courseId?: number | null
  /** When set, only sections linked to this academic term are returned. */
  academicTermId?: number | null
}

export async function getSessionCatalogFromDb(options?: SessionCatalogOptions): Promise<SessionCatalogEntry[]> {
  const courseId = options?.courseId
  let academicTermId = options?.academicTermId
  if (courseId != null && Number.isFinite(courseId) && (academicTermId == null || !Number.isFinite(academicTermId))) {
    const active = await getActiveAcademicTerm()
    if (active?.id) academicTermId = active.id
  }
  const cacheKey = [
    courseId == null ? "__all__" : String(courseId),
    academicTermId == null ? "__term_all__" : String(academicTermId),
  ].join("|")
  if (catalogCache && Date.now() - catalogCache.at < TTL_MS && catalogCache.key === cacheKey) {
    return catalogCache.entries
  }
  const rows =
    courseId != null && Number.isFinite(courseId) && academicTermId != null && Number.isFinite(academicTermId)
      ? await sql`
          SELECT id, code
          FROM sessions
          WHERE course_id = ${courseId}
            AND academic_term_id = ${academicTermId}
            AND TRIM(UPPER(code)) <> 'BETA'
          ORDER BY code ASC
        `
      : courseId != null && Number.isFinite(courseId)
        ? await sql`
            SELECT id, code
            FROM sessions
            WHERE course_id = ${courseId}
              AND TRIM(UPPER(code)) <> 'BETA'
            ORDER BY code ASC
          `
        : academicTermId != null && Number.isFinite(academicTermId)
          ? await sql`
              SELECT id, code
              FROM sessions
              WHERE academic_term_id = ${academicTermId}
                AND TRIM(UPPER(code)) <> 'BETA'
              ORDER BY code ASC
            `
          : await sql`
              SELECT id, code
              FROM sessions
              WHERE TRIM(UPPER(code)) <> 'BETA'
              ORDER BY code ASC
            `
  const rawEntries: SessionCatalogEntry[] = (rows as { id: number; code: string }[]).map((r) => ({
    id: r.id,
    code: r.code,
    label: r.code,
  }))
  const entries = dedupeLegacyAliasSessionEntries(rawEntries)
  catalogCache = { at: Date.now(), entries, key: cacheKey }
  return entries
}

/** Session codes from DB plus synthetic ALL (not usually a sessions row). */
export async function getSessionCodesWithAll(): Promise<string[]> {
  const entries = await getSessionCatalogFromDb()
  const codes = entries.map((e) => e.code)
  if (!codes.includes("ALL")) codes.push("ALL")
  return codes
}

/** Map student/URL session to a key allowed by grade/activity storage (or ALL). */
export async function normalizeSessionForStorage(session: string): Promise<string> {
  const allowed = await getSessionCodesWithAll()
  const set = new Set(allowed)
  const raw = String(session ?? "").trim()
  if (set.has(raw)) return raw
  const mapped = canonicalSessionCode(raw)
  if (mapped !== raw && set.has(mapped)) return mapped
  return "ALL"
}

/**
 * Candidate `student_grades.session` / `classroom_points.session` keys for a roster fragment.
 * Long Canvas strings (e.g. `Spring2026_ELEG1304P01-…`) are not DB codes; `normalizeSessionForStorage` would
 * fall through to `ALL` and miss rows stored under `ELEG1304P01`. We add any catalog code contained in the
 * fragment plus legacy/alias variants from `sectionFilterCodesForSql`.
 */
export async function expandSessionKeysForGradeLookup(fragment: string): Promise<string[]> {
  const raw = String(fragment ?? "").trim()
  if (!raw) return []
  const set = new Set<string>()
  for (const x of sectionFilterCodesForSql(raw)) {
    const t = String(x ?? "").trim()
    if (t) set.add(t)
  }
  const norm = await normalizeSessionForStorage(raw)
  if (norm && norm !== "ALL") set.add(norm)
  const u = raw.toUpperCase()
  const entries = await getSessionCatalogFromDb()
  for (const e of entries) {
    const c = String(e.code ?? "").trim()
    if (!c) continue
    const cu = c.toUpperCase()
    if (u === cu || u.includes(cu)) set.add(c)
  }
  return [...set]
}

export async function getSessionCodesForUi(): Promise<string[]> {
  const entries = await getSessionCatalogFromDb()
  return entries.map((e) => e.code)
}
