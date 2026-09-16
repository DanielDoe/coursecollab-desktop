"use client"

import type { LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ChevronRight } from "lucide-react"
import { DashboardKpiCard } from "@/components/dashboard-v2/DashboardKpiCard"
import { Skeleton } from "@/components/ui/skeleton"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { portalListStripe } from "@/lib/portal-module-themes"
import {
  ATTENDANCE_TILE,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/attendance/attendance-surface-classes"
import { cn } from "@/lib/utils"

const attendanceChrome = facultyEmbedChrome("attendance")
const attendanceFamily = attendanceChrome.theme.family

export function FacultyAttendancePanel({
  title,
  children,
  action,
  className,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn(ATTENDANCE_TILE, "flex h-full flex-col p-3 sm:p-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

export function FacultyAttendanceLoading() {
  return (
    <div className="space-y-3 py-2">
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-2/3" />
    </div>
  )
}

export function FacultyAttendanceKpi({
  label,
  value,
  sub,
  icon,
  semantic,
}: {
  label: string
  value: string | number
  sub?: string
  icon: LucideIcon
  semantic?: "info" | "success" | "warning" | "danger" | "neutral"
}) {
  return (
    <DashboardKpiCard
      label={label}
      value={value}
      sub={sub}
      icon={icon}
      semantic={semantic}
      facultyModuleId="attendance"
    />
  )
}

export function FacultyAttendanceStatChip({
  label,
  value,
  tone = "neutral",
}: {
  label: string
  value: string | number
  tone?: "good" | "warn" | "bad" | "info" | "neutral"
}) {
  const toneClass = {
    good: "text-[var(--cc-sem-success)]",
    warn: "text-[var(--cc-sem-warning)]",
    bad: "text-[var(--cc-sem-danger)]",
    info: "text-[var(--cc-accent-dark)]",
    neutral: PORTAL_TEXT,
  }[tone]

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5">
      <p className={cn("text-[11px] font-medium", PORTAL_TEXT_MUTED)}>{label}</p>
      <p className={cn("mt-0.5 text-xl font-semibold tabular-nums", toneClass)}>{value}</p>
    </div>
  )
}

const BADGE_TONE: Record<string, string> = {
  good: "border-[var(--cc-sem-success)]/25 bg-[var(--cc-sem-success)]/10 text-[var(--cc-sem-success)]",
  warn: "border-[var(--cc-sem-warning)]/25 bg-[var(--cc-sem-warning)]/10 text-[var(--cc-sem-warning)]",
  bad: "border-[var(--cc-sem-danger)]/25 bg-[var(--cc-sem-danger)]/10 text-[var(--cc-sem-danger)]",
  info: "border-[var(--cc-accent-border)] bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]",
  neutral: "border-[var(--border)] bg-muted text-[var(--cc-text-muted)]",
}

export function FacultyAttendanceInsightList({
  emptyMessage,
  children,
}: {
  emptyMessage: string
  children: React.ReactNode
}) {
  const flat = (Array.isArray(children) ? children : [children]).flat()
  const hasChildren = flat.some((child) => child != null && child !== false)
  if (!hasChildren) {
    return <p className={cn("py-8 text-center text-sm", PORTAL_TEXT_MUTED)}>{emptyMessage}</p>
  }
  return <div className="-mx-3 -mb-3 divide-y divide-[var(--border)] overflow-hidden sm:-mx-4 sm:-mb-4">{children}</div>
}

export function FacultyAttendanceInsightRow({
  rank,
  index = 0,
  name,
  meta,
  badge,
  badgeTone = "neutral",
}: {
  rank?: number
  index?: number
  name: string
  meta: string
  badge: string
  badgeTone?: "good" | "warn" | "bad" | "info" | "neutral"
}) {
  const stripe = portalListStripe(rank != null ? rank - 1 : index, attendanceFamily)
  return (
    <div className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-[var(--cc-accent-soft)]/45 sm:px-4">
      {rank != null ? (
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-xl text-xs font-semibold",
            stripe.iconBg,
            stripe.iconText,
          )}
        >
          {rank}
        </span>
      ) : (
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl", stripe.iconBg)}>
          <span className={cn("size-1.5 rounded-full bg-current", stripe.iconText)} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", PORTAL_TEXT)}>{name}</p>
        <p className={cn("truncate text-xs", PORTAL_TEXT_MUTED)}>{meta}</p>
      </div>
      <Badge variant="outline" className={cn("shrink-0 tabular-nums", BADGE_TONE[badgeTone])}>
        {badge}
      </Badge>
    </div>
  )
}

export function FacultyAttendanceQuickLink({
  index = 0,
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  index?: number
  icon: LucideIcon
  label: string
  hint: string
  onClick: () => void
}) {
  const stripe = portalListStripe(index, attendanceFamily)
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 text-left transition-colors hover:bg-[var(--cc-accent-soft)]/45 sm:p-4"
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", stripe.iconBg)}>
        <Icon className={cn("h-4 w-4", stripe.iconText)} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm font-medium", PORTAL_TEXT)}>{label}</span>
        <span className={cn("block truncate text-xs", PORTAL_TEXT_MUTED)}>{hint}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--cc-text-muted)]" />
    </button>
  )
}
