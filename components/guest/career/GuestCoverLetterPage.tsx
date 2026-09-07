"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { getStudentData } from "@/lib/auth"
import { guestHasCapability } from "@/lib/guest/capabilities"
import type { ApplicationWorkspace, CoverLetter } from "@/lib/guest/career/types"
import type { CareerAccessTier } from "@/lib/guest/career/preview-gate"
import { CareerCoverLetterReport } from "@/components/guest/career/CareerCoverLetterReport"
import { CareerHistoryPanel } from "@/components/guest/career/CareerHistoryPanel"
import { CareerNewScanForm } from "@/components/guest/career/CareerNewScanForm"
import {
  COVER_LETTER_WORKFLOW_STEPS,
  CareerWorkflowStepper,
} from "@/components/guest/career/CareerWorkflowStepper"
import { useGuestDashboard } from "@/components/guest/dashboard/GuestDashboardContext"

type GatedCoverLetter = CoverLetter & {
  lockedParagraphCount?: number
  totalParagraphCount?: number
}

export function GuestCoverLetterPage() {
  const searchParams = useSearchParams()
  const applicationId = searchParams.get("applicationId")
  const { entitlements, refreshEntitlements } = useGuestDashboard()
  const hasCareer = guestHasCapability(entitlements.capabilities, "career.cora")

  const [resumeText, setResumeText] = useState("")
  const [opportunityText, setOpportunityText] = useState("")
  const [resumeFileName, setResumeFileName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [coverLetter, setCoverLetter] = useState<GatedCoverLetter | null>(null)
  const [application, setApplication] = useState<ApplicationWorkspace | null>(null)
  const [accessTier, setAccessTier] = useState<CareerAccessTier>(hasCareer ? "full" : "preview")

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

  const loadExisting = useCallback(async () => {
    if (!applicationId) return
    const d = getStudentData()
    if (!d?.databaseId) return
    const res = await fetch(
      `/api/guest/career/cover-letter?studentDatabaseId=${encodeURIComponent(d.databaseId)}&applicationId=${applicationId}`,
    )
    const json = await res.json()
    if (res.ok && json.coverLetter) {
      setApplication(json.application ?? null)
      setCoverLetter(json.coverLetter)
      if (json.accessTier) setAccessTier(json.accessTier)
      if (json.application?.opportunity?.description) {
        setOpportunityText(json.application.opportunity.description)
      }
    }
  }, [applicationId])

  useEffect(() => {
    void loadResume()
    void loadExisting()
  }, [loadResume, loadExisting])

  useEffect(() => {
    setAccessTier(hasCareer ? "full" : "preview")
  }, [hasCareer])

  async function generate() {
    const d = getStudentData()
    if (!d?.databaseId) return
    if ((!resumeText.trim() && !resumeFileName) || !opportunityText.trim()) {
      setError("Upload a résumé (or paste text) and add an opportunity description.")
      return
    }
    setBusy(true)
    setError("")
    setCoverLetter(null)
    try {
      const res = await fetch("/api/guest/career/cover-letter", {
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
      if (!res.ok) throw new Error(json.error || "Generation failed")
      setCoverLetter(json.coverLetter)
      setApplication(json.application)
      setAccessTier(json.accessTier ?? (hasCareer ? "full" : "preview"))
      void refreshEntitlements()
      window.history.replaceState(
        null,
        "",
        `/guest/cora-career/cover-letter?applicationId=${json.application.id}`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed")
    } finally {
      setBusy(false)
    }
  }

  if (coverLetter && application) {
    return (
      <div className="space-y-5">
        <div className="text-center">
          <h1 className="text-xl font-bold text-[var(--cc-text)] sm:text-2xl">Cover letter generator</h1>
          <p className="mx-auto mt-1 max-w-xl text-sm text-[var(--cc-text-muted)]">
            Your draft is ready — unlock or copy when you have full access.
          </p>
        </div>
        <CareerWorkflowStepper steps={COVER_LETTER_WORKFLOW_STEPS} activeStep={2} />
        <CareerCoverLetterReport
          application={application}
          coverLetter={coverLetter}
          accessTier={accessTier}
          busy={busy}
          onRegenerate={() => void generate()}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-xl font-bold text-[var(--cc-text)] sm:text-2xl">Cover letter generator</h1>
        <p className="mx-auto mt-1 max-w-xl text-sm text-[var(--cc-text-muted)]">
          Create a professional cover letter from your résumé and an opportunity — grounded in your materials only.
        </p>
      </div>

      <CareerWorkflowStepper steps={COVER_LETTER_WORKFLOW_STEPS} activeStep={1} />

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
        onScan={generate}
        scanLabel="Generate cover letter"
        footerNote="Cora drafts from your résumé only — it will not invent qualifications."
      />

      <CareerHistoryPanel kind="coverLetters" linkBase="/guest/cora-career/cover-letter" />
    </div>
  )
}
