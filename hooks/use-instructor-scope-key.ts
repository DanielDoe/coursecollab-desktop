"use client"

import { useCallback, useEffect, useState } from "react"

export function readInstructorSelectedSessionCode(): string | null {
  if (typeof localStorage === "undefined") return null
  try {
    const raw = localStorage.getItem("instructorSession")
    if (!raw) return null
    const s = JSON.parse(raw) as { selectedSessionCode?: string }
    const code = String(s.selectedSessionCode ?? "").trim()
    return code || null
  } catch {
    return null
  }
}

/** Faculty lists should default to the selected offering, not every section on the course. */
export function defaultFacultySessionFilter(): string {
  return readInstructorSelectedSessionCode() ?? "all"
}

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
