"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowRight,
  Check,
  ClipboardCopy,
  Loader2,
  Save,
  Sparkles,
  Wand2,
  Wrench,
} from "lucide-react"
import { getStudentData } from "@/lib/auth"
import { guestHasCapability } from "@/lib/guest/capabilities"
import { GUEST_CAREER_AI_FEATURE_COSTS } from "@/lib/guest/career/guest-ai-credit-costs"
import type { ResumeOptimizeResult } from "@/lib/guest/career/optimize-engine"
import { CareerUnlockBanner } from "@/components/guest/career/CareerUnlockBanner"
import { GuestMasterResumePanel } from "@/components/guest/career/GuestMasterResumePanel"
import { useGuestDashboard } from "@/components/guest/dashboard/GuestDashboardContext"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { EMBED_MATERIAL_PANEL } from "@/components/student/dashboard-v2/embed-module-ui"
import { cn } from "@/lib/utils"

const OPTIMIZE_COST = GUEST_CAREER_AI_FEATURE_COSTS.resume_review

export function GuestResumeOptimizePage() {
  const searchParams = useSearchParams()
  const applicationIdParam = searchParams.get("applicationId")
  const { entitlements, refreshEntitlements } = useGuestDashboard()
  const hasCareer = guestHasCapability(entitlements.capabilities, "career.cora")

  const [hasResume, setHasResume] = useState<boolean | null>(null)
  const [opportunityText, setOpportunityText] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<ResumeOptimizeResult | null>(null)
  const [meta, setMeta] = useState<{ opportunityTitle: string | null; matchScore: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAsMaster, setSavedAsMaster] = useState(false)

  const checkResume = useCallback(async () => {
    const d = getStudentData()
    if (!d?.databaseId) return
    const res = await fetch(`/api/guest/career/resumes?studentDatabaseId=${encodeURIComponent(d.databaseId)}`)
    const json = await res.json()
    if (res.ok) setHasResume(Boolean(json.masterResume?.parsedText?.trim()))
  }, [])

  const prefillFromApplication = useCallback(async () => {
    if (!applicationIdParam) return
    const d = getStudentData()
    if (!d?.databaseId) return
    const res = await fetch(
      `/api/guest/career/applications?studentDatabaseId=${encodeURIComponent(d.databaseId)}&applicationId=${applicationIdParam}`,
    )
    const json = await res.json()
    if (res.ok && json.application?.opportunity?.description) {
      setOpportunityText(json.application.opportunity.description)
    }
  }, [applicationIdParam])

  useEffect(() => {
    void checkResume()
    void prefillFromApplication()
  }, [checkResume, prefillFromApplication])

  async function optimize() {
    const d = getStudentData()
    if (!d?.databaseId) return
    if (!opportunityText.trim()) {
      setError("Paste the opportunity you're optimizing for.")
      return
    }
    setBusy(true)
    setError("")
    setResult(null)
    setSavedAsMaster(false)
    try {
      const res = await fetch("/api/guest/career/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentDatabaseId: d.databaseId,
          opportunityDescription: opportunityText,
          ...(applicationIdParam ? { applicationId: Number(applicationIdParam) } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.needsResume) setHasResume(false)
        throw new Error(json.error || "Optimization failed")
      }
      setResult(json.result)
      setMeta({ opportunityTitle: json.opportunityTitle ?? null, matchScore: Number(json.matchScore ?? 0) })
      void refreshEntitlements()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Optimization failed")
    } finally {
      setBusy(false)
    }
  }

  async function copyRevised() {
    if (!result?.revisedResumeText) return
    await navigator.clipboard.writeText(result.revisedResumeText).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function saveAsMaster() {
    const d = getStudentData()
    if (!d?.databaseId || !result?.revisedResumeText) return
    setSaving(true)
    try {
      const res = await fetch("/api/guest/career/resumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentDatabaseId: d.databaseId,
          parsedText: result.revisedResumeText,
          label: "Optimized résumé",
        }),
      })
      if (res.ok) setSavedAsMaster(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-xl font-bold text-[var(--cc-text)] sm:text-2xl">Résumé optimize</h1>
        <p className="mx-auto mt-1 max-w-lg text-sm text-[var(--cc-text-muted)]">
          Cora revises your résumé for a specific opportunity — closing keyword gaps, strengthening
          bullets, and fixing ATS issues without inventing experience.
        </p>
      </div>

      {!hasCareer ? (
        <CareerUnlockBanner
          title="Unlock Résumé Optimize"
          description="AI revision that fixes missing keywords, weak bullets, and ATS issues — grounded in your real experience."
        />
      ) : null}

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

      {!result ? (
        <div className={cn(EMBED_MATERIAL_PANEL, "p-4 sm:p-5")}>
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--cc-text)]">
            <Wand2 className="size-4 text-violet-600" aria-hidden />
            Optimize for this opportunity
          </label>
          <Textarea
            value={opportunityText}
            onChange={(e) => setOpportunityText(e.target.value)}
            placeholder="Paste the job description, program requirements, or scholarship details you want your résumé tailored to…"
            className="min-h-[220px] rounded-xl"
            disabled={!hasCareer || hasResume === false}
          />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--cc-text-muted)]">
              Uses your master résumé ·{" "}
              <Link href="/guest/settings?section=cora" className="text-violet-600 hover:underline">
                Update résumé
              </Link>
            </p>
            <Button
              className="rounded-xl px-6"
              disabled={busy || !hasCareer || hasResume === false}
              onClick={() => void optimize()}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {busy ? "Optimizing…" : `Optimize résumé · ${OPTIMIZE_COST} credits`}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className={cn(EMBED_MATERIAL_PANEL, "p-4 sm:p-5")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--cc-text)]">
                <Sparkles className="size-4 text-violet-600" aria-hidden />
                Optimization ready
                {meta?.opportunityTitle ? (
                  <span className="font-normal text-[var(--cc-text-muted)]">— {meta.opportunityTitle}</span>
                ) : null}
              </h2>
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setResult(null)}>
                Run another
              </Button>
            </div>
            {result.revisedSummary ? (
              <div className="mt-3 rounded-xl bg-violet-50/70 p-3.5 dark:bg-violet-950/25">
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                  Tailored professional summary
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--cc-text)]">{result.revisedSummary}</p>
              </div>
            ) : null}
          </div>

          {result.skillsToAdd.length > 0 ? (
            <div className={cn(EMBED_MATERIAL_PANEL, "p-4 sm:p-5")}>
              <h3 className="text-sm font-semibold text-[var(--cc-text)]">
                Skills you demonstrate but never name
              </h3>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {result.skillsToAdd.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                  >
                    + {skill}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {result.keywordAdditions.length > 0 ? (
            <div className={cn(EMBED_MATERIAL_PANEL, "overflow-hidden")}>
              <div className="border-b border-[var(--border)] px-4 py-3">
                <h3 className="text-sm font-semibold text-[var(--cc-text)]">Missing keywords — how to address them</h3>
              </div>
              <ul className="divide-y divide-[var(--border)]">
                {result.keywordAdditions.map((k, i) => (
                  <li key={`${k.keyword}-${i}`} className="px-4 py-3">
                    <p className="text-sm font-semibold text-[var(--cc-text)]">
                      {k.keyword}
                      {k.section ? (
                        <span className="ml-2 rounded-md bg-[var(--muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--cc-text-muted)]">
                          {k.section}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--cc-text-muted)]">{k.suggestion}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.bulletRewrites.length > 0 ? (
            <div className={cn(EMBED_MATERIAL_PANEL, "overflow-hidden")}>
              <div className="border-b border-[var(--border)] px-4 py-3">
                <h3 className="text-sm font-semibold text-[var(--cc-text)]">Highest-impact bullet rewrites</h3>
              </div>
              <ul className="divide-y divide-[var(--border)]">
                {result.bulletRewrites.map((b, i) => (
                  <li key={i} className="px-4 py-3.5">
                    <p className="text-xs text-[var(--cc-text-muted)] line-through decoration-red-400/60">
                      {b.original}
                    </p>
                    <p className="mt-1.5 flex items-start gap-1.5 text-sm text-[var(--cc-text)]">
                      <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden />
                      {b.revised}
                    </p>
                    {b.reason ? (
                      <p className="mt-1 text-[11px] italic text-[var(--cc-text-muted)]">{b.reason}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.atsFixes.length > 0 ? (
            <div className={cn(EMBED_MATERIAL_PANEL, "p-4 sm:p-5")}>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--cc-text)]">
                <Wrench className="size-4 text-amber-600" aria-hidden />
                ATS fixes
              </h3>
              <ul className="mt-2 space-y-1.5">
                {result.atsFixes.map((fix, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[var(--cc-text-muted)]">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden />
                    {fix}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.revisedResumeText ? (
            <div className={cn(EMBED_MATERIAL_PANEL, "overflow-hidden")}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
                <h3 className="text-sm font-semibold text-[var(--cc-text)]">Full revised résumé</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="rounded-lg" onClick={() => void copyRevised()}>
                    {copied ? <Check className="size-3.5" /> : <ClipboardCopy className="size-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-lg"
                    disabled={saving || savedAsMaster}
                    onClick={() => void saveAsMaster()}
                  >
                    {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                    {savedAsMaster ? "Saved as master" : "Save as master résumé"}
                  </Button>
                </div>
              </div>
              <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap px-4 py-4 font-sans text-sm leading-relaxed text-[var(--cc-text)]">
                {result.revisedResumeText}
              </pre>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
