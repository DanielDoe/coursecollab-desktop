"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { getStudentData } from "@/lib/auth"
import type { ApplicationWorkspace, CareerAnalysis } from "@/lib/guest/career/types"
import type { CareerAccessTier, CareerAnalysisIssueCounts } from "@/lib/guest/career/preview-gate"
import { CareerHistoryPanel } from "@/components/guest/career/CareerHistoryPanel"
import { CareerMatchReport } from "@/components/guest/career/CareerMatchReport"
import { CareerNewScanForm } from "@/components/guest/career/CareerNewScanForm"
import { useGuestDashboard } from "@/components/guest/dashboard/GuestDashboardContext"
import { guestHasCapability } from "@/lib/guest/capabilities"

export function GuestResumeMatchPage() {
  const searchParams = useSearchParams()
  const applicationId = searchParams.get("applicationId")
  const { entitlements, refreshEntitlements } = useGuestDashboard()
  const hasCareer = guestHasCapability(entitlements.capabilities, "career.cora")

  const [resumeText, setResumeText] = useState("")
  const [opportunityText, setOpportunityText] = useState("")
  const [resumeFileName, setResumeFileName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [analysis, setAnalysis] = useState<CareerAnalysis | null>(null)
  const [application, setApplication] = useState<ApplicationWorkspace | null>(null)
  const [accessTier, setAccessTier] = useState<CareerAccessTier>(hasCareer ? "full" : "preview")
  const [issueCounts, setIssueCounts] = useState<CareerAnalysisIssueCounts | null>(null)

  const loadResume = useCallback(async () => {
    const d = getStudentData()
    if (!d?.databaseId) return
    const res = await fetch(`/api/guest/career/resumes?studentDatabaseId=${encodeURIComponent(d.databaseId)}`)
    const json = await res.json()
    if (res.ok && json.masterResume) {
      setResumeText(json.masterResume.parsedText ?? "")
      setResumeFileName(json.masterResume.originalFileName ?? null)
      if (json.accessTier) setAccessTier(json.accessTier)
    }
  }, [])

  const loadExistingAnalysis = useCallback(async () => {
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
    void loadResume()
    void loadExistingAnalysis()
  }, [loadResume, loadExistingAnalysis])

  useEffect(() => {
    setAccessTier(hasCareer ? "full" : "preview")
  }, [hasCareer])

  async function analyze() {
    const d = getStudentData()
    if (!d?.databaseId) return
    if ((!resumeText.trim() && !resumeFileName) || !opportunityText.trim()) {
      setError("Upload a résumé (or paste text) and add an opportunity description.")
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
          // Pasted text overrides; otherwise the stored master résumé is used.
          ...(resumeText.trim() ? { parsedText: resumeText } : { useMasterResume: true }),
          opportunityDescription: opportunityText,
        }),
      })
      const json = await res.json()
      if (res.status === 402 && json.needsCredits) {
        throw new Error(json.error || "Not enough Cora Credits. Add a credit pack to continue.")
      }
      if (!res.ok) throw new Error(json.error || "Analysis failed")
      setAnalysis(json.analysis)
      setApplication(json.application)
      setAccessTier(json.accessTier ?? (hasCareer ? "full" : "preview"))
      setIssueCounts(json.issueCounts ?? null)
      void refreshEntitlements()
      window.history.replaceState(
        null,
        "",
        `/guest/cora-career/match?applicationId=${json.application.id}`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed")
    } finally {
      setBusy(false)
    }
  }

  if (analysis && application) {
    return (
      <CareerMatchReport
        application={application}
        analysis={analysis}
        accessTier={accessTier}
        issueCounts={issueCounts}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--cc-text)] sm:text-2xl">Match your résumé</h1>
        <p className="mt-1 text-sm text-[var(--cc-text-muted)]">
          Drop in your résumé and an opportunity to get your match rate in about 30 seconds.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <CareerNewScanForm
        resumeText={resumeText}
        onResumeTextChange={setResumeText}
        opportunityText={opportunityText}
        onOpportunityTextChange={setOpportunityText}
        resumeFileName={resumeFileName}
        onResumeFileSelected={setResumeFileName}
        busy={busy}
        onScan={analyze}
        scanLabel="Scan"
      />

      <CareerHistoryPanel kind="scans" linkBase="/guest/cora-career/match" />
    </div>
  )
}
