/**
 * Production-only filters for AI remediation — dev/local/preview logs are out of scope.
 */

import {
  REMEDIATION_DEV_TITLE_PREFIXES,
  REMEDIATION_NON_PRODUCTION_ENVIRONMENTS,
  REMEDIATION_PRODUCTION_ENVIRONMENT,
  REMEDIATION_PRODUCTION_HOST_SUFFIXES,
} from "@/lib/ai-remediation-constants"

export type RemediationLogContext = {
  environment?: string | null
  page_url?: string | null
  route?: string | null
  api_endpoint?: string | null
  title?: string | null
}

export function isLocalDevUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false
  try {
    const host = new URL(url).hostname.toLowerCase()
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local")
    )
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url)
  }
}

export function isKnownProductionHost(url: string | null | undefined): boolean {
  if (!url?.trim()) return false
  try {
    const host = new URL(url).hostname.toLowerCase()
    return REMEDIATION_PRODUCTION_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`),
    )
  } catch {
    return REMEDIATION_PRODUCTION_HOST_SUFFIXES.some((suffix) =>
      url.toLowerCase().includes(suffix),
    )
  }
}

export function hasDevTitle(title: string | null | undefined): boolean {
  const normalized = title?.trim() ?? ""
  if (!normalized) return false
  return REMEDIATION_DEV_TITLE_PREFIXES.some((prefix) => normalized.startsWith(prefix))
}

/** True when a single log row reflects a production issue the automation should act on. */
export function isProductionRemediationLog(
  log: RemediationLogContext | null | undefined,
): { ok: true } | { ok: false; reason: string } {
  if (!log) {
    return { ok: false, reason: "No system log — cannot confirm production issue" }
  }

  if (hasDevTitle(log.title)) {
    return { ok: false, reason: "Development/synthetic test log — not a production bug" }
  }

  if (isLocalDevUrl(log.page_url) || isLocalDevUrl(log.api_endpoint)) {
    return {
      ok: false,
      reason: "Local development URL (localhost) — automation targets production only",
    }
  }

  const env = (log.environment ?? "").trim().toLowerCase()
  if (env && REMEDIATION_NON_PRODUCTION_ENVIRONMENTS.includes(env as (typeof REMEDIATION_NON_PRODUCTION_ENVIRONMENTS)[number])) {
    return {
      ok: false,
      reason: `Non-production environment (${env}) — automation targets production only`,
    }
  }

  if (env === REMEDIATION_PRODUCTION_ENVIRONMENT) {
    return { ok: true }
  }

  if (isKnownProductionHost(log.page_url) || isKnownProductionHost(log.api_endpoint)) {
    return { ok: true }
  }

  if (!env) {
    return {
      ok: false,
      reason: "Missing environment and no production host in URL — cannot confirm production issue",
    }
  }

  return {
    ok: false,
    reason: `Environment ${env} is not production — automation targets production only`,
  }
}

/** Prefer latestLog; fall back to any production log in recent samples. */
export function isProductionRemediationGroup(
  latestLog: RemediationLogContext | null | undefined,
  recentLogs: RemediationLogContext[] = [],
): { ok: true } | { ok: false; reason: string } {
  const latestCheck = isProductionRemediationLog(latestLog)
  if (latestCheck.ok) return latestCheck

  for (const log of recentLogs) {
    const check = isProductionRemediationLog(log)
    if (check.ok) return { ok: true }
  }

  return latestCheck
}
