"use client"

import Link from "next/link"
import { ArrowRight, FileText, MessageSquare, Target, Zap, type LucideIcon } from "lucide-react"
import { EMBED_INNER_PANEL } from "@/components/student/dashboard-v2/embed-module-ui"
import { getGuestPortalTheme } from "@/lib/guest-module-themes"
import { cn } from "@/lib/utils"

const theme = getGuestPortalTheme()

const ACTIONS = [
  {
    href: "/guest/cora-career/quick-scan",
    label: "Quick scan",
    description: "Paste a job description — match against your saved résumé",
    icon: Zap,
    featured: true,
  },
  {
    href: "/guest/cora-career/match",
    label: "Résumé match",
    description: "Full keyword and ATS analysis for any opportunity",
    icon: Target,
  },
  {
    href: "/guest/cora-career/cover-letter",
    label: "Cover letter",
    description: "Evidence-based draft from your master résumé",
    icon: FileText,
  },
  {
    href: "/guest/cora-career/chat",
    label: "Cora chat",
    description: "Ask about interviews, applications, or next steps",
    icon: MessageSquare,
  },
] as const

function ActionTile({
  href,
  label,
  description,
  icon: Icon,
  featured,
  compact,
}: {
  href: string
  label: string
  description?: string
  icon: LucideIcon
  featured?: boolean
  compact?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        EMBED_INNER_PANEL,
        "group flex transition-colors hover:bg-[var(--muted)]/50",
        compact ? "items-center gap-3 p-3.5" : "flex-col gap-3 p-4 sm:p-5",
        featured && !compact && cn("border-2", theme.page.border, theme.page.softBg),
      )}
    >
      <div className={cn("flex w-full items-start gap-3", compact && "items-center")}>
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-xl",
            compact ? "size-9" : "size-11",
            theme.page.iconBg,
            theme.page.iconText,
          )}
        >
          <Icon className={compact ? "size-4" : "size-5"} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("font-semibold text-[var(--cc-text)]", compact ? "text-sm" : "text-base")}>{label}</p>
          {description && !compact ? (
            <p className="mt-1 text-xs leading-relaxed text-[var(--cc-text-muted)]">{description}</p>
          ) : null}
        </div>
        <ArrowRight
          className={cn(
            "shrink-0 text-[var(--cc-text-muted)] transition-transform group-hover:translate-x-0.5",
            compact ? "size-4" : "size-5",
          )}
        />
      </div>
    </Link>
  )
}

export function GuestCareerQuickActions({
  compact,
  className,
}: {
  compact?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        compact ? "grid gap-2 sm:grid-cols-2" : "grid gap-3 sm:grid-cols-2",
        className,
      )}
    >
      {ACTIONS.map((action) => (
        <ActionTile key={action.href} {...action} compact={compact} />
      ))}
    </div>
  )
}
