"use client"

import type { ProvenanceRef, SkillEvidenceItem } from "@/lib/guest/career/types"
import { levelLabel } from "@/lib/guest/career/match-engine"
import {
  CareerLockedLabel,
  CareerUnlockRowButton,
} from "@/components/guest/career/CareerUnlockBanner"
import { cn } from "@/lib/utils"
import { useState } from "react"

function EvidenceList({ items, tone }: { items: SkillEvidenceItem[]; tone: "matched" | "partial" | "missing" }) {
  if (items.length === 0) return null
  const title =
    tone === "matched" ? "Matched" : tone === "partial" ? "Partial" : "Not demonstrated"
  const icon = tone === "matched" ? "✓" : tone === "partial" ? "~" : "○"

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">{title}</p>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <EvidenceRow key={`${tone}-${i}`} item={item} icon={icon} />
        ))}
      </ul>
    </div>
  )
}

function EvidenceRow({ item, icon }: { item: SkillEvidenceItem; icon: string }) {
  const [open, setOpen] = useState(false)
  const locked = Boolean(item.locked)

  return (
    <li className="rounded-lg bg-[var(--muted)]/30 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-[var(--cc-text)]">
          <span className="mr-2 text-[var(--cc-accent-dark)]">{icon}</span>
          {locked ? <CareerLockedLabel /> : item.label}
          {!locked ? (
            <span className="ml-2 text-[11px] text-[var(--cc-text-muted)]">{levelLabel(item.level)}</span>
          ) : null}
        </p>
        {locked ? (
          <CareerUnlockRowButton />
        ) : item.evidence.length > 0 ? (
          <button
            type="button"
            className="shrink-0 text-[11px] font-medium text-[var(--cc-accent-dark)] hover:underline"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Hide" : "Show evidence"}
          </button>
        ) : null}
      </div>
      {!locked && item.guidance ? (
        <p className="mt-1 text-[11px] text-[var(--cc-text-muted)]">{item.guidance}</p>
      ) : null}
      {open && !locked ? <ProvenanceBlock refs={item.evidence} /> : null}
    </li>
  )
}

function ProvenanceBlock({ refs }: { refs: ProvenanceRef[] }) {
  return (
    <ul className="mt-2 space-y-1.5 border-t border-[var(--border)] pt-2">
      {refs.map((ref, i) => (
        <li key={`${ref.sourceSection}-${i}`} className="text-[11px] text-[var(--cc-text-secondary)]">
          <span className="font-medium text-[var(--cc-text)]">{ref.sourceSection}</span>
          <p className="mt-0.5 whitespace-pre-wrap">{ref.sourceText}</p>
        </li>
      ))}
    </ul>
  )
}

export function CareerMatchEvidence({
  matched,
  partial,
  notDemonstrated,
  className,
}: {
  matched: SkillEvidenceItem[]
  partial: SkillEvidenceItem[]
  notDemonstrated: SkillEvidenceItem[]
  className?: string
}) {
  return (
    <div className={cn("space-y-4", className)}>
      <EvidenceList items={matched} tone="matched" />
      <EvidenceList items={partial} tone="partial" />
      <EvidenceList items={notDemonstrated} tone="missing" />
    </div>
  )
}
