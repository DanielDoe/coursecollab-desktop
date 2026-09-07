"use client"

import type { ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

type CampCollapsibleModuleSectionProps = {
  title: string
  sectionIndex: number
  blockCount: number
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: ReactNode
}

export function CampCollapsibleModuleSection({
  title,
  sectionIndex,
  blockCount,
  open,
  defaultOpen = false,
  onOpenChange,
  children,
}: CampCollapsibleModuleSectionProps) {
  return (
    <Collapsible
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/40 dark:bg-white/[0.02] shadow-sm overflow-hidden"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-3 px-4 sm:px-5 py-4 text-left hover:bg-slate-50/80 dark:hover:bg-white/[0.04] transition-colors [&[data-state=open]>svg]:rotate-180">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-xs font-bold text-violet-700 dark:text-violet-300">
          {sectionIndex + 1}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm sm:text-base font-semibold text-slate-900 dark:text-white leading-snug">
            {title}
          </span>
          <span className="block text-xs text-slate-500 mt-0.5">
            {blockCount} {blockCount === 1 ? "item" : "items"}
          </span>
        </span>
        <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-4 border-t border-slate-200/60 dark:border-white/10 px-4 sm:px-5 py-4 sm:py-5">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function CampModuleSectionsToolbar({
  allExpanded,
  onToggleAll,
  sectionCount,
}: {
  allExpanded: boolean
  onToggleAll: () => void
  sectionCount: number
}) {
  if (sectionCount <= 1) return null

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03] px-4 py-2.5">
      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
        {sectionCount} sections — expand one at a time to focus
      </p>
      <button
        type="button"
        onClick={onToggleAll}
        className={cn(
          "text-xs font-medium shrink-0 rounded-lg px-3 py-1.5 transition-colors",
          "text-violet-700 dark:text-violet-300 hover:bg-violet-500/10",
        )}
      >
        {allExpanded ? "Collapse all" : "Expand all"}
      </button>
    </div>
  )
}
