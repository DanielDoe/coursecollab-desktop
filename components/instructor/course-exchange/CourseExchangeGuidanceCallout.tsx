"use client"

import { Info, Layers, ShieldCheck, Sparkles, X } from "lucide-react"
import {
  EXCHANGE_DESTINATION_SHELL_NOTE,
  EXCHANGE_INDEPENDENT_COPY_NOTE,
  EXCHANGE_OWNER_SHARING_NOTE,
  EXCHANGE_PARTIAL_MODULES_NOTE,
  EXCHANGE_POST_IMPORT_CHECKLIST,
} from "@/lib/course-exchange/provenance-shared"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { useDismissibleBanner } from "@/lib/use-dismissible-banner"
import { cn } from "@/lib/utils"

const COPY = {
  "independent-copy": {
    icon: ShieldCheck,
    title: "Independent copy",
    body: EXCHANGE_INDEPENDENT_COPY_NOTE,
  },
  "partial-modules": {
    icon: Layers,
    title: "Import only what you need",
    body: EXCHANGE_PARTIAL_MODULES_NOTE,
  },
  "destination-shell": {
    icon: Sparkles,
    title: "Use a dedicated destination course",
    body: EXCHANGE_DESTINATION_SHELL_NOTE,
  },
  "owner-sharing": {
    icon: Info,
    title: "Sharing creates forks, not live links",
    body: EXCHANGE_OWNER_SHARING_NOTE,
  },
  "post-import-review": {
    icon: Info,
    title: "Review before students see it",
    body: "Update term-specific dates, publish flags, and policies in your copy. The source course is unchanged.",
  },
} as const

export function CourseExchangeGuidanceCallout({
  kind,
  className,
  moduleId = "course-exchange",
  dismissId,
  autoDismissMs,
}: {
  kind: keyof typeof COPY
  className?: string
  moduleId?: string
  /** When set, user can dismiss and preference is stored in localStorage. */
  dismissId?: string
  /** Auto-hide after this many ms (still persisted if dismissed early). */
  autoDismissMs?: number
}) {
  const chrome = facultyEmbedChrome(moduleId)
  const item = COPY[kind]
  const Icon = item.icon
  const storageKey = dismissId ?? `exchange-guidance:${kind}`
  const { visible, dismiss } = useDismissibleBanner(storageKey, {
    autoDismissMs: autoDismissMs !== undefined ? autoDismissMs : 12_000,
  })

  if (!visible) return null

  return (
    <div
      className={cn(
        "relative flex gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--muted)]/25 px-3 py-2.5 sm:px-3.5 sm:pr-9",
        className,
      )}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", chrome.p.iconText)} />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[var(--cc-text)]">{item.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--cc-text-secondary)]">{item.body}</p>
        {kind === "post-import-review" ? (
          <ul className="mt-2 list-inside list-disc text-[11px] text-[var(--cc-text-muted)]">
            {EXCHANGE_POST_IMPORT_CHECKLIST.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-2 rounded-md p-1 text-[var(--cc-text-muted)] hover:bg-[var(--muted)]/60 hover:text-[var(--cc-text)]"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
