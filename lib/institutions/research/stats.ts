import { MIN_CELL_SIZE } from "@/lib/institutions/research/capability-catalog"

export type DescriptiveStats = {
  n: number
  mean: number | null
  median: number | null
  sd: number | null
  min: number | null
  max: number | null
  insufficient: boolean
}

export type GroupContrast = {
  available: boolean
  meanDiff: number | null
  cohensD: number | null
  note: string
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Sample descriptive stats. Hidden when N < cell minimum. */
export function descriptiveStats(values: number[], cellMinimum = MIN_CELL_SIZE): DescriptiveStats {
  const clean = values.filter((v) => Number.isFinite(v))
  const n = clean.length
  if (n < cellMinimum) {
    return { n, mean: null, median: null, sd: null, min: null, max: null, insufficient: true }
  }
  const sorted = [...clean].sort((a, b) => a - b)
  const mean = sorted.reduce((s, v) => s + v, 0) / n
  const mid = Math.floor(n / 2)
  const median = n % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)
  return {
    n,
    mean: round1(mean),
    median: round1(median),
    sd: round1(Math.sqrt(variance)),
    min: round1(sorted[0]!),
    max: round1(sorted[n - 1]!),
    insufficient: false,
  }
}

export const CONTRAST_NOTE =
  "Descriptive contrast only. Not a hypothesis test and not a causal estimate unless the study is an authorized experiment with explicit assignment."

/** Mean difference and Cohen's d. No p-values. */
export function groupContrast(a: number[], b: number[], cellMinimum = MIN_CELL_SIZE): GroupContrast {
  const A = descriptiveStats(a, cellMinimum)
  const B = descriptiveStats(b, cellMinimum)
  if (A.insufficient || B.insufficient || A.mean == null || B.mean == null || A.sd == null || B.sd == null) {
    return {
      available: false,
      meanDiff: null,
      cohensD: null,
      note: `Need N ≥ ${cellMinimum} in each group before a contrast is shown.`,
    }
  }
  const meanDiff = A.mean - B.mean
  const pooled = Math.sqrt(((A.n - 1) * A.sd ** 2 + (B.n - 1) * B.sd ** 2) / (A.n + B.n - 2))
  return {
    available: true,
    meanDiff: round2(meanDiff),
    cohensD: pooled > 0 ? round2(meanDiff / pooled) : 0,
    note: CONTRAST_NOTE,
  }
}

export function toCsv(headers: string[], rows: Array<Array<string | number | null>>): string {
  const esc = (v: string | number | null) => {
    const s = v == null ? "" : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.map(esc).join(","), ...rows.map((row) => row.map(esc).join(","))].join("\n")
}
