"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { getStudentData } from "@/lib/auth"
import type { ApplicationWorkspace, CareerAnalysis } from "@/lib/guest/career/types"
import type { CareerAccessTier, CareerAnalysisIssueCounts } from "@/lib/guest/career/preview-gate"
import { CareerMatchReport } from "@/components/guest/career/CareerMatchReport"
import { GuestModulePage } from "@/components/guest/dashboard/GuestModulePage"
import { Button } from "@/components/ui/button"

export default function GuestApplicationWorkspacePage() {
  const params = useParams<{ id: string }>()
  const [application, setApplication] = useState<ApplicationWorkspace | null>(null)
  const [analysis, setAnalysis] = useState<CareerAnalysis | null>(null)
  const [accessTier, setAccessTier] = useState<CareerAccessTier>("preview")
  const [issueCounts, setIssueCounts] = useState<CareerAnalysisIssueCounts | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    const d = getStudentData()
    if (!d?.databaseId) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/guest/career/applications?studentDatabaseId=${encodeURIComponent(d.databaseId)}&applicationId=${params.id}`,
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Not found")
      setApplication(json.application)
      setAnalysis(json.analysis)
      if (json.accessTier) setAccessTier(json.accessTier)
      if (json.issueCounts) setIssueCounts(json.issueCounts)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <GuestModulePage>
      <div className="mb-4">
        <Button variant="ghost" size="sm" className="rounded-lg" asChild>
          <Link href="/guest/cora-career/applications">← Applications</Link>
        </Button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--cc-text-muted)]">
          <Loader2 className="size-4 animate-spin" /> Loading workspace…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : application && analysis ? (
        <CareerMatchReport
          application={application}
          analysis={analysis}
          accessTier={accessTier}
          issueCounts={issueCounts}
        />
      ) : application ? (
        <p className="text-sm text-[var(--cc-text-muted)]">
          No match analysis yet.{" "}
          <Link href="/guest/cora-career/match" className="text-[var(--cc-accent-dark)] hover:underline">
            Run résumé match
          </Link>
        </p>
      ) : null}
    </GuestModulePage>
  )
}
