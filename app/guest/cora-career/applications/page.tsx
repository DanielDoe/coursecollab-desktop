"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { getStudentData } from "@/lib/auth"
import { MATCH_BAND_LABELS } from "@/lib/guest/career/match-config"
import type { ApplicationWorkspace } from "@/lib/guest/career/types"
import { CareerUnlockBanner } from "@/components/guest/career/CareerUnlockBanner"
import { GuestModulePage } from "@/components/guest/dashboard/GuestModulePage"
import { useGuestDashboard } from "@/components/guest/dashboard/GuestDashboardContext"
import { guestHasCapability } from "@/lib/guest/capabilities"
import { EMBED_INNER_PANEL } from "@/components/student/dashboard-v2/embed-module-ui"
import { Button } from "@/components/ui/button"

export default function GuestApplicationsPage() {
  const { entitlements } = useGuestDashboard()
  const hasCareer = guestHasCapability(entitlements.capabilities, "career.cora")
  const [apps, setApps] = useState<ApplicationWorkspace[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const d = getStudentData()
    if (!d?.databaseId) {
      setLoading(false)
      return
    }
    const res = await fetch(
      `/api/guest/career/applications?studentDatabaseId=${encodeURIComponent(d.databaseId)}`,
    )
    const json = await res.json()
    if (res.ok) setApps(json.applications ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <GuestModulePage>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-[var(--cc-text)]">Applications</h1>
          <Button className="rounded-xl" asChild>
            <Link href="/guest/cora-career/match">New scan</Link>
          </Button>
        </div>

        {!hasCareer ? (
          <CareerUnlockBanner description="Track scans and workspaces free — unlock full match detail and optimize tools anytime." />
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--cc-text-muted)]">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : apps.length === 0 ? (
          <p className="text-sm text-[var(--cc-text-muted)]">No application workspaces yet. Run a scan to create one.</p>
        ) : (
          <ul className="space-y-2">
            {apps.map((app) => (
              <li key={app.id}>
                <Link href={`/guest/cora-career/applications/${app.id}`} className="block">
                  <div className={EMBED_INNER_PANEL + " p-4 transition-colors hover:bg-[var(--muted)]/40"}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[var(--cc-text)]">
                          {app.opportunity.organization ?? "Opportunity"}
                        </p>
                        <p className="text-sm text-[var(--cc-text-muted)]">{app.opportunity.title}</p>
                      </div>
                      <div className="text-right text-sm">
                        {app.matchScore != null ? (
                          <p className="font-bold tabular-nums text-[var(--cc-accent-dark)]">{app.matchScore}%</p>
                        ) : null}
                        <p className="text-xs capitalize text-[var(--cc-text-muted)]">
                          {app.matchBand ? MATCH_BAND_LABELS[app.matchBand] : app.status.toLowerCase()}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </GuestModulePage>
  )
}
