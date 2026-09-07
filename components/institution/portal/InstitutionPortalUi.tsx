"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { DashboardKpiCard } from "@/components/dashboard-v2/DashboardKpiCard"
import { useDashboardKpiGrid } from "@/hooks/use-dashboard-kpi-grid"
import { sliceKpisForGrid } from "@/lib/dashboard-v2/kpi-layout"
import { cn } from "@/lib/utils"
import { PORTAL_CARD, PORTAL_CTA, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import {
  institutionKpiAccent,
  type InstitutionKpiItem,
} from "@/lib/institution-kpi-config"

export type { InstitutionKpiItem }

export type StatusTone = "success" | "warning" | "danger" | "muted" | "info"

const STATUS_CLASS: Record<StatusTone, string> = {
  success: "bg-[var(--cc-success)]/15 text-[var(--cc-success)]",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  danger: "bg-red-500/15 text-red-700 dark:text-red-300",
  muted: "bg-[var(--muted)] text-[var(--cc-text-secondary)]",
  info: "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]",
}

export function InstitutionStatusBadge({ label, tone = "muted" }: { label: string; tone?: StatusTone }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_CLASS[tone])}>
      {label}
    </span>
  )
}

export function InstitutionKpiGrid({ items, isLoading }: { items: InstitutionKpiItem[]; isLoading?: boolean }) {
  const kpiGrid = useDashboardKpiGrid()
  const visible = sliceKpisForGrid(items, kpiGrid)

  return (
    <div className={kpiGrid.gridClass}>
      {visible.map((item, i) => (
        <div key={item.label} className="flex h-full min-w-0 w-full">
          <DashboardKpiCard
            label={item.label}
            value={item.value}
            sub={item.sub ?? "\u00A0"}
            icon={item.icon}
            accent={item.accent ?? institutionKpiAccent(i)}
            valueKind={item.valueKind}
            isLoading={isLoading}
          />
        </div>
      ))}
    </div>
  )
}

export function InstitutionSectionCard({
  title,
  hint,
  actions,
  children,
  className,
}: {
  title: string
  hint?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn(PORTAL_CARD, "overflow-hidden", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
        <div>
          <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>{title}</h3>
          {hint ? <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>{hint}</p> : null}
        </div>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

export function InstitutionEmptyState({
  title,
  body,
  actionLabel,
  actionHref,
  onAction,
}: {
  title: string
  body: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
}) {
  return (
    <div className={cn(PORTAL_CARD, "px-4 py-10 text-center")}>
      <p className={cn("text-sm font-medium", PORTAL_TEXT)}>{title}</p>
      <p className={cn("mx-auto mt-1 max-w-md text-sm", PORTAL_TEXT_MUTED)}>{body}</p>
      {actionLabel && actionHref ? (
        <Link href={actionHref} className={cn(PORTAL_CTA, "mt-4 inline-flex rounded-xl px-4 py-2 text-sm")}>
          {actionLabel}
        </Link>
      ) : null}
      {actionLabel && onAction ? (
        <button type="button" className={cn(PORTAL_CTA, "mt-4 rounded-xl px-4 py-2 text-sm")} onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

export function InstitutionDataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  rowKey,
  empty,
}: {
  columns: Array<{ key: string; label: string; render?: (row: T) => ReactNode; className?: string }>
  rows: T[]
  rowKey: (row: T) => string | number
  empty?: ReactNode
}) {
  if (rows.length === 0) {
    return empty ?? <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No records</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className={cn("border-b border-[var(--border)] text-xs", PORTAL_TEXT_MUTED)}>
            {columns.map((col) => (
              <th key={col.key} className={cn("py-2 pr-3 font-medium", col.className)}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="hover:bg-muted/30">
              {columns.map((col) => (
                <td key={col.key} className={cn("py-2.5 pr-3 align-top", col.className)}>
                  {col.render ? col.render(row) : String(row[col.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function InstitutionToolbar({
  search,
  onSearchChange,
  placeholder = "Search…",
  filters,
  trailing,
}: {
  search?: string
  onSearchChange?: (v: string) => void
  placeholder?: string
  filters?: ReactNode
  trailing?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        {onSearchChange ? (
          <input
            value={search ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={placeholder}
            className="h-10 w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm"
          />
        ) : null}
        {filters}
      </div>
      {trailing}
    </div>
  )
}

export function InstitutionKeyValueList({ rows }: { rows: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="divide-y divide-[var(--border)]">
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between gap-4 py-2.5 text-sm">
          <dt className={PORTAL_TEXT_MUTED}>{row.label}</dt>
          <dd className={cn("text-right font-medium", PORTAL_TEXT)}>{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}
