/**
 * Canonical legal destinations. Do not hardcode policy text in feature components.
 */

export const LEGAL_PATHS = {
  privacy: "/privacy",
  terms: "/terms",
  aiAndData: "/ai-and-data",
  /** App Store / mobile audit aliases — same content as canonical routes. */
  privacyPolicy: "/legal/privacy-policy",
  termsOfService: "/legal/terms-of-service",
  support: "/support",
} as const

/** Public JSON API for structured legal documents (web + mobile). */
export const LEGAL_CONTENT_API_PATH = "/api/compliance/legal"

export function legalUrl(
  key: keyof typeof LEGAL_PATHS,
  origin?: string | null,
): string {
  const path = LEGAL_PATHS[key]
  const base = String(origin ?? "").replace(/\/+$/, "")
  return base ? `${base}${path}` : path
}

export const LEGAL_LINKS = [
  { key: "privacy", href: LEGAL_PATHS.privacy, label: "Privacy Policy" },
  { key: "terms", href: LEGAL_PATHS.terms, label: "Terms of Service" },
  { key: "aiAndData", href: LEGAL_PATHS.aiAndData, label: "AI & Data" },
  { key: "support", href: LEGAL_PATHS.support, label: "Support" },
] as const

/** Absolute URLs for mobile clients and App Store Connect metadata. */
export function legalUrlsForOrigin(origin: string) {
  return {
    privacyPolicy: legalUrl("privacyPolicy", origin),
    termsOfService: legalUrl("termsOfService", origin),
    aiAndData: legalUrl("aiAndData", origin),
    support: legalUrl("support", origin),
  }
}
