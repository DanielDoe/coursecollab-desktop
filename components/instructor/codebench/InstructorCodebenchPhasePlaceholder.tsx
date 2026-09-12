"use client"

import type { LucideIcon } from "lucide-react"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

type Props = {
  title: string
  description: string
  phase: string
  icon: LucideIcon
  bullets?: string[]
}

export function InstructorCodebenchPhasePlaceholder({
  title,
  description,
  phase,
  icon: Icon,
  bullets = [],
}: Props) {
  const chrome = facultyEmbedChrome("codebench")
  return (
    <div className={cn(chrome.card, "flex min-h-[min(320px,50dvh)] flex-col items-center justify-center gap-3 p-6 text-center sm:p-8")}>
      <div className={chrome.iconBadge("md")}>
        <Icon className="size-5" />
      </div>
      <p className={cn("text-base font-semibold", PORTAL_TEXT)}>{title}</p>
      <p className={cn("max-w-lg text-sm", PORTAL_TEXT_MUTED)}>{description}</p>
      <p className="rounded-full bg-[var(--muted)] px-3 py-1 text-xs font-medium text-[var(--cc-text-muted)]">
        {phase}
      </p>
      {bullets.length ? (
        <ul className={cn("mt-2 max-w-md space-y-1 text-left text-xs", PORTAL_TEXT_MUTED)}>
          {bullets.map((bullet) => (
            <li key={bullet}>• {bullet}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
