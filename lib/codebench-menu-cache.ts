const PREFIX = "ccb-menu:"
const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000

type CacheRecord = { at: number; value: unknown }

const memory = new Map<string, CacheRecord>()

export const codebenchMenuCacheKeys = {
  leaderboard: (studentId: string) => `student:leaderboard:${studentId}`,
  streak: (studentId: string) => `student:streak:${studentId}`,
  badges: (studentId: string) => `student:badges:${studentId}`,
  analytics: (studentId: string) => `student:analytics:${studentId}`,
  facultyAssignments: (session: string) => `faculty:assignments:${session}`,
  facultyActivity: (scope: string, days: string) => `faculty:activity:${scope}:${days}`,
  facultyLive: (scope: string) => `faculty:live:${scope}`,
}

function storage(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage
  } catch {
    return null
  }
}

export function readCodebenchMenuCache<T>(key: string, maxAgeMs = DEFAULT_MAX_AGE_MS): T | null {
  const now = Date.now()
  const remembered = memory.get(key)
  if (remembered && now - remembered.at <= maxAgeMs) return remembered.value as T

  const store = storage()
  if (!store) return null
  try {
    const raw = store.getItem(PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheRecord
    if (!parsed || typeof parsed.at !== "number" || now - parsed.at > maxAgeMs) return null
    memory.set(key, { at: parsed.at, value: parsed.value })
    return parsed.value as T
  } catch {
    return null
  }
}

export function writeCodebenchMenuCache<T>(key: string, value: T): void {
  const record: CacheRecord = { at: Date.now(), value }
  memory.set(key, record)
  const store = storage()
  if (!store) return
  try {
    store.setItem(PREFIX + key, JSON.stringify(record))
  } catch {
    // sessionStorage can be full or blocked; the in-memory copy still serves this tab
  }
}

export function invalidateCodebenchMenuCache(prefix?: string): void {
  for (const key of [...memory.keys()]) {
    if (!prefix || key.startsWith(prefix)) memory.delete(key)
  }
  const store = storage()
  if (!store) return
  const storagePrefix = PREFIX + (prefix ?? "")
  const doomed: string[] = []
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index)
    if (key?.startsWith(storagePrefix)) doomed.push(key)
  }
  for (const key of doomed) store.removeItem(key)
}
