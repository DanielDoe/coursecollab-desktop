"use client"

import { useEffect, useState } from "react"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

export default function AdminQuotesPage() {
  const [quotes, setQuotes] = useState<Array<Record<string, unknown>>>([])
  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/institution-quotes", { credentials: "include" })
      if (res.ok) {
        const data = await res.json()
        setQuotes(data.quotes ?? [])
      }
    })()
  }, [])
  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="w-full min-w-0 p-4 md:p-5">
          <h1 className={cn("mb-4 text-2xl font-semibold", PORTAL_TEXT)}>Institution quotes</h1>
          <div className={cn(PORTAL_CARD, "divide-y divide-[var(--border)]")}>
            {quotes.length === 0 ? (
              <p className={cn("px-4 py-6 text-sm", PORTAL_TEXT_MUTED)}>No quotes.</p>
            ) : (
              quotes.map((q) => (
                <div key={String(q.id)} className="px-4 py-3 text-sm">
                  <p className={PORTAL_TEXT}>{String(q.institution_name || q.contact_email || `Quote ${q.id}`)}</p>
                  <p className={PORTAL_TEXT_MUTED}>{String(q.plan_id)} · {String(q.status)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
