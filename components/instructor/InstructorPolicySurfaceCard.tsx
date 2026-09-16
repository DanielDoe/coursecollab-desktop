"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

type InstructorPolicySurfaceCardProps = {
  title?: string
  description?: string
  children: ReactNode
  className?: string
  footer?: ReactNode
  /** card = bordered surface; section = flat block (no nested card chrome) */
  variant?: "card" | "section"
  /** @deprecated accent glow removed — portal tokens only */
  accent?: string
}

export function InstructorPolicySurfaceCard({
  title,
  description,
  children,
  className,
  footer,
  variant = "card",
}: InstructorPolicySurfaceCardProps) {
  const header =
    title || description ? (
      <div>
        {title ? <h3 className={cn("text-base font-semibold sm:text-lg", PORTAL_TEXT)}>{title}</h3> : null}
        {description ? <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>{description}</p> : null}
      </div>
    ) : null

  if (variant === "section") {
    return (
      <section className={cn("space-y-4", className)}>
        {header}
        {children}
        {footer}
      </section>
    )
  }

  return (
    <div className={cn(PORTAL_CARD, "w-full rounded-xl p-4 sm:rounded-2xl sm:p-5", className)}>
      <div className="space-y-4">
        {header}
        {children}
        {footer}
      </div>
    </div>
  )
}

export function InstructorPolicyDividedList({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn(PORTAL_CARD, "overflow-hidden divide-y divide-[var(--border)]", className)}>
      {children}
    </div>
  )
}

export function InstructorPolicyToggleRow({
  label,
  hint,
  checked,
  onCheckedChange,
  switchClass,
}: {
  label: string
  hint?: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
  switchClass?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2.5 transition-colors hover:bg-[var(--cc-accent-soft)]/45 sm:px-3.5 sm:py-3">
      <div className="min-w-0">
        <p className={cn("text-sm font-medium", PORTAL_TEXT)}>{label}</p>
        {hint ? <p className={cn("mt-0.5 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>{hint}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className={cn("shrink-0", switchClass)} />
    </div>
  )
}

export function InstructorAdminQuickLink({
  href,
  label,
  description,
  variant = "card",
}: {
  href: string
  label: string
  description?: string
  variant?: "card" | "row"
}) {
  if (variant === "row") {
    return (
      <Link
        href={href}
        className="group flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-[var(--cc-accent-soft)]/45 sm:px-3.5 sm:py-3"
      >
        <div className="min-w-0">
          <p className={cn("text-sm font-medium", PORTAL_TEXT)}>{label}</p>
          {description ? <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>{description}</p> : null}
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--cc-text-muted)] transition-colors group-hover:text-[var(--cc-accent-dark)]" />
      </Link>
    )
  }

  return (
    <Link
      href={href}
      className={cn(
        PORTAL_CARD,
        "group flex items-center justify-between gap-3 px-4 py-3 transition-colors",
        "hover:bg-[var(--cc-accent-soft)]/45",
      )}
    >
      <div className="min-w-0">
        <p className={cn("text-sm font-medium", PORTAL_TEXT)}>{label}</p>
        {description ? <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>{description}</p> : null}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--cc-text-muted)] group-hover:text-[var(--cc-accent-dark)]" />
    </Link>
  )
}
