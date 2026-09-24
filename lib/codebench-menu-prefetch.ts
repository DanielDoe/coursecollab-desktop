import { codebenchMenuCacheKeys, readCodebenchMenuCache, writeCodebenchMenuCache } from "@/lib/codebench-menu-cache"

const FRESH_MS = 45_000

async function warm<T>(key: string, load: () => Promise<T | null | undefined>) {
  if (readCodebenchMenuCache(key, FRESH_MS)) return
  try {
    const value = await load()
    if (value != null) writeCodebenchMenuCache(key, value)
  } catch {
    // Opening the menu still loads on its own.
  }
}

/** Fill student menu caches while the overview is on screen. */
export function prefetchStudentCodebenchMenus(studentId: string) {
  const id = encodeURIComponent(studentId)
  void warm(codebenchMenuCacheKeys.leaderboard(studentId), async () => {
    const response = await fetch(`/api/codebench/leaderboard?studentId=${id}`)
    if (!response.ok) return null
    const data = await response.json()
    return data.leaderboard ?? []
  })
  void warm(codebenchMenuCacheKeys.streak(studentId), async () => {
    const response = await fetch(`/api/codebench/streak?studentId=${id}`)
    if (!response.ok) return null
    const data = await response.json()
    return {
      streakDays: data.streakDays || 0,
      calendarData: data.calendarData || {},
      days: data.days || {},
      activityStats: data.activityStats || {},
    }
  })
  void warm(codebenchMenuCacheKeys.badges(studentId), async () => {
    const response = await fetch(`/api/codebench/badges?studentId=${id}`)
    if (!response.ok) return null
    const data = await response.json()
    return {
      unlockedIds: Object.keys(data.badges || {}).filter((badgeId) => data.badges[badgeId]),
      badgeDetails: data.badgeDetails || {},
    }
  })
  void warm(codebenchMenuCacheKeys.analytics(studentId), async () => {
    const response = await fetch(`/api/codebench/analytics?studentId=${id}`)
    if (!response.ok) return null
    const data = await response.json()
    return { performance: data.performance, studio: data.studio }
  })
}

/** Fill instructor list caches before those menus are opened. */
export async function prefetchFacultyCodebenchMenus(scopeKey: string, sessionFilter: string) {
  const { instructorApiFetch, readInstructorApiJson } = await import("@/lib/instructor-api-headers")
  void warm(codebenchMenuCacheKeys.facultyAssignments(sessionFilter), async () => {
    const params = new URLSearchParams({ manage: "1" })
    if (sessionFilter !== "all") params.set("session", sessionFilter)
    const response = await instructorApiFetch(`/api/classroom-points/submissions?${params}`)
    if (!response.ok) return null
    const data = (await response.json()) as { submissions?: unknown[] }
    return Array.isArray(data.submissions) ? data.submissions : []
  })
  void warm(codebenchMenuCacheKeys.facultyActivity(scopeKey, "30"), async () => {
    const response = await instructorApiFetch("/api/instructor/codebench/student-activity?days=30")
    const parsed = await readInstructorApiJson<unknown>(response, "CodeBench student activity")
    return parsed.ok ? parsed.data : null
  })
  void warm(codebenchMenuCacheKeys.facultyLive(scopeKey), async () => {
    const response = await instructorApiFetch("/api/instructor/codebench/live-session")
    if (response.status === 400 || response.status === 404 || response.status === 405) return []
    const parsed = await readInstructorApiJson<{ sessions?: unknown[] }>(response, "Open live sessions")
    if (!parsed.ok) return null
    return Array.isArray(parsed.data.sessions) ? parsed.data.sessions : []
  })
}
