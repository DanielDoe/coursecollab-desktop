import { isEce2202LegacyLabSectionCode } from "@/lib/course-section-model"

/**
 * Legacy section/session codes stored in older rows vs canonical `sessions.code` (e.g. ELEG1301P01).
 * Use these for UI unification, API filters (match both), and optional DB batch migration.
 *
 * ## Renaming `sessions.code` (sections)
 * After a rename, **`students.section` is often stale** (old code or blank) while **`students.session_id`**
 * still points at the same `sessions` row. Any filter that only does `students.section = <new code>` will
 * drop real students. Prefer:
 * - **`students.session_id = <sessions.id>`** when the client has catalog ids (Canvas export, etc.), and/or
 * - **`normalizedSectionVariantsForSql` +** `TRIM(section) = ANY(…) OR EXISTS (sessions…)`, and/or
 * - **`studentSectionMatchesSessionRenameSqlFragment`** for string-built WHERE clauses, and/or
 * - Run **`migrations/backfill-students-section-from-session.sql`** to resync denormalized text.
 */

export const SESSION_LEGACY_TO_CANONICAL: Readonly<Record<string, string>> = {
  E1301P01: "ELEG1301P01",
  E1304P01: "ELEG1304P01",
  E1304P02: "ELEG1304P02",
  E1304P04: "ELEG1304P04",
  ECE2202P01: "ECE2202",
}

/** Stored code -> canonical if mapped, else unchanged */
export function canonicalSessionCode(raw: string): string {
  const s = String(raw ?? "").trim()
  if (!s) return s
  if (isEce2202LegacyLabSectionCode(s)) return "ECE2202"
  return SESSION_LEGACY_TO_CANONICAL[s] ?? s
}

/** Same section for auth / row match, including legacy ↔ canonical alias pairs */
export function sectionsAreAliasEquivalent(a: string, b: string): boolean {
  const x = String(a ?? "").trim()
  const y = String(b ?? "").trim()
  if (!x || !y) return false
  if (x === y) return true
  return canonicalSessionCode(x) === canonicalSessionCode(y)
}

/**
 * After section renames, `students.section` is often stale (e.g. `P01`) while `students.session_id`
 * still points at the real `sessions` row (`ELEG1304P01`). Login must accept the catalog code.
 */
export function studentRowSectionMatchesLogin(
  studentSectionDenorm: string | null | undefined,
  catalogSessionCode: string | null | undefined,
  loginSectionRaw: string,
  loginSectionResolved: string,
): boolean {
  const loginVariants = new Set<string>()
  for (const key of [loginSectionRaw, loginSectionResolved]) {
    const raw = String(key ?? "").trim()
    if (!raw) continue
    loginVariants.add(raw)
    for (const x of sectionFilterCodesForSql(raw)) {
      const t = String(x ?? "").trim()
      if (t) loginVariants.add(t)
    }
  }
  const den = String(studentSectionDenorm ?? "").trim()
  const cat = String(catalogSessionCode ?? "").trim()

  for (const lv of loginVariants) {
    if (!lv) continue
    if (den && sectionsAreAliasEquivalent(den, lv)) return true
    if (cat && sectionsAreAliasEquivalent(cat, lv)) return true
  }
  return false
}

/**
 * Ensure `session_access`-style maps (code -> boolean) include both legacy and canonical keys so
 * instructor UI toggles match `sessions.code` after E1304P01 → ELEG1304P01 style renames.
 */
export function augmentSessionAccessWithLegacyAliases(
  access: Record<string, boolean> | null | undefined,
): Record<string, boolean> {
  if (!access || typeof access !== "object") return {}
  const out: Record<string, boolean> = { ...access }
  for (const [legacy, canonical] of Object.entries(SESSION_LEGACY_TO_CANONICAL)) {
    if (out[legacy] !== undefined && out[canonical] === undefined) out[canonical] = out[legacy]!
    if (out[canonical] !== undefined && out[legacy] === undefined) out[legacy] = out[canonical]!
  }
  return out
}

/**
 * All distinct codes to match in SQL/API when filtering by a section (canonical UI value * or a legacy stored value).
 */
export function sectionFilterCodesForSql(sectionParam: string): string[] {
  const raw = String(sectionParam ?? "").trim()
  if (!raw) return []
  const canonical = canonicalSessionCode(raw)
  const set = new Set<string>([raw, canonical])
  for (const [legacy, can] of Object.entries(SESSION_LEGACY_TO_CANONICAL)) {
    if (can === canonical) set.add(legacy)
  }
  if (canonical === "ECE2202" && isEce2202LegacyLabSectionCode(raw)) {
    set.add("ECE2202")
  }
  return [...set]
}

/**
 * Trim + dedupe for `= ANY($1::text[])` in SQL.
 *
 * When instructors **rename** `sessions.code`, `students.section` is often left as the old string while
 * `students.session_id` still points at the same row. Filters must match **either** denormalized section
 * **or** current `sessions.code` via `session_id`:
 *
 * `TRIM(s.section) = ANY($variants) OR EXISTS (SELECT 1 FROM sessions sess WHERE sess.id = s.session_id AND TRIM(sess.code) = ANY($variants))`
 */
export function normalizedSectionVariantsForSql(sectionParam: string): string[] {
  return [...new Set(sectionFilterCodesForSql(sectionParam).map((c) => c.trim()).filter(Boolean))]
}

/**
 * Predicate for string-concatenated SQL (e.g. clear-route WHERE parts). Escapes variants; only pass section
 * params from `normalizedSectionVariantsForSql` / the section picker, not untrusted arbitrary strings.
 */
export function studentSectionMatchesSessionRenameSqlFragment(
  studentsTableAlias: string,
  sectionParam: string,
): string {
  const variants = normalizedSectionVariantsForSql(sectionParam)
  if (variants.length === 0) return "FALSE"
  const list = variants.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(", ")
  const a = studentsTableAlias
  return `(TRIM(${a}.section) IN (${list}) OR EXISTS (SELECT 1 FROM sessions sess WHERE sess.id = ${a}.session_id AND TRIM(sess.code) IN (${list})))`
}

/** `column IN ('a','b')` for dynamic SQL string fragments */
export function sectionSqlInClause(column: string, sectionParam: string): string {
  const v = sectionFilterCodesForSql(sectionParam)
  if (v.length === 0) return "FALSE"
  return `${column} IN (${v.map((x) => `'${x.replace(/'/g, "''")}'`).join(", ")})`
}

const escSqlIdentForRaw = (s: string) => s.replace(/'/g, "''")

/**
 * For EXISTS / JOIN: `sessions` row matches `account_requests.section` including legacy aliases
 * (see SESSION_LEGACY_TO_CANONICAL).
 */
export function accountRequestStoredSectionMatchesSessionSql(
  sessionsAlias = "sess",
  accountRequestsAlias = "ar",
): string {
  const s = sessionsAlias
  const a = accountRequestsAlias
  const parts: string[] = [`TRIM(${s}.code) = TRIM(${a}.section)`]
  for (const [legacy, canonical] of Object.entries(SESSION_LEGACY_TO_CANONICAL)) {
    const L = escSqlIdentForRaw(legacy)
    const C = escSqlIdentForRaw(canonical)
    parts.push(`(TRIM(${s}.code) = '${C}' AND TRIM(${a}.section) = '${L}')`)
    parts.push(`(TRIM(${s}.code) = '${L}' AND TRIM(${a}.section) = '${C}')`)
  }
  return `(${parts.join(" OR ")})`
}

/**
 * Pick one dropdown/filter key: prefer canonical when it exists in the DB catalog,
 * otherwise keep the stored code.
 */
export function unifySessionForFilterDropdown(storedCode: string, dbCodes: Set<string>): string {
  const raw = String(storedCode ?? "").trim()
  if (!raw) return raw
  const canonical = SESSION_LEGACY_TO_CANONICAL[raw] ?? raw
  if (dbCodes.has(canonical)) return canonical
  if (dbCodes.has(raw)) return raw
  return raw
}

export function sectionsMatchForFilter(a: string, b: string, dbCodes: Set<string>): boolean {
  return unifySessionForFilterDropdown(a, dbCodes) === unifySessionForFilterDropdown(b, dbCodes)
}

/** Add legacy keys to label map so short codes show the same label as canonical */
export function augmentLabelByCodeWithLegacyAliases(labelByCode: Map<string, string>): Map<string, string> {
  const next = new Map(labelByCode)
  for (const [legacy, canonical] of Object.entries(SESSION_LEGACY_TO_CANONICAL)) {
    const label = next.get(canonical)
    if (label) next.set(legacy, label)
  }
  return next
}

export type SessionCatalogEntryLike = { id: number; code: string; label: string }

/**
 * When both a legacy and canonical row exist in `sessions` (accidental duplicate),
 * keep a single catalog entry: canonical code + merged label. Does not change the DB.
 * If only the legacy row exists, it stays as-is (rename sessions in DB when ready).
 */
export function dedupeLegacyAliasSessionEntries<T extends SessionCatalogEntryLike>(entries: T[]): T[] {
  const byCode = new Map<string, T>()
  for (const e of entries) {
    const code = String(e.code ?? "").trim()
    if (!code) continue
    const prev = byCode.get(code)
    if (!prev) {
      byCode.set(code, { ...e })
      continue
    }
    const prevLabel = (prev.label ?? "").trim()
    const nextLabel = (e.label ?? "").trim()
    const label =
      nextLabel.length > 0 && nextLabel.length >= prevLabel.length ? nextLabel : prevLabel || nextLabel || code
    byCode.set(code, { ...prev, label } as T)
  }

  const codeSet = new Set(byCode.keys())

  for (const [legacy, canonical] of Object.entries(SESSION_LEGACY_TO_CANONICAL)) {
    if (!codeSet.has(legacy) || !codeSet.has(canonical)) continue
    const leg = byCode.get(legacy)
    const can = byCode.get(canonical)
    if (!leg || !can) continue
    const legLabel = (leg.label ?? "").trim()
    const canLabel = (can.label ?? "").trim()
    const label =
      canLabel.length > 0 && canLabel.length >= legLabel.length ? canLabel : legLabel || canLabel || canonical
    byCode.set(canonical, { ...can, label } as T)
    byCode.delete(legacy)
  }

  return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code))
}
