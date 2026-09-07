"use client"

import { useCallback, useEffect, useState } from "react"
import { getStudentData } from "@/lib/auth"
import { getStudentDatabaseId } from "@/lib/student-session-ids"
import { applyLocalEnrollmentToBrowseHub } from "@/lib/summer-camp/enroll-client"

/** Menu view → dedicated summer camp API route */
export const CAMP_VIEW_API: Record<string, string> = {
  dashboard: "/api/summer-camp/dashboard",
  "my-trainings": "/api/summer-camp/my-trainings",
  browse: "/api/summer-camp/browse-trainings",
  roadmap: "/api/summer-camp/roadmap",
  projects: "/api/summer-camp/camp-projects",
  checkpoints: "/api/summer-camp/checkpoints",
  discussions: "/api/summer-camp/discussions-hub",
  resources: "/api/summer-camp/resources",
  achievements: "/api/summer-camp/achievements",
  leaderboard: "/api/summer-camp/leaderboard",
  gallery: "/api/summer-camp/gallery",
  graduation: "/api/summer-camp/graduation",
  calendar: "/api/summer-camp/calendar",
  announcements: "/api/summer-camp/announcements",
  support: "/api/summer-camp/support",
}

const PUBLIC_VIEWS = new Set(["browse", "support"])

export function useCampHub<T>(
  view: string,
  options?: { public?: boolean; queryParams?: Record<string, string> },
) {
  const session = getStudentData()
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isPublic = options?.public ?? PUBLIC_VIEWS.has(view)
  const extraParams = options?.queryParams

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true)
    setError(null)
    try {
      const api = CAMP_VIEW_API[view] ?? `/api/summer-camp/hub?view=${view}`
      const params = new URLSearchParams()
      const studentDbId = getStudentDatabaseId()
      if (studentDbId) {
        params.set("studentDatabaseId", studentDbId)
      }
      if (extraParams) {
        for (const [key, value] of Object.entries(extraParams)) {
          params.set(key, value)
        }
      }
      const qs = params.toString()
      const res = await fetch(qs ? `${api}?${qs}` : api)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Failed to load")
      }
      const json = await res.json()
      setData(view === "browse" ? applyLocalEnrollmentToBrowseHub(json) : json)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      if (!options?.silent) setLoading(false)
    }
  }, [view, extraParams])

  useEffect(() => {
    void load()
  }, [load])

  return { data, loading, error, reload: load, setData, session }
}
