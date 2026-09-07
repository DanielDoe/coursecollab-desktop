import { getBaseUrl } from "@/lib/get-base-url"

/** Client-safe URL helpers — no database imports. */

export function getCertificateVerificationBaseUrl(requestOrigin?: string | null): string {
  return getBaseUrl(requestOrigin)
}

export function buildCertificateVerificationUrl(
  verificationCode: string,
  requestOrigin?: string | null,
): string {
  const origin = getCertificateVerificationBaseUrl(requestOrigin)
  return `${origin}/verify/certificate/${encodeURIComponent(verificationCode)}`
}

export const SAMPLE_CERTIFICATE_VERIFICATION_CODE = "CAMP-2026-PREVIEW"

export function buildSampleCertificateVerificationUrl(requestOrigin?: string | null): string {
  return buildCertificateVerificationUrl(SAMPLE_CERTIFICATE_VERIFICATION_CODE, requestOrigin)
}
