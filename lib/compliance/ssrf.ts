import { isProhibitedPublicOrigin } from "@/lib/compliance/environment"

const BLOCKED_PROTOCOLS = /^(file|ftp|gopher|data|javascript):/i
const PRIVATE_HOSTS =
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1|.*\.local|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|169\.254\.\d+\.\d+|metadata\.google\.internal)$/i

export function isBlockedFetchUrl(raw: string): boolean {
  const value = String(raw ?? "").trim()
  if (!value) return true
  if (BLOCKED_PROTOCOLS.test(value)) return true
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return true
    if (PRIVATE_HOSTS.test(parsed.hostname)) return true
    if (isProhibitedPublicOrigin(value) && parsed.protocol !== "https:") return true
    return PRIVATE_HOSTS.test(parsed.hostname)
  } catch {
    return true
  }
}

export function assertSafeOutboundUrl(raw: string): URL {
  if (isBlockedFetchUrl(raw)) {
    throw new Error("Outbound URL is not allowed.")
  }
  return new URL(raw)
}
