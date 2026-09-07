"use client"

import type { LucideIcon } from "lucide-react"
import { TrendingDown, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDashboardKpiValue } from "@/lib/dashboard-v2/format-kpi-value"
import type { SolidListThumb } from "@/lib/student-color-hunt-theme"

/**
 * Material-inspired KPI tile: soft elevated card, floating colored icon,
 * large metric, optional footer — no side-stripe accents.
 */
export function ThemeKpiCard({
  label,
  value,
  icon: Icon,
  thumb,
  footer,
  trend,
  className,
}: {
  label: string
  value: string | number
  icon: LucideIcon
  thumb: SolidListThumb
  footer?: string
  trend?: number
  className?: string
}) {
  const hasTrend = trend != null && trend !== 0
  const showFooter = Boolean(footer) || hasTrend

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--cc-text-muted)]">
            {label}
          </p>
          <p className="mt-1.5 truncate text-[1.65rem] font-semibold tabular-nums leading-none tracking-tight text-[var(--cc-text)] sm:text-[1.75rem]">
            {formatDashboardKpiValue(value, "auto", label)}
          </p>
        </div>
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-2xl dark:ring-1 dark:ring-white/10 dark:saturate-[0.78]"
          style={{ backgroundColor: thumb.fill, color: thumb.icon }}
          aria-hidden
        >
          <Icon className="h-5 w-5" strokeWidth={2.25} />
        </div>
      </div>

      {showFooter ? (
        <>
          <div className="mt-3.5 h-px w-full bg-black/[0.06] dark:bg-white/[0.06]" />
          <div className="mt-2.5 flex min-w-0 items-center gap-1.5 text-[11px] leading-snug">
            {hasTrend ? (
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-0.5 font-semibold",
                  trend! > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-500 dark:text-rose-400",
                )}
              >
                {trend! > 0 ? (
                  <TrendingUp className="h-3 w-3" aria-hidden />
                ) : (
                  <TrendingDown className="h-3 w-3" aria-hidden />
                )}
                {trend! > 0 ? "+" : ""}
                {(Math.round(Math.abs(trend!) * 100) / 100).toFixed(2)}%
              </span>
            ) : null}
            {footer ? (
              <span className="min-w-0 truncate text-[var(--cc-text-muted)]">{footer}</span>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  )
}
