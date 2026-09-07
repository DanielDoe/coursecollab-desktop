import type { SessionCatalogEntry } from "@/lib/session-catalog"
import { dedupeLegacyAliasSessionEntries } from "@/lib/session-code-aliases"

const STORAGE_PREFIX = "cc-session-catalog-v4"
/** Client-side TTL: show cached list instantly, refresh in background after this age. */
export const CLIENT_CATALOG_MAX_AGE_MS = 45 * 60 * 1000

type StoredPayload = {
  v: 4
  fetchedAt: number
  sessions: SessionCatalogEntry[]
}

export function sessionCatalogStorageKey(
  courseId?: number | null,
  academicTermId?: number | null,
): string {
  const cid = courseId != null && Number.isFinite(courseId) ? String(Math.trunc(courseId)) : "__all__"
  const tid =
    academicTermId != null && Number.isFinite(academicTermId) ? String(Math.trunc(academicTermId)) : "__term__"
  return `${STORAGE_PREFIX}:${cid}:${tid}`
}

export function readClientSessionCatalog(
  courseId?: number | null,
  academicTermId?: number | null,
): SessionCatalogEntry[] | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(sessionCatalogStorageKey(courseId, academicTermId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredPayload
    if (parsed.v !== 4 || !Array.isArray(parsed.sessions)) return null
    if (Date.now() - parsed.fetchedAt > CLIENT_CATALOG_MAX_AGE_MS) return null
    return dedupeLegacyAliasSessionEntries(
      parsed.sessions.map((e) => ({ ...e, label: e.code })),
    )
  } catch {
    return null
  }
}

export function writeClientSessionCatalog(
  sessions: SessionCatalogEntry[],
  courseId?: number | null,
  academicTermId?: number | null,
): void {
  if (typeof window === "undefined") return
  try {
    const payload: StoredPayload = { v: 4, fetchedAt: Date.now(), sessions }
    localStorage.setItem(sessionCatalogStorageKey(courseId, academicTermId), JSON.stringify(payload))
  } catch {
    /* quota / private mode */
  }
}

/** Drop scoped catalog entries when the instructor switches course/term. */
export function clearClientSessionCatalog(scope?: {
  courseId?: number | null
  academicTermId?: number | null
}): void {
  if (typeof window === "undefined") return
  try {
    if (scope) {
      localStorage.removeItem(sessionCatalogStorageKey(scope.courseId, scope.academicTermId))
      return
    }
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith(`${STORAGE_PREFIX}:`)) localStorage.removeItem(key)
    }
    // Legacy unscoped cache from v3
    localStorage.removeItem("cc-session-catalog-v3")
  } catch {
    /* ignore */
  }
}
