"use client"

import { useCallback, useEffect, useState } from "react"

export function readInstructorScopeKey(): string {
  if (typeof localStorage === "undefined") return "none"
  try {
    const raw = localStorage.getItem("instructorSession")
    if (!raw) return "none"
    const s = JSON.parse(raw) as {
      selectedCourseId?: number
      selectedSessionId?: number
      selectedAcademicTermId?: number
    }
    return `${s.selectedCourseId ?? ""}:${s.selectedSessionId ?? ""}:${s.selectedAcademicTermId ?? ""}`
  } catch {
    return "none"
  }
}

/** Re-run data loaders when the faculty course / section / term selection changes. */
export function useInstructorScopeKey(): string {
  const [scopeKey, setScopeKey] = useState(readInstructorScopeKey)

  const refresh = useCallback(() => {
    setScopeKey(readInstructorScopeKey())
  }, [])

  useEffect(() => {
    refresh()
    window.addEventListener("storage", refresh)
    window.addEventListener("instructor-scope-changed", refresh)
    return () => {
      window.removeEventListener("storage", refresh)
      window.removeEventListener("instructor-scope-changed", refresh)
    }
  }, [refresh])

  return scopeKey
}
