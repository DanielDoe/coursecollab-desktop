"use client"

import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

const playgroundChrome = facultyEmbedChrome("playground")

export function PlaygroundStatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: LucideIcon
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            playgroundChrome.p.softBg,
          )}
        >
          <Icon className={cn("h-4 w-4", playgroundChrome.p.iconText)} strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <p className={cn("truncate text-[11px]", PORTAL_TEXT_MUTED)}>{label}</p>
          <p className={cn("text-lg font-semibold tabular-nums", PORTAL_TEXT)}>{value}</p>
        </div>
      </div>
    </article>
  )
}
