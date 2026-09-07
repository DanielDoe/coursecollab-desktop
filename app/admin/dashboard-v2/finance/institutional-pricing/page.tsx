"use client"

import { useEffect, useState } from "react"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { formatUsdFromCents } from "@/lib/institution-plans"

type CatalogRow = {
  planKey: string
  displayName: string
  listPriceCents: number | null
  studentCapacity: number | "negotiated"
  instructorCapacity: number | "unlimited"
  pricePerMaxStudentCents: number | null
  trailblazerRetail2SemesterCents: number | null
  trailblazerRetail3SemesterCents: number | null
  discountVs2SemesterBps: number | null
  discountVs3SemesterBps: number | null
  includedCoraCredits: number | "negotiated"
}

function money(cents: number | null | undefined) {
  if (cents == null) return "—"
  return formatUsdFromCents(cents)
}

function bps(value: number | null | undefined) {
  if (value == null) return "—"
  return `${(value / 100).toFixed(1)}%`
}

export default function AdminInstitutionalPricingPage() {
  const [data, setData] = useState<{
    pricingVersion?: number
    disclaimer?: string
    catalog?: CatalogRow[]
    sales?: Record<string, number | null>
  } | null>(null)

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/institutional-pricing", { credentials: "include" })
      if (res.ok) setData(await res.json())
    })()
  }, [])

  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="w-full min-w-0 space-y-4 p-4 md:p-5">
          <h1 className={cn("text-2xl font-semibold", PORTAL_TEXT)}>Institutional pricing</h1>
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
            Version {data?.pricingVersion ?? "—"} · {data?.disclaimer}
          </p>
          <div className={cn(PORTAL_CARD, "divide-y divide-[var(--border)]")}>
            {(data?.catalog ?? []).map((row) => (
              <div key={row.planKey} className="px-4 py-3 text-sm">
                <p className={cn("font-medium", PORTAL_TEXT)}>{row.displayName}</p>
                <p className={PORTAL_TEXT_MUTED}>
                  List {money(row.listPriceCents)} · {String(row.studentCapacity)} students ·{" "}
                  {String(row.instructorCapacity)} instructors · {money(row.pricePerMaxStudentCents)} / max student
                </p>
                <p className={PORTAL_TEXT_MUTED}>
                  Trailblazer 2-sem {money(row.trailblazerRetail2SemesterCents)} ({bps(row.discountVs2SemesterBps)} vs list) ·
                  3-sem {money(row.trailblazerRetail3SemesterCents)} ({bps(row.discountVs3SemesterBps)})
                </p>
                <p className={PORTAL_TEXT_MUTED}>Cora allowance {String(row.includedCoraCredits)}</p>
              </div>
            ))}
          </div>
          <div className={cn(PORTAL_CARD, "p-4 text-xs", PORTAL_TEXT_MUTED)}>
            <p className="font-medium text-[var(--cc-text)]">Sales metrics</p>
            <pre className="mt-2 overflow-auto">{JSON.stringify(data?.sales ?? {}, null, 2)}</pre>
          </div>
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
