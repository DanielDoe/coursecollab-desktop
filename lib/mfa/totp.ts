import { generateSecret, generateURI, verifySync } from "otplib"
import QRCode from "qrcode"

export function generateTotpSecret(): string {
  return generateSecret()
}

export function verifyTotpCode(secret: string, code: string): boolean {
  const normalized = String(code ?? "").replace(/\s/g, "")
  if (!/^\d{6}$/.test(normalized)) return false
  try {
    const result = verifySync({ token: normalized, secret, epochTolerance: 1 })
    return Boolean(result && typeof result === "object" && "valid" in result ? result.valid : result)
  } catch {
    return false
  }
}

export function buildOtpAuthUri(params: {
  secret: string
  accountName: string
  issuer?: string
}): string {
  return generateURI({
    issuer: params.issuer ?? "CourseCollab",
    label: params.accountName,
    secret: params.secret,
  })
}

export async function qrDataUrlForOtpAuth(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 220,
  })
}