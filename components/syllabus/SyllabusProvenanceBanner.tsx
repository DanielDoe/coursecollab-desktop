"use client"

import { BookCopy } from "lucide-react"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import {
  SYLLABUS_EXCHANGE_INDEPENDENT_COPY_NOTE,
  formatSyllabusProvenanceLine,
} from "@/lib/syllabus-exchange/provenance-shared"
import type { SyllabusTemplateProvenance } from "@/lib/syllabus-exchange/types"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

type SyllabusProvenanceBannerProps = {
  provenance: SyllabusTemplateProvenance
}

export function SyllabusProvenanceBanner({ provenance }: SyllabusProvenanceBannerProps) {
  const chrome = facultyEmbedChrome("syllabus")
  const copiedAt = provenance.copiedAt
    ? new Date(provenance.copiedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null

  return (
    <div className={cn("flex gap-3 rounded-2xl border p-3 sm:p-4", chrome.p.border, chrome.p.softBg)}>
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", chrome.iconBadge())}>
        <BookCopy className="h-4 w-4 !text-white" />
      </div>
      <div className="min-w-0 space-y-1">
        <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>
          Template from {formatSyllabusProvenanceLine(provenance)}
          {copiedAt ? ` · copied ${copiedAt}` : ""}
        </p>
        <p className={cn("text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
          {SYLLABUS_EXCHANGE_INDEPENDENT_COPY_NOTE}
        </p>
      </div>
    </div>
  )
}
