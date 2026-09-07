/**
 * UI helpers for section/session display. Source of truth for **codes and labels** is the DB
 * (`sessions` via SessionCatalogProvider + `/api/sessions/catalog`).
 */

export const SESSION_DOT_PALETTE = [
  "bg-blue-500",
  "bg-cyan-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-indigo-500",
] as const

export type SessionAccessState = { all: boolean } & Record<string, boolean>

export function createAllSessionAccess(codes: string[], all: boolean): SessionAccessState {
  const row: SessionAccessState = { all }
  for (const code of codes) {
    row[code] = all
  }
  return row
}

export function sessionAccessFromStoredArray(arr: string[] | null, codes: string[]): SessionAccessState {
  if (arr === null) return createAllSessionAccess(codes, true)
  const row = createAllSessionAccess(codes, false)
  row.all = false
  for (const code of codes) {
    row[code] = arr.includes(code)
  }
  return row
}

export function storedArrayFromSessionAccess(access: SessionAccessState, codes: string[]): string[] | null {
  if (access.all) return null
  return codes.filter((code) => access[code])
}

export function buildAccessRows(
  entries: { code: string; label: string }[],
): { code: string; label: string; dotClass: string }[] {
  return entries.map((e, i) => ({
    code: e.code,
    label: e.label,
    dotClass: SESSION_DOT_PALETTE[i % SESSION_DOT_PALETTE.length],
  }))
}

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

const BADGE_VARIANTS = [
  "border-blue-300 text-blue-700 dark:text-blue-400",
  "border-cyan-300 text-cyan-700 dark:text-cyan-400",
  "border-green-300 text-green-700 dark:text-green-400",
  "border-purple-300 text-purple-700 dark:text-purple-400",
  "border-amber-300 text-amber-700 dark:text-amber-400",
  "border-rose-300 text-rose-700 dark:text-rose-400",
  "border-indigo-300 text-indigo-700 dark:text-indigo-400",
] as const

const STAT_GRADIENT_VARIANTS = [
  "from-blue-500 to-blue-600",
  "from-cyan-500 to-cyan-600",
  "from-green-500 to-green-600",
  "from-purple-500 to-purple-600",
  "from-amber-500 to-amber-600",
  "from-rose-500 to-rose-600",
  "from-indigo-500 to-indigo-600",
] as const

export function getInstructorSectionBadgeClass(session: string | null | undefined): string {
  const code = String(session ?? "").trim()
  if (!code) return "border-slate-300 text-slate-700 dark:text-slate-400"
  return BADGE_VARIANTS[hashCode(code) % BADGE_VARIANTS.length]
}

/** Heading for a session code; pass labelByCode from catalog when available. */
export function getSectionColumnHeading(code: string, labelByCode?: Map<string, string>): string {
  if (code === "ALL") return "All sections"
  return labelByCode?.get(code) ?? code
}

export function getSessionStatGradient(session: string | null | undefined): string {
  const k = String(session ?? "").trim()
  if (!k) return "from-slate-500 to-slate-600"
  return STAT_GRADIENT_VARIANTS[hashCode(k) % STAT_GRADIENT_VARIANTS.length]
}

/**
 * @deprecated Stale bundles may still import these; they are empty arrays — use `useSessionCatalog()` / DB catalog.
 * Prevents runtime "is not iterable" when spreading or iterating.
 */
export const INSTRUCTOR_SECTION_OPTIONS: readonly string[] = []

/** @deprecated Use `useSessionCatalog().selectOptions` */
export const INSTRUCTOR_SECTION_SELECT_OPTIONS: readonly { value: string; label: string }[] = []
