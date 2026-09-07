"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import type { SessionCatalogEntry } from "@/lib/session-catalog"
import { readClientSessionCatalog, writeClientSessionCatalog, clearClientSessionCatalog } from "@/lib/session-catalog-client-storage"
import { SESSION_DOT_PALETTE } from "@/lib/instructor-section-presets"
import { augmentLabelByCodeWithLegacyAliases, dedupeLegacyAliasSessionEntries } from "@/lib/session-code-aliases"
import { isFacultyDashboardV2Path } from "@/lib/faculty-dashboard-path"

export type SessionCatalogContextValue = {
  entries: SessionCatalogEntry[]
  /** Session codes from DB only (no synthetic ALL). */
  codes: string[]
  /** DB codes plus ALL for trade/practice-style matrices. */
  codesWithAll: string[]
  selectOptions: { value: string; label: string }[]
  accessRows: { code: string; label: string; dotClass: string }[]
  labelByCode: Map<string, string>
  /** First session by sort order; empty if none. */
  defaultCode: string
  /** First two codes for compact KPIs (e.g. practice hub). */
  primaryKpiCodes: string[]
  loading: boolean
  error: string | null
  /** True once we have at least one session from cache or network. */
  ready: boolean
  refresh: () => Promise<void>
}

const SessionCatalogContext = createContext<SessionCatalogContextValue | null>(null)

function selectedInstructorCourseScopeFromStorage(): {
  courseId: number | null
  academicTermId: number | null
} {
  if (typeof window === "undefined") return { courseId: null, academicTermId: null }
  try {
    const raw = localStorage.getItem("instructorSession")
    if (!raw) return { courseId: null, academicTermId: null }
    const parsed = JSON.parse(raw) as { selectedCourseId?: number; selectedAcademicTermId?: number }
    const courseId =
      typeof parsed?.selectedCourseId === "number" && Number.isFinite(parsed.selectedCourseId)
        ? parsed.selectedCourseId
        : null
    const academicTermId =
      typeof parsed?.selectedAcademicTermId === "number" && Number.isFinite(parsed.selectedAcademicTermId)
        ? parsed.selectedAcademicTermId
        : null
    return { courseId, academicTermId }
  } catch {
    return { courseId: null, academicTermId: null }
  }
}

/** Session catalog is only needed on faculty/admin surfaces — skip network on student/auth routes. */
function needsSessionCatalog(pathname: string | null): boolean {
  if (!pathname) return false
  return (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/instructor") ||
    pathname.startsWith("/faculty")
  )
}

export function SessionCatalogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const catalogNeeded = needsSessionCatalog(pathname)
  const facultyScoped = isFacultyDashboardV2Path(pathname)
  const facultyScope = facultyScoped ? selectedInstructorCourseScopeFromStorage() : { courseId: null, academicTermId: null }
  const facultyCourseId = facultyScope.courseId
  const facultyAcademicTermId = facultyScope.academicTermId
  const [entries, setEntries] = useState<SessionCatalogEntry[]>(() =>
    facultyScoped ? (readClientSessionCatalog(facultyCourseId, facultyAcademicTermId) ?? []) : [],
  )
  const [loading, setLoading] = useState(() => {
    if (!catalogNeeded) return false
    const c = facultyScoped ? readClientSessionCatalog(facultyCourseId, facultyAcademicTermId) : null
    return !c?.length
  })
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!catalogNeeded) return
    const scope = facultyScoped ? selectedInstructorCourseScopeFromStorage() : { courseId: null, academicTermId: null }
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (scope.courseId != null) params.set("courseId", String(scope.courseId))
      if (scope.academicTermId != null) params.set("academicTermId", String(scope.academicTermId))
      const url =
        scope.courseId != null || scope.academicTermId != null
          ? `/api/sessions/catalog?${params.toString()}`
          : `/api/sessions/catalog`
      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load sessions")
      const list = (data.sessions ?? []) as SessionCatalogEntry[]
      setEntries(list)
      writeClientSessionCatalog(list, scope.courseId, scope.academicTermId)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load sessions")
    } finally {
      setLoading(false)
    }
  }, [catalogNeeded, facultyScoped])

  useEffect(() => {
    if (!catalogNeeded) return
    const cached = facultyScoped ? readClientSessionCatalog(facultyCourseId, facultyAcademicTermId) : null
    if (cached?.length) setEntries(cached)
    void refresh()
  }, [catalogNeeded, facultyCourseId, facultyAcademicTermId, facultyScoped, refresh])

  useEffect(() => {
    const bump = () => {
      clearClientSessionCatalog()
      void refresh()
    }
    window.addEventListener("instructor-course-scope-changed", bump)
    return () => window.removeEventListener("instructor-course-scope-changed", bump)
  }, [refresh])

  const value = useMemo((): SessionCatalogContextValue => {
    const catalogEntries = dedupeLegacyAliasSessionEntries(entries)
    const codes = catalogEntries.map((e) => e.code)
    const labelByCode = augmentLabelByCodeWithLegacyAliases(
      new Map(catalogEntries.map((e) => [e.code, e.label] as const)),
    )
    const selectOptions = catalogEntries.map((e) => ({ value: e.code, label: e.label }))
    const accessRows = catalogEntries.map((e, i) => ({
      code: e.code,
      label: e.label,
      dotClass: SESSION_DOT_PALETTE[i % SESSION_DOT_PALETTE.length],
    }))
    const codesWithAll = codes.includes("ALL") ? [...codes] : [...codes, "ALL"]
    const defaultCode = codes[0] ?? ""
    const primaryKpiCodes = codes.slice(0, 2)
    return {
      entries: catalogEntries,
      codes,
      codesWithAll,
      selectOptions,
      accessRows,
      labelByCode,
      defaultCode,
      primaryKpiCodes,
      loading,
      error,
      ready: catalogEntries.length > 0,
      refresh,
    }
  }, [entries, loading, error, refresh])

  return <SessionCatalogContext.Provider value={value}>{children}</SessionCatalogContext.Provider>
}

export function useSessionCatalog(): SessionCatalogContextValue {
  const ctx = useContext(SessionCatalogContext)
  if (!ctx) {
    throw new Error("useSessionCatalog must be used within SessionCatalogProvider")
  }
  return ctx
}
