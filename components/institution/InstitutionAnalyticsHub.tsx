"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { InstitutionAnalyticsSectionPanel } from "@/components/institution/InstitutionAnalyticsSectionPanel"
import { DataFreshness } from "@/components/institution/InstitutionMetricTooltip"
import { Skeleton } from "@/components/ui/skeleton"
import {
  INSTITUTION_ANALYTICS_API_TABS,
  INSTITUTION_ANALYTICS_MENU,
  parseInstitutionAnalyticsSection,
  type InstitutionAnalyticsSection,
} from "@/lib/institution-analytics-nav-config"
import { InstitutionAnalyticsFilters } from "@/components/institution/InstitutionAnalyticsFilters"
import type { AnalyticsTab, InstitutionAnalyticsMetrics } from "@/lib/institutions/metrics/types"

type TabPayload = Partial<Record<AnalyticsTab, InstitutionAnalyticsMetrics>>

async function fetchAnalyticsTab(tab: AnalyticsTab, searchParams: URLSearchParams): Promise<InstitutionAnalyticsMetrics> {
  const qs = new URLSearchParams(searchParams)
  qs.set("tab", tab)
  const res = await fetch(`/api/institution/analytics?${qs.toString()}`, { credentials: "include" })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed (${res.status})`)
  }
  return res.json() as Promise<InstitutionAnalyticsMetrics>
}

export function InstitutionAnalyticsHub() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const section = parseInstitutionAnalyticsSection(searchParams.get("section"))
  const preset = searchParams.get("preset") ?? "last_30_days"

  const [payload, setPayload] = useState<TabPayload>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)

  const syncSection = useCallback(
    (next: InstitutionAnalyticsSection) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("section", next)
      if (!params.get("preset")) params.set("preset", preset)
      router.replace(`/institution/dashboard/analytics?${params.toString()}`, { scroll: false })
    },
    [router, searchParams, preset],
  )


  useEffect(() => {
    if (!searchParams.get("section")) {
      router.replace(`/institution/dashboard/analytics?section=overview&preset=${preset}`, { scroll: false })
    }
  }, [router, searchParams, preset])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const tabs = INSTITUTION_ANALYTICS_API_TABS[section]
        const results = await Promise.all(tabs.map((tab) => fetchAnalyticsTab(tab, searchParams)))
        if (cancelled) return
        const next: TabPayload = {}
        tabs.forEach((tab, i) => {
          next[tab] = results[i]
        })
        setPayload(next)
        setGeneratedAt(results[0]?.generatedAt ?? null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load analytics")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [section, searchParams])

  return (
    <FacultyModuleSplitLayout
      menuWidthClass="lg:w-56 xl:w-60"
      menu={
        <FacultyModuleSideMenu
          moduleId="analytics"
          title="Analytics"
          accent="theme"
          embedded
          hideTitle
          activeId={section}
          onSelect={(id) => syncSection(id as InstitutionAnalyticsSection)}
          items={INSTITUTION_ANALYTICS_MENU}
          footer={
            <p className="text-xs leading-relaxed text-[var(--cc-text-muted)]">
              Aggregates only. Descriptive ≠ causal. Research outcomes stay hidden until a study and instruments exist.
            </p>
          }
        />
      }
    >
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <InstitutionAnalyticsFilters />
          {generatedAt ? <DataFreshness generatedAt={generatedAt} /> : null}
        </div>

        {error ? <p className="text-sm text-[var(--cc-danger)]">{error}</p> : null}

        {section === "research" ? (
          <InstitutionAnalyticsSectionPanel section={section} payload={payload} />
        ) : loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        ) : (
          <InstitutionAnalyticsSectionPanel section={section} payload={payload} />
        )}
      </div>
    </FacultyModuleSplitLayout>
  )
}

export function InstitutionAnalyticsHubFallback() {
  return (
    <div className="space-y-3 p-1">
      <Skeleton className="h-10 w-48 rounded-xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )
}
