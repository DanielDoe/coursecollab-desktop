"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"
import { InstitutionDashboardHub } from "@/components/institution/InstitutionDashboardHub"
import { useInstitutionJson } from "@/components/institution/institution-page"
import { dashboardV2PageStackClass } from "@/lib/dashboard-v2-layout"
import { INSTITUTION_DASHBOARD_BASE } from "@/lib/institution-portal-nav-config"
import type { InstitutionDashboardMetrics } from "@/lib/institutions/metrics/types"

function StripLegacyDashboardSectionQuery() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get("section")) {
      router.replace(INSTITUTION_DASHBOARD_BASE, { scroll: false })
    }
  }, [router, searchParams])

  return null
}

function DashboardContent() {
  const { data, loading, error } = useInstitutionJson<InstitutionDashboardMetrics>("/api/institution/dashboard")

  if (loading) {
    return <ModulePageSkeleton className="min-h-[520px]" />
  }

  if (error) {
    return <p className="text-sm text-[var(--cc-danger)]">{error}</p>
  }

  if (!data) return null

  return <InstitutionDashboardHub data={data} />
}

export default function InstitutionDashboardPage() {
  return (
    <PageEnter className={dashboardV2PageStackClass}>
      <Suspense fallback={null}>
        <StripLegacyDashboardSectionQuery />
      </Suspense>
      <DashboardContent />
    </PageEnter>
  )
}
