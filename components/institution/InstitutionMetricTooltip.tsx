"use client"

import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { METRIC_DEFINITIONS } from "@/lib/institutions/metrics/constants"
import { cn } from "@/lib/utils"
import { PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

export function InstitutionMetricTooltip({
  definitionId,
  extra,
  estimated,
}: {
  definitionId?: keyof typeof METRIC_DEFINITIONS
  extra?: string
  estimated?: boolean
}) {
  const def = definitionId ? METRIC_DEFINITIONS[definitionId] : null
  const text = [def?.description, extra, estimated || def?.estimated ? "This value is estimated, not directly measured." : null]
    .filter(Boolean)
    .join(" ")
  if (!text) return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className={cn("inline-flex size-5 items-center justify-center rounded-full text-[var(--cc-text-muted)] hover:bg-muted/60")} aria-label="Metric definition">
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-relaxed">{text}</TooltipContent>
    </Tooltip>
  )
}

export function formatComparison(comp?: {
  changePercent: number | null
  changeLabel: string
}): string | null {
  if (!comp) return null
  if (comp.changeLabel === "new") return "New this period"
  if (comp.changeLabel === "unavailable") return null
  if (comp.changePercent == null) return "No significant change"
  const sign = comp.changePercent > 0 ? "+" : ""
  return `${sign}${comp.changePercent}% vs previous period`
}

export function formatMetricValue(value: unknown, suffix = ""): string {
  if (value == null) return "—"
  if (typeof value === "number") return `${value.toLocaleString()}${suffix}`
  return String(value)
}

export function DataFreshness({ generatedAt }: { generatedAt?: string }) {
  if (!generatedAt) return null
  const mins = Math.max(0, Math.round((Date.now() - new Date(generatedAt).getTime()) / 60_000))
  return (
    <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
      Updated {mins <= 1 ? "just now" : `${mins} minutes ago`}
    </p>
  )
}
