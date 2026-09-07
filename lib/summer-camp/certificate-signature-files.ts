import sharp from "sharp"
import { savePublicUpload } from "@/lib/blob-or-local-public"
import {
  CERTIFICATE_SIGNATURE_STYLES,
  type CertificateSignatureStyleId,
} from "@/lib/summer-camp/certificate-signature-styles"
import { certificateSignatureSvg, signatureLabelFromName } from "@/lib/summer-camp/certificate-signature-svg"
import { instructorSignatureFileKey } from "@/lib/summer-camp/certificate-signature-keys"

export function instructorSignaturePublicPath(
  styleId: CertificateSignatureStyleId,
  instructorId: number,
): string {
  return `/summer-camp/signatures/${styleId}/${instructorSignatureFileKey(instructorId)}.png`
}

async function renderSignaturePng(
  styleId: CertificateSignatureStyleId,
  displayName: string,
): Promise<Buffer> {
  const label = signatureLabelFromName(displayName)
  const svg = certificateSignatureSvg(styleId, label)
  return sharp(Buffer.from(svg)).png().toBuffer()
}

async function persistSignaturePng(
  styleId: CertificateSignatureStyleId,
  instructorId: number,
  png: Buffer,
): Promise<string> {
  const fileKey = instructorSignatureFileKey(instructorId)
  const blobKey = `summer-camp/signatures/${styleId}/${fileKey}.png`
  return savePublicUpload({
    blobKey,
    relativePublicPath: `summer-camp/signatures/${styleId}/${fileKey}.png`,
    bytes: png,
    contentType: "image/png",
    allowOverwrite: true,
  })
}

export async function writeInstructorSignaturePng(
  styleId: CertificateSignatureStyleId,
  instructorId: number,
  displayName: string,
): Promise<string> {
  const png = await renderSignaturePng(styleId, displayName)
  return persistSignaturePng(styleId, instructorId, png)
}

export async function ensureInstructorSignaturePng(
  styleId: CertificateSignatureStyleId,
  instructorId: number,
  displayName: string,
): Promise<string> {
  return writeInstructorSignaturePng(styleId, instructorId, displayName)
}

export async function ensureInstructorSignaturesAllStyles(
  instructorId: number,
  displayName: string,
): Promise<void> {
  for (const style of CERTIFICATE_SIGNATURE_STYLES) {
    await ensureInstructorSignaturePng(style.id, instructorId, displayName)
  }
}
