"use client"

import { RESEARCH_CAPABILITIES, type MetricAvailability, type MetricEvidence } from "@/lib/institutions/research/capability-catalog"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

const EVIDENCE_LABEL: Record<MetricEvidence, string> = {
  descriptive: "Descriptive",
  derived: "Derived",
  inferred: "Inferred",
  research_outcome: "Research outcome",
}

const AVAIL_LABEL: Record<MetricAvailability, string> = {
  available_now: "Available now",
  requires_instrumentation: "Needs instrumentation",
  requires_research_design: "Needs research design",
}

export function EvidenceBadge({ evidence }: { evidence: MetricEvidence }) {
  return (
    <span className="inline-flex rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
      {EVIDENCE_LABEL[evidence]}
    </span>
  )
}

export function InsufficientMetric({
  title,
  reason,
  unblock,
}: {
  title: string
  reason?: string
  unblock?: string
}) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_92%,var(--muted))] p-4">
      <p className={cn("text-[11px] font-semibold uppercase tracking-[0.12em]", PORTAL_TEXT_MUTED)}>{title}</p>
      <p className={cn("mt-2 text-lg font-semibold", PORTAL_TEXT)}>Insufficient data</p>
      {reason ? <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>{reason}</p> : null}
      {unblock ? <p className={cn("mt-2 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>{unblock}</p> : null}
    </div>
  )
}

export function CapabilityAuditTable({ domain }: { domain?: string }) {
  const rows = domain ? RESEARCH_CAPABILITIES.filter((c) => c.domain === domain) : RESEARCH_CAPABILITIES
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className={cn("border-b border-[var(--border)] text-xs", PORTAL_TEXT_MUTED)}>
            <th className="py-2 pr-3">Metric</th>
            <th className="py-2 pr-3">Evidence</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2">How to enable</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="py-2 pr-3 font-medium">{row.label}</td>
              <td className="py-2 pr-3">
                <EvidenceBadge evidence={row.evidence} />
              </td>
              <td className="py-2 pr-3 text-xs">{AVAIL_LABEL[row.availability]}</td>
              <td className={cn("py-2 text-xs", PORTAL_TEXT_MUTED)}>{row.unblock ?? row.formula ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
