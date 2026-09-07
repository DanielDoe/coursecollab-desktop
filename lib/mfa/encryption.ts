import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"

const ALGO = "aes-256-gcm"
const IV_LEN = 12
const DEV_FALLBACK_KEY = "coursecollab-mfa-dev-only-change-in-production"

/** Ordered key sources — first is used for new encryption; all are tried on decrypt. */
function encryptionKeySources(): string[] {
  const ordered = [
    process.env.MFA_ENCRYPTION_KEY?.trim(),
    process.env.REMEDIATION_AGENT_SECRET?.trim(),
    process.env.STACK_SECRET_SERVER_KEY?.trim(),
    DEV_FALLBACK_KEY,
  ]
  const seen = new Set<string>()
  const unique: string[] = []
  for (const raw of ordered) {
    if (!raw || seen.has(raw)) continue
    seen.add(raw)
    unique.push(raw)
  }
  return unique
}

function keyFromSource(raw: string): Buffer {
  return createHash("sha256").update(raw).digest()
}

function primaryEncryptionKey(): Buffer {
  const sources = encryptionKeySources()
  return keyFromSource(sources[0] ?? DEV_FALLBACK_KEY)
}

function decryptWithKey(payload: string, key: Buffer): string {
  const [ivB64, tagB64, dataB64] = payload.split(".")
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted MFA secret")
  }
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64url"))
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"))
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}

export type MfaDecryptResult = {
  plaintext: string
  /** 0 = primary key; higher = older fallback key (should re-encrypt). */
  keyIndex: number
}

function isValidBase32Secret(value: string): boolean {
  return /^[A-Z2-7]{16,64}$/i.test(value)
}

/** Try every configured key — fixes secrets encrypted under an older env fallback. */
export function decryptMfaSecretWithKeyIndex(payload: string): MfaDecryptResult | null {
  const trimmed = String(payload ?? "").trim()
  if (!trimmed) return null

  // Legacy/plain storage (pre-encryption rollout).
  if (!trimmed.includes(".")) {
    if (!isValidBase32Secret(trimmed)) return null
    return { plaintext: trimmed, keyIndex: -1 }
  }

  const sources = encryptionKeySources()
  let lastError: unknown = null
  for (let index = 0; index < sources.length; index += 1) {
    try {
      const plaintext = decryptWithKey(trimmed, keyFromSource(sources[index]!))
      if (!isValidBase32Secret(plaintext)) {
        throw new Error("Decrypted MFA secret is not valid base32")
      }
      return { plaintext, keyIndex: index }
    } catch (err) {
      lastError = err
    }
  }

  console.error("[mfa/encryption] decrypt failed for all key candidates:", lastError)
  return null
}

export function encryptMfaSecret(plaintext: string): string {
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, primaryEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`
}

export function decryptMfaSecret(payload: string): string {
  const result = decryptMfaSecretWithKeyIndex(payload)
  if (!result) throw new Error("Failed to decrypt MFA secret")
  return result.plaintext
}
