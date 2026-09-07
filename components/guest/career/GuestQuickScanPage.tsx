"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Loader2, Zap } from "lucide-react"
import { getStudentData } from "@/lib/auth"
import type { ApplicationWorkspace, CareerAnalysis } from "@/lib/guest/career/types"
import type { CareerAccessTier, CareerAnalysisIssueCounts } from "@/lib/guest/career/preview-gate"
import { CareerHistoryPanel } from "@/components/guest/career/CareerHistoryPanel"
import { CareerMatchReport } from "@/components/guest/career/CareerMatchReport"
import { GuestMasterResumePanel } from "@/components/guest/career/GuestMasterResumePanel"
import { useGuestDashboard } from "@/components/guest/dashboard/GuestDashboardContext"
import { guestHasCapability } from "@/lib/guest/capabilities"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { EMBED_MATERIAL_PANEL } from "@/components/student/dashboard-v2/embed-module-ui"
import { cn } from "@/lib/utils"

import { GUEST_FREE_COMPLIMENTARY_RESUME_MATCHES } from "@/lib/guest/membership-config"

export function GuestQuickScanPage() {
  const searchParams = useSearchParams()
  const applicationId = searchParams.get("applicationId")
  const { entitlements, refreshEntitlements } = useGuestDashboard()
  const hasCareer = guestHasCapability(entitlements.capabilities, "career.cora")

  const [hasResume, setHasResume] = useState<boolean | null>(null)
  const [opportunityText, setOpportunityText] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [analysis, setAnalysis] = useState<CareerAnalysis | null>(null)
  const [application, setApplication] = useState<ApplicationWorkspace | null>(null)
  const [accessTier, setAccessTier] = useState<CareerAccessTier>(hasCareer ? "full" : "preview")
  const [issueCounts, setIssueCounts] = useState<CareerAnalysisIssueCounts | null>(null)
  const [complimentaryRemaining, setComplimentaryRemaining] = useState<number | null>(null)

  const checkResume = useCallback(async () => {
    const d = getStudentData()
    if (!d?.databaseId) return
    const res = await fetch(`/api/guest/career/home?studentDatabaseId=${encodeURIComponent(d.databaseId)}`)
    const json = await res.json()
    if (res.ok) {
      setHasResume(Boolean(json.masterResume?.parsedText?.trim()))
      const rem = json.complimentaryResumeMatches?.remaining
      if (typeof rem === "number") setComplimentaryRemaining(rem)
    }
  }, [])

  const loadExisting = useCallback(async () => {
    if (!applicationId) return
    const d = getStudentData()
    if (!d?.databaseId) return
    const res = await fetch(
      `/api/guest/career/applications?studentDatabaseId=${encodeURIComponent(d.databaseId)}&applicationId=${applicationId}`,
    )
    const json = await res.json()
    if (res.ok) {
      setApplication(json.application ?? null)
      setAnalysis(json.analysis ?? null)
      if (json.accessTier) setAccessTier(json.accessTier)
      if (json.issueCounts) setIssueCounts(json.issueCounts)
    }
  }, [applicationId])

  useEffect(() => {
    void checkResume()
    void loadExisting()
  }, [checkResume, loadExisting])

  useEffect(() => {
    setAccessTier(hasCareer ? "full" : "preview")
  }, [hasCareer])

  async function quickScan() {
    const d = getStudentData()
    if (!d?.databaseId) return
    if (!opportunityText.trim()) {
      setError("Paste a job description or opportunity.")
      return
    }
    setBusy(true)
    setError("")
    setAnalysis(null)
    try {
      const res = await fetch("/api/guest/career/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentDatabaseId: d.databaseId,
          opportunityDescription: opportunityText,
          useMasterResume: true,
        }),
      })
      const json = await res.json()
      if (json.needsResume) {
        setHasResume(false)
        throw new Error("Add your master résumé in Settings or below first.")
      }
      if (!res.ok) {
        if (res.status === 402 && json.needsCredits) {
          throw new Error(json.error || "Not enough Cora Credits. Add a credit pack to continue.")
        }
        if (res.status === 403 && json.upgradeUrl) {
          throw new Error(
            json.error ||
              `Complimentary scans used (${GUEST_FREE_COMPLIMENTARY_RESUME_MATCHES} lifetime). Unlock Cora Career for full Resume Match.`,
          )
        }
        throw new Error(json.error || "Scan failed")
      }
      if (typeof json.complimentaryResumeMatches?.remaining === "number") {
        setComplimentaryRemaining(json.complimentaryResumeMatches.remaining)
      }
      setAnalysis(json.analysis)
      setApplication(json.application)
      setAccessTier(json.accessTier ?? (hasCareer ? "full" : "preview"))
      setIssueCounts(json.issueCounts ?? null)
      void refreshEntitlements()
      window.history.replaceState(null, "", `/guest/cora-career/quick-scan?applicationId=${json.application.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed")
    } finally {
      setBusy(false)
    }
  }

  if (analysis && application) {
    return (
      <div className="space-y-5">
        <div className="text-center">
          <h1 className="text-xl font-bold text-[var(--cc-text)] sm:text-2xl">Quick scan results</h1>
          <p className="mt-1 text-sm text-[var(--cc-text-muted)]">Matched against your saved master résumé.</p>
        </div>
        <CareerMatchReport
          application={application}
          analysis={analysis}
          accessTier={accessTier}
          issueCounts={issueCounts}
        />
        <Button variant="outline" className="rounded-xl" asChild>
          <Link href="/guest/cora-career/quick-scan">Scan another opportunity</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-xl font-bold text-[var(--cc-text)] sm:text-2xl">Quick scan</h1>
        <p className="mx-auto mt-1 max-w-lg text-sm text-[var(--cc-text-muted)]">
          Paste a job description — Cora matches it to your saved master résumé instantly.
          {!hasCareer && complimentaryRemaining != null ? (
            <span className="mt-1 block text-xs">
              {complimentaryRemaining} of {GUEST_FREE_COMPLIMENTARY_RESUME_MATCHES} complimentary scans remaining
            </span>
          ) : null}
        </p>
      </div>

      {hasResume === false ? (
        <div className={cn(EMBED_MATERIAL_PANEL, "p-4 sm:p-5")}>
          <p className="mb-3 text-sm font-semibold text-[var(--cc-text)]">First, add your master résumé</p>
          <GuestMasterResumePanel compact onSaved={() => void checkResume()} />
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <div className={cn(EMBED_MATERIAL_PANEL, "p-4 sm:p-5")}>
        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--cc-text)]">
          <Zap className="size-4 text-violet-600" />
          Paste opportunity
        </label>
        <Textarea
          value={opportunityText}
          onChange={(e) => setOpportunityText(e.target.value)}
          placeholder="Job description, program requirements, or scholarship details…"
          className="min-h-[240px] rounded-xl"
          disabled={hasResume === false}
        />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--cc-text-muted)]">
            Uses your master résumé from Settings.{" "}
            <Link href="/guest/settings?section=cora" className="text-violet-600 hover:underline">
              Update résumé
            </Link>
          </p>
          <Button className="rounded-xl px-6" disabled={busy || hasResume === false} onClick={() => void quickScan()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {busy ? "Scanning…" : "Quick scan"}
          </Button>
        </div>
      </div>

      <CareerHistoryPanel kind="scans" linkBase="/guest/cora-career/quick-scan" />
    </div>
  )
}
