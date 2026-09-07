/**
 * Static scan used by `npm run audit:production`.
 * Allowlisted paths are development, tests, docs, and example env — not production bundles.
 */

export type ScanFinding = {
  file: string
  line: number
  kind: "localhost_fallback" | "prohibited_host" | "test_payment" | "debug_flag"
  excerpt: string
}

export const PRODUCTION_SCAN_ALLOWLIST = [
  /^\.env\.example$/,
  /^\.env\.local$/,
  /^playwright\.config\.ts$/,
  /^scripts\//,
  /^tests\//,
  /^docs\//,
  /^migrations\//,
  /^\.cursor\//,
  /^\.agents\//,
  /^\.tmp\//,
  /^tmp\//,
  /^lib\/compliance\//,
  /^lib\/get-base-url\.ts$/,
  /^ios\//,
] as const

const LOCALHOST_FALLBACK =
  /(?:process\.env\.[A-Z0-9_]+|\w+)\s*\|\|\s*["'`]https?:\/\/(?:localhost|127\.0\.0\.1)/
const PROHIBITED_HOST = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|[a-z0-9.-]+\.ngrok(?:-free)?\.(?:app|io|dev))/i
const TEST_PAYMENT = /sk_test_|pk_test_|whsec_test_/
const DEBUG_FLAG = /NEXT_PUBLIC_(?:DEBUG|DEV_TOOLS|STAGING_BANNER)\s*=\s*["'`]?true/i

export function isAllowlistedScanPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/")
  return PRODUCTION_SCAN_ALLOWLIST.some((re) => re.test(normalized))
}

export function scanSourceText(relativePath: string, source: string): ScanFinding[] {
  if (isAllowlistedScanPath(relativePath)) return []
  const findings: ScanFinding[] = []
  const lines = source.split(/\r?\n/)
  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
      return
    }
    if (LOCALHOST_FALLBACK.test(line)) {
      findings.push({
        file: relativePath,
        line: index + 1,
        kind: "localhost_fallback",
        excerpt: trimmed.slice(0, 180),
      })
    } else if (PROHIBITED_HOST.test(line) && !/course-collab\.com|coursecollab\.vercel\.app/.test(line)) {
      findings.push({
        file: relativePath,
        line: index + 1,
        kind: "prohibited_host",
        excerpt: trimmed.slice(0, 180),
      })
    }
    if (TEST_PAYMENT.test(line) && !/example|placeholder|your_/i.test(line)) {
      findings.push({
        file: relativePath,
        line: index + 1,
        kind: "test_payment",
        excerpt: trimmed.slice(0, 180),
      })
    }
    if (DEBUG_FLAG.test(line)) {
      findings.push({
        file: relativePath,
        line: index + 1,
        kind: "debug_flag",
        excerpt: trimmed.slice(0, 180),
      })
    }
  })
  return findings
}
