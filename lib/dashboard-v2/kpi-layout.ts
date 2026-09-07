import type { DashboardWidgetDef } from "./types"

export type DashboardKpiGridTier = "mobile" | "tablet" | "desktop"

export type DashboardKpiGridConfig = {
  tier: DashboardKpiGridTier
  columns: 2 | 3 | 4
  maxRows: number
  maxSlots: number
  gridClass: string
}

const MOBILE_MAX = 639
const TABLET_MAX = 1023

export function resolveDashboardKpiGrid(width: number): DashboardKpiGridConfig {
  if (width <= MOBILE_MAX) {
    return {
      tier: "mobile",
      columns: 2,
      maxRows: 2,
      maxSlots: 4,
      gridClass: "grid grid-cols-2 gap-2.5 sm:gap-3 [&>*]:min-w-0 [&>*]:w-full auto-rows-[112px] sm:auto-rows-[120px]",
    }
  }
  if (width <= TABLET_MAX) {
    return {
      tier: "tablet",
      columns: 3,
      maxRows: 2,
      maxSlots: 6,
      gridClass: "grid grid-cols-3 gap-3 [&>*]:min-w-0 [&>*]:w-full auto-rows-[112px] sm:auto-rows-[120px]",
    }
  }
  return {
    tier: "desktop",
    columns: 4,
    maxRows: 2,
    maxSlots: 8,
    gridClass:
      "grid grid-cols-2 sm:grid-cols-4 gap-3 [&>*]:min-w-0 [&>*]:w-full auto-rows-[112px] sm:auto-rows-[120px]",
  }
}

/** Keep KPIs that fit the viewport; trim to full rows only when exceeding max slots. */
export function sliceKpisForGrid<T>(items: T[], grid: DashboardKpiGridConfig): T[] {
  if (items.length === 0) return items

  if (items.length <= grid.maxSlots) {
    return items
  }

  const capped = items.slice(0, grid.maxSlots)
  const fullRowCount = Math.floor(capped.length / grid.columns) * grid.columns
  if (fullRowCount > 0) return capped.slice(0, fullRowCount)

  return capped.slice(0, grid.columns)
}

export function countHiddenKpis(total: number, visible: number): number {
  return Math.max(0, total - visible)
}

export function kpiOverflowHint(hidden: number, tier: DashboardKpiGridConfig["tier"]): string | null {
  if (hidden <= 0) return null
  if (tier === "mobile") return `${hidden} more KPI${hidden === 1 ? "" : "s"} on larger screens`
  if (tier === "tablet") return `${hidden} more KPI${hidden === 1 ? "" : "s"} on desktop`
  return null
}

export function isKpiWidget(widget: DashboardWidgetDef): boolean {
  return widget.kind === "kpi"
}
