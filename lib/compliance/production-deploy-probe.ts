/**
 * Verify compliance routes are live on the deployed production origin.
 * Source existing in repo ≠ deployed to production.
 */

import { LEGAL_PATHS } from "@/lib/compliance/legal"

export type DeployProbeResult = {
  origin: string
  path: string
  status: number | "error"
  ok: boolean
  detail: string
}

const DEFAULT_PRODUCTION_ORIGIN = "https://course-collab.com"

export function productionOriginFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.CC_PRODUCTION_ORIGIN ||
    env.NEXT_PUBLIC_APP_URL ||
    env.NEXT_PUBLIC_BASE_URL ||
    DEFAULT_PRODUCTION_ORIGIN
  ).replace(/\/+$/, "")
}

export async function probeProductionDeploy(
  origin = productionOriginFromEnv(),
): Promise<DeployProbeResult[]> {
  const base = origin.replace(/\/+$/, "")
  const checks: Array<{ path: string; method?: string; acceptStatus?: (n: number) => boolean; detail: string }> = [
    { path: LEGAL_PATHS.privacy, detail: "Privacy policy page" },
    { path: LEGAL_PATHS.terms, detail: "Terms page" },
    { path: LEGAL_PATHS.privacyPolicy, detail: "Privacy policy alias" },
    { path: LEGAL_PATHS.support, detail: "Support page" },
    {
      path: "/api/compliance/legal",
      acceptStatus: (n) => n === 200,
      detail: "Structured legal content API",
    },
    {
      path: "/api/account/delete",
      method: "POST",
      acceptStatus: (n) => n !== 404,
      detail: "Account deletion API registered (non-404)",
    },
  ]

  const results: DeployProbeResult[] = []

  for (const check of checks) {
    const url = `${base}${check.path}`
    try {
      const response = await fetch(url, {
        method: check.method ?? "GET",
        headers: check.method === "POST" ? { "Content-Type": "application/json" } : undefined,
        body: check.method === "POST" ? JSON.stringify({}) : undefined,
        redirect: "manual",
      })
      const status = response.status
      const ok = check.acceptStatus ? check.acceptStatus(status) : status >= 200 && status < 400
      results.push({
        origin: base,
        path: check.path,
        status,
        ok,
        detail: check.detail,
      })
    } catch {
      results.push({
        origin: base,
        path: check.path,
        status: "error",
        ok: false,
        detail: `${check.detail} — fetch failed`,
      })
    }
  }

  return results
}

export function deployProbeFailed(results: DeployProbeResult[]): DeployProbeResult[] {
  return results.filter((result) => !result.ok)
}
