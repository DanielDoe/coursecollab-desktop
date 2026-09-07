"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { CourseExchangeProvenanceBanner } from "@/components/instructor/course-exchange/CourseExchangeProvenanceBanner"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { getInstructorData } from "@/lib/auth"
import {
  parseExchangeProvenance,
  type ExchangeProvenance,
} from "@/lib/course-exchange/provenance-shared"
import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"
import { cn } from "@/lib/utils"

export function FacultyExchangeProvenanceStrip({ className }: { className?: string }) {
  const { courseScopeVersion, portal } = useInstructorDashboardV2()
  const pathname = usePathname()
  const [provenance, setProvenance] = useState<ExchangeProvenance | null>(null)

  useEffect(() => {
    if (portal === "admin") {
      setProvenance(null)
      return
    }

    const selectedId = getInstructorData()?.selectedCourseId
    if (selectedId == null) {
      setProvenance(null)
      return
    }

    let cancelled = false
    void instructorApiFetch("/api/instructor/courses", { headers: buildInstructorApiHeaders() })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        const list = (data?.offerings ?? data?.courses ?? []) as Array<{
          id?: number
          course_id?: number
          exchange_provenance?: unknown
        }>
        const course = list.find((c) => Number(c.id ?? c.course_id) === Number(selectedId))
        setProvenance(parseExchangeProvenance(course?.exchange_provenance))
      })
      .catch(() => {
        if (!cancelled) setProvenance(null)
      })

    return () => {
      cancelled = true
    }
  }, [courseScopeVersion, portal])

  if (!provenance) return null

  const onExchangePage = pathname.includes(`${FACULTY_DASHBOARD_BASE}/course/exchange`)
  if (onExchangePage) return null

  return (
    <div className={cn("mb-3", className)}>
      <CourseExchangeProvenanceBanner provenance={provenance} variant="compact" />
      <p className="mt-1.5 text-[11px] text-[var(--cc-text-muted)]">
        Manage lineage in{" "}
        <Link
          href={`${FACULTY_DASHBOARD_BASE}/course/exchange?tab=shared-with-me`}
          className="font-medium text-[var(--cc-accent-dark)] underline-offset-2 hover:underline"
        >
          Course Exchange → Shared With Me
        </Link>
        .
      </p>
    </div>
  )
}
