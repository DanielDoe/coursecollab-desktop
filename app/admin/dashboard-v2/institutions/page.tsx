"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

type Inst = { id: number; name: string; slug: string | null; domain: string | null; status: string }

type RequestRow = {
  id: number
  institution_name: string
  contact_email: string
  desired_plan: string | null
  request_kind: string
  status: string
}

export default function AdminInstitutionsPage() {
  const [rows, setRows] = useState<Inst[]>([])
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/institutions", { credentials: "include" })
      if (!res.ok) {
        setError("Unable to load institutions")
        return
      }
      const data = await res.json()
      setRows(data.institutions ?? [])
      setRequests(data.requests ?? [])
    })()
  }, [])

  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="w-full min-w-0 p-4 md:p-5">
          <h1 className={cn("mb-4 text-2xl font-semibold", PORTAL_TEXT)}>Institutions</h1>
          {error ? <p className="text-sm text-[var(--cc-danger)]">{error}</p> : null}
          <div className={cn(PORTAL_CARD, "divide-y divide-[var(--border)]")}>
            {rows.length === 0 ? (
              <p className={cn("px-4 py-6 text-sm", PORTAL_TEXT_MUTED)}>No institutions.</p>
            ) : (
              rows.map((row) => (
                <Link key={row.id} href={`/admin/dashboard-v2/institutions/${row.id}`} className="block px-4 py-3 hover:bg-muted/40">
                  <p className={cn("text-sm font-medium", PORTAL_TEXT)}>{row.name}</p>
                  <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{row.domain || row.slug} · {row.status}</p>
                </Link>
              ))
            )}
          </div>
          <h2 className={cn("mb-3 mt-8 text-lg font-semibold", PORTAL_TEXT)}>Demo & quote requests</h2>
          <div className={cn(PORTAL_CARD, "divide-y divide-[var(--border)]")}>
            {requests.length === 0 ? (
              <p className={cn("px-4 py-6 text-sm", PORTAL_TEXT_MUTED)}>No inbound requests yet.</p>
            ) : (
              requests.map((row) => (
                <div key={row.id} className="px-4 py-3">
                  <p className={cn("text-sm font-medium", PORTAL_TEXT)}>{row.institution_name}</p>
                  <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                    {row.contact_email} · {row.request_kind} · {row.desired_plan ?? "no plan"} · {row.status}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
