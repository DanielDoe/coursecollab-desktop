"use client"

import type { ReactNode } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CC_FIELD } from "@/lib/appearance/ui-primitives"
import { PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

export function CoraSectionTools({
  search,
  onSearchChange,
  searchPlaceholder = "Filter…",
  trailing,
  meta,
}: {
  search?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  trailing?: ReactNode
  meta?: string
}) {
  if (search == null && !trailing && !meta) return null
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {onSearchChange ? (
          <div className="relative min-w-0 w-full max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--cc-text-muted)]" />
            <Input
              value={search ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className={cn("h-9 rounded-lg pl-8 pr-8 shadow-none", CC_FIELD.base, CC_FIELD.focus)}
            />
            {search ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2"
                aria-label="Clear search"
                onClick={() => onSearchChange("")}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        ) : null}
        {meta ? <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{meta}</p> : null}
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
    </div>
  )
}
