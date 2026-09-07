import { PRODUCTION_PUBLIC_ORIGINS, hostnameOf, isProhibitedPublicOrigin } from "@/lib/compliance/environment"

const RELATIVE_SAFE = /^\/(?!\/)/

export function isSafeAppRedirect(target: string, allowedOrigins: readonly string[] = PRODUCTION_PUBLIC_ORIGINS): boolean {
  const value = String(target ?? "").trim()
  if (!value) return false
  if (RELATIVE_SAFE.test(value) && !value.includes("\\")) return true
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false
    if (isProhibitedPublicOrigin(value) && parsed.protocol !== "https:") return false
    const host = hostnameOf(value)
    return allowedOrigins.some((origin) => hostnameOf(origin) === host)
  } catch {
    return false
  }
}

export function sanitizeAppRedirect(target: string | null | undefined, fallback = "/"): string {
  const value = String(target ?? "").trim()
  if (isSafeAppRedirect(value)) return value
  return fallback
}
