import type { CampCertificateSignatory, CampCertificateTemplate } from "@/lib/summer-camp/certificate-template-types"
import { instructorSignatureFileKey } from "@/lib/summer-camp/certificate-signature-keys"

export type CertificateSignatureStyleId = "classic-script" | "formal-italic" | "modern-flow"

/** Legacy preset keys for fixed department signatory artwork. */
export type CertificateSignatoryKey = "anthony-hill" | "ifeoma-san"

export const CERTIFICATE_SIGNATURE_STYLES: Array<{
  id: CertificateSignatureStyleId
  label: string
  description: string
}> = [
  {
    id: "classic-script",
    label: "Classic script",
    description: "Flowing cursive with a gentle slant — traditional academic certificates.",
  },
  {
    id: "formal-italic",
    label: "Formal italic",
    description: "Refined serif italic with understated flourish.",
  },
  {
    id: "modern-flow",
    label: "Modern flow",
    description: "Clean connected strokes with a subtle underline wave.",
  },
]

const LEGACY_SIGNATORY_KEYS: Record<CertificateSignatoryKey, { match: RegExp; file: string }> = {
  "anthony-hill": { match: /anthony\s*hill/i, file: "anthony-hill" },
  "ifeoma-san": { match: /ifeoma\s*san/i, file: "ifeoma-san" },
}

/** File key under public/summer-camp/signatures/{style}/ — instructor-{id} or legacy slug. */
export function resolveSignatoryAssetKey(sig: CampCertificateSignatory): string | null {
  if (sig.instructorId != null && Number.isFinite(sig.instructorId)) {
    return instructorSignatureFileKey(sig.instructorId)
  }
  for (const [key, meta] of Object.entries(LEGACY_SIGNATORY_KEYS) as Array<
    [CertificateSignatoryKey, { match: RegExp; file: string }]
  >) {
    if (meta.match.test(sig.name)) return meta.file
  }
  if (sig.id === "sig-1") return "anthony-hill"
  return null
}

/** @deprecated Use resolveSignatoryAssetKey */
export function resolveSignatoryKey(sig: CampCertificateSignatory): CertificateSignatoryKey | null {
  const key = resolveSignatoryAssetKey(sig)
  if (key === "anthony-hill" || key === "ifeoma-san") return key
  return null
}

export function signatureAssetUrl(
  styleId: CertificateSignatureStyleId,
  assetKey: string,
): string {
  return `/summer-camp/signatures/${styleId}/${assetKey}.png`
}

export function applySignatureStyleToTemplate(
  template: CampCertificateTemplate,
  styleId: CertificateSignatureStyleId,
): CampCertificateTemplate {
  return {
    ...template,
    signatureStyle: styleId,
    signatories: template.signatories.map((sig) => {
      const key = resolveSignatoryAssetKey(sig)
      if (!key) return sig
      return { ...sig, signatureImageUrl: signatureAssetUrl(styleId, key) }
    }),
  }
}

export function normalizeTemplateSignatureStyle(
  template: CampCertificateTemplate,
): CampCertificateTemplate {
  const styleId = template.signatureStyle
  if (!styleId) return template
  const valid = CERTIFICATE_SIGNATURE_STYLES.some((s) => s.id === styleId)
  if (!valid) return template
  return applySignatureStyleToTemplate(template, styleId)
}
