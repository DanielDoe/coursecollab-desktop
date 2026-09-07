"use client"

import Link from "next/link"
import { Copy, Loader2, Lock } from "lucide-react"
import type { ApplicationWorkspace, CoverLetter } from "@/lib/guest/career/types"
import type { CareerAccessTier } from "@/lib/guest/career/preview-gate"
import { CareerUnlockBanner } from "@/components/guest/career/CareerUnlockBanner"
import { Button } from "@/components/ui/button"
import { EMBED_INNER_PANEL, EMBED_MATERIAL_PANEL } from "@/components/student/dashboard-v2/embed-module-ui"
import { cn } from "@/lib/utils"
import { useState } from "react"

type GatedCoverLetter = CoverLetter & {
  lockedParagraphCount?: number
  totalParagraphCount?: number
}

export function CareerCoverLetterReport({
  application,
  coverLetter,
  accessTier = "full",
  onRegenerate,
  busy,
}: {
  application: ApplicationWorkspace
  coverLetter: GatedCoverLetter
  accessTier?: CareerAccessTier
  onRegenerate?: () => void
  busy?: boolean
}) {
  const isPreview = accessTier === "preview"
  const lockedCount = coverLetter.lockedParagraphCount ?? 0
  const [copied, setCopied] = useState(false)

  async function copyLetter() {
    if (isPreview) return
    try {
      await navigator.clipboard.writeText(coverLetter.body)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-5">
      {isPreview ? (
        <CareerUnlockBanner
          title="Cover letter generated"
          description="Your draft is ready. Unlock Cora Career to read the full letter, copy it, and regenerate with AI polish."
        />
      ) : null}

      <div className={cn(EMBED_MATERIAL_PANEL, "p-4 sm:p-5")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
              Cover letter
            </p>
            <h2 className="mt-1 text-xl font-bold text-[var(--cc-text)]">
              {application.opportunity.organization ?? "Opportunity"} — {application.opportunity.title}
            </h2>
            <p className="mt-1 text-xs capitalize text-[var(--cc-text-muted)]">
              Tone: {coverLetter.tone} · Status: {coverLetter.status.toLowerCase().replace("_", " ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              disabled={isPreview || busy}
              onClick={() => void copyLetter()}
            >
              <Copy className="mr-1.5 size-3.5" />
              {copied ? "Copied" : "Copy"}
            </Button>
            {onRegenerate ? (
              <Button size="sm" className="rounded-lg" disabled={busy} onClick={onRegenerate}>
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Regenerate"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className={cn(EMBED_INNER_PANEL, "p-4 sm:p-5")}>
        <div className="whitespace-pre-wrap font-[family-name:var(--font-geist-sans)] text-sm leading-relaxed text-[var(--cc-text-secondary)]">
          {coverLetter.body}
        </div>

        {lockedCount > 0 ? (
          <div className="relative mt-5 overflow-hidden rounded-xl">
            <div className="space-y-4 select-none blur-[7px]" aria-hidden>
              {Array.from({ length: Math.min(lockedCount, 3) }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-full rounded bg-[var(--muted)]/70" />
                  <div className="h-3 w-[92%] rounded bg-[var(--muted)]/70" />
                  <div className="h-3 w-[78%] rounded bg-[var(--muted)]/70" />
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-transparent via-[var(--cc-surface)]/55 to-[var(--cc-surface)]/85">
              <div className="flex flex-col items-center gap-2.5 rounded-xl border border-[var(--cc-border)] bg-[var(--cc-surface)]/95 px-6 py-4 text-center shadow-sm">
                <span className="flex size-9 items-center justify-center rounded-full bg-violet-500/10 text-violet-600">
                  <Lock className="size-4" />
                </span>
                <p className="text-sm font-semibold text-[var(--cc-text)]">
                  {lockedCount} more paragraph{lockedCount === 1 ? "" : "s"} locked
                </p>
                <p className="max-w-[16rem] text-xs text-[var(--cc-text-muted)]">
                  Unlock Cora Career to read, copy, and regenerate the full letter.
                </p>
                <Button size="sm" className="mt-1 rounded-lg" asChild>
                  <Link href="/guest/cora-career/access">Unlock Cora Career</Link>
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="rounded-xl" asChild>
          <Link href={`/guest/cora-career/applications/${application.id}`}>Open application workspace</Link>
        </Button>
        <Button variant="outline" className="rounded-xl" asChild>
          <Link href="/guest/cora-career/match">Run résumé match</Link>
        </Button>
      </div>
    </div>
  )
}
