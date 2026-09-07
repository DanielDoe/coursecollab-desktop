import { hostnameOf, isProhibitedPublicOrigin } from "@/lib/compliance/environment"

const BLOCKED_HOSTS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^169\.254\./,
  /^::1$/,
  /^\[::1\]$/,
  /^metadata\.google\.internal$/i,
]

export function isBlockedServerFetchHost(host: string): boolean {
  const h = String(host ?? "").trim()
  if (!h) return true
  return BLOCKED_HOSTS.some((re) => re.test(h)) || isProhibitedPublicOrigin(`https://${h}`)
}

/**
 * Guard server-side fetch destinations. User-supplied URLs must pass this
 * before CourseCollab's backend retrieves them.
 */
export function assertSafeServerFetchUrl(raw: string): URL {
  const trimmed = String(raw ?? "").trim()
  if (!trimmed) throw new Error("URL is required")
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error("Invalid URL")
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Unsupported URL protocol")
  }
  const host = hostnameOf(parsed.origin) || parsed.hostname
  if (isBlockedServerFetchHost(host)) {
    throw new Error("URL destination is not allowed")
  }
  return parsed
}
