"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { INSTITUTION_ANALYTICS_PRESETS } from "@/lib/institution-analytics-nav-config"
import { cn } from "@/lib/utils"

type FilterOptions = {
  courses: Array<{ id: number; code: string; name: string }>
  organizationUnits: Array<{ id: number; name: string }>
  instructors: Array<{ id: number; name: string }>
}

const SELECT =
  "h-9 min-w-0 max-w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 text-sm"

export function InstitutionAnalyticsFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [options, setOptions] = useState<FilterOptions | null>(null)

  const preset = searchParams.get("preset") ?? "last_30_days"
  const courseId = searchParams.get("courseId") ?? ""
  const organizationUnitId = searchParams.get("organizationUnitId") ?? ""
  const instructorId = searchParams.get("instructorId") ?? ""

  useEffect(() => {
    void fetch("/api/institution/analytics/filters", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => setOptions(body))
      .catch(() => setOptions(null))
  }, [])

  function sync(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.replace(`/institution/dashboard/analytics?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <select
        value={preset}
        onChange={(e) => sync("preset", e.target.value)}
        className={SELECT}
        aria-label="Date range"
      >
        {INSTITUTION_ANALYTICS_PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      {options && options.organizationUnits.length > 0 ? (
        <select
          value={organizationUnitId}
          onChange={(e) => sync("organizationUnitId", e.target.value)}
          className={SELECT}
          aria-label="Organization unit"
        >
          <option value="">All org units</option>
          {options.organizationUnits.map((u) => (
            <option key={u.id} value={String(u.id)}>
              {u.name}
            </option>
          ))}
        </select>
      ) : null}
      {options && options.courses.length > 0 ? (
        <select
          value={courseId}
          onChange={(e) => sync("courseId", e.target.value)}
          className={SELECT}
          aria-label="Course"
        >
          <option value="">All courses</option>
          {options.courses.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.code}
            </option>
          ))}
        </select>
      ) : null}
      {options && options.instructors.length > 0 ? (
        <select
          value={instructorId}
          onChange={(e) => sync("instructorId", e.target.value)}
          className={SELECT}
          aria-label="Instructor"
        >
          <option value="">All instructors</option>
          {options.instructors.map((i) => (
            <option key={i.id} value={String(i.id)}>
              {i.name}
            </option>
          ))}
        </select>
      ) : null}
      <p className={cn("hidden text-xs lg:block", PORTAL_TEXT_MUTED)}>Filters apply to all charts on this page.</p>
    </div>
  )
}
