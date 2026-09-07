import { DEFAULT_CORA_WARNING_THRESHOLDS } from "@/lib/institution-plans"

export function coraUtilizationPercent(included: number, used: number): number {
  if (!Number.isInteger(included) || included <= 0) return 0
  if (!Number.isInteger(used) || used <= 0) return 0
  return Math.trunc((used * 100) / included)
}

export function coraUsageAlerts(
  included: number,
  used: number,
  thresholds: readonly number[] = DEFAULT_CORA_WARNING_THRESHOLDS,
): { threshold: number; triggered: boolean; percent: number }[] {
  const percent = coraUtilizationPercent(included, used)
  return thresholds.map((threshold) => ({
    threshold,
    triggered: percent >= threshold,
    percent,
  }))
}

export function highestTriggeredCoraAlert(
  included: number,
  used: number,
  thresholds: readonly number[] = DEFAULT_CORA_WARNING_THRESHOLDS,
): number | null {
  const alerts = coraUsageAlerts(included, used, thresholds).filter((a) => a.triggered)
  if (alerts.length === 0) return null
  return alerts.reduce((max, a) => (a.threshold > max ? a.threshold : max), 0)
}
