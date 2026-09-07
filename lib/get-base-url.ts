import {
  defaultProductionOrigin,
  isProductionRuntime,
  isProhibitedPublicOrigin,
  resolveConfiguredPublicOrigin,
  sanitizePublicOrigin,
} from "@/lib/compliance/environment"

/**
 * Resolve base URL for internal API calls (evaluate-code, etc.).
 * Sanitizes env vars - they can have trailing \r\n from .env files.
 * Production never falls back to localhost.
 */
export function getBaseUrl(requestOrigin?: string | null): string {
  const raw =
    requestOrigin ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    (isProductionRuntime() ? defaultProductionOrigin() : "http://localhost:3000")

  const cleaned = sanitizePublicOrigin(raw) || (isProductionRuntime() ? defaultProductionOrigin() : "http://localhost:3000")

  if (isProductionRuntime() && isProhibitedPublicOrigin(cleaned)) {
    throw new Error("Production base URL is missing or points at a development host.")
  }

  return cleaned
}

/** Permanent public links (door QR, printouts) always target production — never localhost. */
export function getPermanentPublicBaseUrl(): string {
  return resolveConfiguredPublicOrigin() ?? defaultProductionOrigin()
}
