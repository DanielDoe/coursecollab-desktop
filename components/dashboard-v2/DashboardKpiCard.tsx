"use client"

import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DashboardSemanticType } from "@/lib/appearance/component-recipes"
import {
  type KpiAccentId,
  resolveKpiAccent,
} from "@/lib/appearance/dashboard-kpi-accents"
import type { SolidListThumb } from "@/lib/student-color-hunt-theme"
import { formatDashboardKpiValue, formatKpiSubtext, type KpiValueKind } from "@/lib/dashboard-v2/format-kpi-value"

export function DashboardKpiCard({
  label,
  value,
  sub,
  icon: Icon,
  semantic,
  accent,
  iconBg,
  iconColor,
  solidThumb,
  valueClassName,
  valueKind = "auto",
  isLoading,
}: {
  label: string
  value: string | number
  sub?: string
  icon: LucideIcon
  semantic?: DashboardSemanticType
  accent?: KpiAccentId
  iconBg?: string
  iconColor?: string
  /** Solid Color Hunt fill + icon color (student dashboard KPIs). */
  solidThumb?: SolidListThumb
  valueClassName?: string
  valueKind?: KpiValueKind
  facultyModuleId?: string
  isLoading?: boolean
}) {
  const tokens =
    solidThumb
      ? null
      : accent || semantic
        ? resolveKpiAccent({ accent, semantic })
        : iconBg && iconColor
          ? { iconWell: iconBg, icon: iconColor }
          : resolveKpiAccent({ semantic: "neutral" })

  return (
    <div
      className={cn(
        "group relative flex h-[112px] w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3.5 transition-colors duration-200 hover:bg-[var(--muted)]/35 sm:h-[112px] sm:p-4",
      )}
    >
      <div className="relative z-10 flex h-full min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--cc-text-muted)] sm:text-[11px]">
            {label}
          </p>
          {isLoading ? (
            <>
              <span className="mt-0.5 h-7 w-16 animate-pulse rounded-md bg-[var(--muted)]" />
              <span className="h-3 w-24 animate-pulse rounded bg-[var(--muted)]" />
            </>
          ) : (
            <>
              <p
                className={cn(
                  "truncate text-[1.65rem] font-semibold tabular-nums leading-none tracking-tight text-[var(--cc-text)] sm:text-[1.85rem]",
                  valueClassName,
                )}
              >
                {formatDashboardKpiValue(value, valueKind, label)}
              </p>
              <p className="truncate text-[11px] leading-4 text-[var(--cc-text-muted)] sm:text-xs">
                {sub ? formatKpiSubtext(sub) : "\u00A0"}
              </p>
            </>
          )}
        </div>
        {solidThumb ? (
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-105"
            style={{
              backgroundColor: solidThumb.fill,
              color: solidThumb.icon,
            }}
          >
            <Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden />
          </div>
        ) : (
          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-105",
              tokens!.iconWell,
            )}
          >
            <Icon className={cn("h-5 w-5", tokens!.icon)} strokeWidth={2} />
          </div>
        )}
      </div>
    </div>
  )
}

export function DashboardPanel({
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
    <div
      className={cn(
        "flex h-full min-h-[280px] flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6",
        className,
      )}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  )
}
