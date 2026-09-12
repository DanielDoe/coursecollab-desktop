"use client"

import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { metricDef } from "@/lib/cora/insights/taxonomy"
import { PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

export function MetricTip({ id }: { id: string }) {
  const m = metricDef(id)
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className={`inline-flex size-4 items-center justify-center ${PORTAL_TEXT_MUTED}`} aria-label={`${m.label} definition`}>
            <Info className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs space-y-1 text-xs">
          <p className="font-medium">{m.label}</p>
          <p>{m.definition}</p>
          <p>Source: {m.source}</p>
          <p>Calculation: {m.calculation}</p>
          <p>Min sample: {m.minSample} · {m.window}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
