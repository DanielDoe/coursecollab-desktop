"use client"

import Link from "next/link"
import type { ApplicationWorkspace, CareerAnalysis } from "@/lib/guest/career/types"
import type { CareerAccessTier, CareerAnalysisIssueCounts } from "@/lib/guest/career/preview-gate"
import {
  MATCH_BAND_LABELS,
  MATCH_SCORE_DISCLAIMER,
  MATCH_TARGET_GUIDANCE,
} from "@/lib/guest/career/match-config"
import { CareerMatchEvidence } from "@/components/guest/career/CareerMatchEvidence"
import {
  CareerLockedLabel,
  CareerUnlockBanner,
  CareerUnlockRowButton,
} from "@/components/guest/career/CareerUnlockBanner"
import { Button } from "@/components/ui/button"
import { EMBED_INNER_PANEL, EMBED_MATERIAL_PANEL } from "@/components/student/dashboard-v2/embed-module-ui"
import { cn } from "@/lib/utils"

const DIMENSION_LABELS: Record<keyof CareerAnalysis["dimensionScores"], string> = {
  skillsMatch: "Skills match",
  experienceAlignment: "Experience",
  roleTitleAlignment: "Role / title",
  educationQualifications: "Qualifications",
  keywordCoverage: "Keywords",
  resumeImpact: "Résumé impact",
  atsReadability: "ATS readability",
}

function ScoreRing({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score))
  return (
    <div
      className="relative mx-auto flex size-28 items-center justify-center rounded-full sm:mx-0"
      style={{
        background: `conic-gradient(var(--cc-accent-dark) ${pct * 3.6}deg, var(--muted) 0deg)`,
      }}
    >
      <div className="flex size-[5.5rem] flex-col items-center justify-center rounded-full bg-[var(--card)]">
        <span className="text-3xl font-bold tabular-nums text-[var(--cc-text)]">{score}%</span>
        <span className="text-[10px] text-[var(--cc-text-muted)]">Match</span>
      </div>
    </div>
  )
}

function DimensionBar({
  label,
  score,
  issueHint,
}: {
  label: string
  score: number
  issueHint?: string
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-[var(--cc-text)]">{label}</span>
        {issueHint ? (
          <span className="text-[var(--cc-accent-dark)]">{issueHint}</span>
        ) : (
          <span className="tabular-nums text-[var(--cc-text-muted)]">{score}</span>
        )}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--muted)]">
        <div
          className="h-full rounded-full bg-violet-600 transition-all"
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
    </div>
  )
}

export function CareerMatchReport({
  application,
  analysis,
  accessTier = "full",
  issueCounts,
}: {
  application: ApplicationWorkspace
  analysis: CareerAnalysis
  accessTier?: CareerAccessTier
  issueCounts?: CareerAnalysisIssueCounts | null
}) {
  const isPreview = accessTier === "preview"
  const counts = issueCounts ?? {
    skillsToImprove:
      analysis.skillEvidence.partial.length + analysis.skillEvidence.notDemonstrated.length,
    requirementsGap: analysis.requirements.filter((r) => r.level !== "demonstrated").length,
    improvements: analysis.topImprovements.length,
    atsAttention: analysis.atsReadability.findings.filter((f) => f.kind === "attention").length,
  }

  const hiddenImprovements = Math.max(0, counts.improvements - analysis.topImprovements.length)
  const lockedRequirements = analysis.requirements.filter((r) => r.locked).length

  return (
    <div className="space-y-5">
      {isPreview ? <CareerUnlockBanner /> : null}

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className={cn(EMBED_MATERIAL_PANEL, "space-y-4 p-4")}>
          <ScoreRing score={analysis.overallScore} />
          <p className="text-center text-sm font-medium text-[var(--cc-text)] sm:text-left">
            {MATCH_BAND_LABELS[analysis.matchBand]}
          </p>
          <p className="text-center text-[11px] text-[var(--cc-text-muted)] sm:text-left">
            {MATCH_TARGET_GUIDANCE}
          </p>
          <div className="space-y-3 border-t border-[var(--border)] pt-3">
            <DimensionBar
              label={DIMENSION_LABELS.skillsMatch}
              score={analysis.dimensionScores.skillsMatch}
              issueHint={
                counts.skillsToImprove > 0 ? `${counts.skillsToImprove} to improve` : undefined
              }
            />
            <DimensionBar
              label={DIMENSION_LABELS.experienceAlignment}
              score={analysis.dimensionScores.experienceAlignment}
            />
            <DimensionBar
              label={DIMENSION_LABELS.keywordCoverage}
              score={analysis.dimensionScores.keywordCoverage}
            />
            <DimensionBar
              label={DIMENSION_LABELS.atsReadability}
              score={analysis.dimensionScores.atsReadability}
              issueHint={counts.atsAttention > 0 ? `${counts.atsAttention} ATS notes` : undefined}
            />
          </div>
          <div className="space-y-2 border-t border-[var(--border)] pt-3">
            <Button variant="outline" className="w-full rounded-xl" asChild>
              <Link href="/guest/cora-career/match">Upload & rescan</Link>
            </Button>
            <Button className="w-full rounded-xl" disabled={isPreview} title={isPreview ? "Unlock to optimize" : undefined}>
              Optimize with Cora
            </Button>
          </div>
        </aside>

        <div className="space-y-4">
          <div className={cn(EMBED_MATERIAL_PANEL, "p-4 sm:p-5")}>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
              Resume scan results
            </p>
            <h2 className="mt-1 text-xl font-bold text-[var(--cc-text)]">
              {application.opportunity.organization ?? "Opportunity"} — {application.opportunity.title}
            </h2>
            <p className="mt-2 text-sm text-[var(--cc-text-muted)]">{analysis.summary}</p>
            <p className="mt-2 text-[11px] text-[var(--cc-text-muted)]">{MATCH_SCORE_DISCLAIMER}</p>
          </div>

          {analysis.topImprovements.length > 0 || hiddenImprovements > 0 ? (
            <div className={cn(EMBED_INNER_PANEL, "p-4")}>
              <p className="text-sm font-semibold text-[var(--cc-text)]">
                Top improvements
                {counts.improvements > 0 ? (
                  <span className="ml-2 text-xs font-normal text-[var(--cc-text-muted)]">
                    ({counts.improvements} total)
                  </span>
                ) : null}
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[var(--cc-text-muted)]">
                {analysis.topImprovements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
              {hiddenImprovements > 0 ? (
                <div className="mt-3 flex items-center justify-between rounded-lg bg-[var(--muted)]/30 px-3 py-2">
                  <CareerLockedLabel className="min-w-[12rem]" />
                  <CareerUnlockRowButton />
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button className="rounded-xl" disabled={isPreview}>
                  Optimize with Cora
                </Button>
                <Button variant="outline" className="rounded-xl" asChild>
                  <Link href={`/guest/cora-career/applications/${application.id}`}>
                    Open application workspace
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className={cn(EMBED_INNER_PANEL, "p-4")}>
              <p className="mb-1 text-sm font-semibold text-[var(--cc-text)]">Skills & keywords</p>
              {isPreview ? (
                <p className="mb-3 text-xs text-[var(--cc-text-muted)]">
                  {counts.skillsToImprove} gaps found — unlock to see missing keywords and evidence.
                </p>
              ) : null}
              <CareerMatchEvidence
                matched={analysis.skillEvidence.matched}
                partial={analysis.skillEvidence.partial}
                notDemonstrated={analysis.skillEvidence.notDemonstrated}
              />
            </div>

            <div className="space-y-4">
              <div className={cn(EMBED_INNER_PANEL, "p-4")}>
                <p className="mb-3 text-sm font-semibold text-[var(--cc-text)]">Requirements</p>
                <ul className="space-y-2">
                  {analysis.requirements.map((req, i) => (
                    <li key={`${req.level}-${i}`} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex gap-2 text-[var(--cc-text-secondary)]">
                        <span className="shrink-0">
                          {req.level === "demonstrated" ? "✓" : req.level === "partial" ? "~" : "○"}
                        </span>
                        {req.locked ? <CareerLockedLabel /> : <span>{req.label}</span>}
                      </span>
                      {req.locked ? <CareerUnlockRowButton /> : null}
                    </li>
                  ))}
                </ul>
                {lockedRequirements > 0 ? (
                  <p className="mt-2 text-xs text-[var(--cc-text-muted)]">
                    + {lockedRequirements} requirement checks locked
                  </p>
                ) : null}
              </div>

              <div className={cn(EMBED_INNER_PANEL, "p-4")}>
                <p className="mb-1 text-sm font-semibold text-[var(--cc-text)]">ATS readability</p>
                <p className="text-2xl font-bold tabular-nums text-[var(--cc-text)]">
                  {analysis.atsReadability.score}
                </p>
                <ul className="mt-3 space-y-1.5 text-xs text-[var(--cc-text-muted)]">
                  {analysis.atsReadability.findings.map((f, i) => (
                    <li key={`${f.kind}-${i}`} className="flex items-center justify-between gap-2">
                      {f.locked ? (
                        <>
                          <CareerLockedLabel className="min-w-[10rem]" />
                          <CareerUnlockRowButton />
                        </>
                      ) : (
                        <span>
                          {f.kind === "pass" ? "✓" : "!"} {f.message}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {isPreview && counts.atsAttention > analysis.atsReadability.findings.length ? (
                  <p className="mt-2 text-xs text-[var(--cc-text-muted)]">
                    Unlock for all ATS formatting recommendations.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
