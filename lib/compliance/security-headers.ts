/**
 * Conservative production headers. Camera/microphone stay allowed for Notetaker and uploads.
 * Only `frame-ancestors 'self'` is shipped as CSP. A full script/style CSP is not
 * shipped — Stripe, Cora, Blob, and fonts would break without a measured allowlist.
 */

export const PRODUCTION_SECURITY_HEADERS: Array<{ key: string; value: string }> = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=(), payment=(self), usb=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
]

export const REQUIRED_SECURITY_HEADER_NAMES = PRODUCTION_SECURITY_HEADERS.map((header) => header.key)
