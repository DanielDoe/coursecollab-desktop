import type { LucideIcon } from "lucide-react"
import type { KpiAccentId } from "@/lib/appearance/dashboard-kpi-accents"

/** Consistent accent cycle for institution module KPI rows (matches main dashboard). */
export const INSTITUTION_KPI_ACCENTS: KpiAccentId[] = ["cyan", "indigo", "violet", "sky", "emerald", "amber"]

export type InstitutionKpiItem = {
  label: string
  value: string | number
  sub?: string
  icon: LucideIcon
  accent?: KpiAccentId
  valueKind?: "auto" | "count" | "percent" | "decimal"
}

export function institutionKpiAccent(index: number): KpiAccentId {
  return INSTITUTION_KPI_ACCENTS[index % INSTITUTION_KPI_ACCENTS.length]!
}
