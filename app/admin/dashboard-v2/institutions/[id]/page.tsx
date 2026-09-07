"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { PORTAL_CARD, PORTAL_CTA, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { INSTITUTION_PLANS } from "@/lib/institution-plans"

export default function AdminInstitutionDetailPage() {
  const params = useParams()
  const id = String(params.id)
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [planId, setPlanId] = useState("program")
  const [courseIds, setCourseIds] = useState("")

  async function load() {
    const res = await fetch(`/api/admin/institutions/${id}`, { credentials: "include" })
    if (res.ok) setData(await res.json())
  }

  useEffect(() => {
    void load()
  }, [id])

  async function createAndActivate() {
    const ids = courseIds.split(/[\s,]+/).map(Number).filter(Number.isFinite)
    await fetch("/api/admin/institutions", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_license",
        institutionId: Number(id),
        planId,
        courseIds: ids,
        activate: true,
        billingMethod: "manual",
      }),
    })
    await load()
  }

  const overview = data?.overview as { institution?: { name: string }; license?: { planName: string; status: string } } | undefined

  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="w-full min-w-0 space-y-4 p-4 md:p-5">
          <h1 className={cn("text-2xl font-semibold", PORTAL_TEXT)}>{overview?.institution?.name ?? "Institution"}</h1>
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
            License: {overview?.license?.planName ?? "none"} · {overview?.license?.status ?? "inactive"}
          </p>
          <div className="flex flex-wrap gap-2">
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} className="h-10 rounded-xl border border-[var(--border)] px-3 text-sm">
              {INSTITUTION_PLANS.filter((p) => p.active).sort((a, b) => a.displayOrder - b.displayOrder).map((plan) => (
                <option key={plan.planKey} value={plan.planKey}>{plan.displayName}</option>
              ))}
            </select>
            <input className="h-10 min-w-48 flex-1 rounded-xl border border-[var(--border)] px-3 text-sm" placeholder="Covered course IDs" value={courseIds} onChange={(e) => setCourseIds(e.target.value)} />
            <button type="button" className={cn(PORTAL_CTA, "rounded-xl px-4 text-sm")} onClick={() => void createAndActivate()}>
              Create & activate license
            </button>
          </div>
          <div className={cn(PORTAL_CARD, "p-4 text-xs", PORTAL_TEXT_MUTED)}>
            <p className="font-medium text-[var(--cc-text)]">Economics (platform admin)</p>
            <pre className="mt-2 overflow-auto">{JSON.stringify(data?.economics ?? {}, null, 2)}</pre>
          </div>
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
