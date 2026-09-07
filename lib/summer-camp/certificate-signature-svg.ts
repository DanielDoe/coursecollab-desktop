import type { CertificateSignatureStyleId } from "@/lib/summer-camp/certificate-signature-styles"

/** Display name on signature artwork — strip honorifics for script rendering. */
export function signatureLabelFromName(fullName: string): string {
  return fullName
    .replace(/^(dr\.?|prof\.?|mr\.?|mrs\.?|ms\.?)\s+/i, "")
    .trim()
}

export function certificateSignatureSvg(style: CertificateSignatureStyleId, label: string): string {
  const safe = label.replace(/&/g, "&amp;").replace(/</g, "&lt;")
  const cx = 210
  if (style === "classic-script") {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="80" viewBox="0 0 420 80">
  <text x="${cx}" y="52" text-anchor="middle" fill="#1e293b" font-family="'Segoe Script','Brush Script MT',cursive" font-size="46" font-style="italic">${safe}</text>
</svg>`
  }
  if (style === "formal-italic") {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="80" viewBox="0 0 420 80">
  <text x="${cx}" y="50" text-anchor="middle" fill="#0f172a" font-family="Georgia,'Times New Roman',serif" font-size="40" font-style="italic" letter-spacing="0.5">${safe}</text>
</svg>`
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="80" viewBox="0 0 420 80">
  <text x="${cx}" y="48" text-anchor="middle" fill="#1e293b" font-family="'Trebuchet MS',Arial,sans-serif" font-size="34" font-weight="600" letter-spacing="-0.5">${safe}</text>
</svg>`
}
