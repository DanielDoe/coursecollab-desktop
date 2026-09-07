import { createHash, randomBytes } from "crypto"
import { sql } from "@/lib/db"
import type { AuthUserType } from "@/lib/auth-refresh-tokens"
import { ensureMfaSchema } from "@/lib/ensure-mfa-schema"
import { decryptMfaSecretWithKeyIndex, encryptMfaSecret } from "@/lib/mfa/encryption"
import { DEFAULT_MFA_TRUST_DAYS } from "@/lib/mfa/trust"

export type MfaUserType = AuthUserType

export type UserMfaRow = {
  id: number
  user_type: MfaUserType
  user_id: number
  totp_secret_encrypted: string
  enabled_at: Date | string | null
  trust_duration_days?: number
}

export function hashMfaToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex")
}

export function generateRecoveryCode(): string {
  const part = () => randomBytes(3).toString("hex").toUpperCase()
  return `${part()}-${part()}`
}

export async function getUserMfa(userType: MfaUserType, userId: number): Promise<UserMfaRow | null> {
  await ensureMfaSchema()
  const rows = (await sql`
    SELECT id, user_type, user_id, totp_secret_encrypted, enabled_at, trust_duration_days
    FROM user_mfa
    WHERE user_type = ${userType} AND user_id = ${userId}
    LIMIT 1
  `) as UserMfaRow[]
  return rows.length ? rows[0] : null
}

export async function isMfaEnabled(userType: MfaUserType, userId: number): Promise<boolean> {
  const row = await getUserMfa(userType, userId)
  return Boolean(row?.enabled_at)
}

export async function getDecryptedTotpSecret(userType: MfaUserType, userId: number): Promise<string | null> {
  const row = await getUserMfa(userType, userId)
  if (!row?.enabled_at) return null

  const decrypted = decryptMfaSecretWithKeyIndex(row.totp_secret_encrypted)
  if (!decrypted) return null

  if (decrypted.keyIndex !== 0) {
    try {
      const reencrypted = encryptMfaSecret(decrypted.plaintext)
      await sql`
        UPDATE user_mfa
        SET totp_secret_encrypted = ${reencrypted}, updated_at = NOW()
        WHERE user_type = ${userType} AND user_id = ${userId}
      `
    } catch (err) {
      console.error("[mfa] re-encrypt after fallback decrypt failed (non-blocking):", err)
    }
  }

  return decrypted.plaintext
}

export async function enableUserMfa(params: {
  userType: MfaUserType
  userId: number
  secret: string
}): Promise<number> {
  await ensureMfaSchema()
  const encrypted = encryptMfaSecret(params.secret)
  const rows = (await sql`
    INSERT INTO user_mfa (user_type, user_id, totp_secret_encrypted, enabled_at, trust_duration_days, updated_at)
    VALUES (${params.userType}, ${params.userId}, ${encrypted}, NOW(), ${DEFAULT_MFA_TRUST_DAYS}, NOW())
    ON CONFLICT (user_type, user_id) DO UPDATE SET
      totp_secret_encrypted = EXCLUDED.totp_secret_encrypted,
      enabled_at = NOW(),
      updated_at = NOW()
    RETURNING id
  `) as { id: number }[]
  return Number(rows[0].id)
}

/** Turn MFA off — next logins skip authenticator until the user enables it again. */
export async function disableUserMfa(userType: MfaUserType, userId: number): Promise<void> {
  await ensureMfaSchema()
  const row = await getUserMfa(userType, userId)
  if (!row) return
  await sql`
    UPDATE user_mfa
    SET enabled_at = NULL, updated_at = NOW()
    WHERE user_type = ${userType} AND user_id = ${userId}
  `
  await sql`DELETE FROM user_mfa_recovery_codes WHERE user_mfa_id = ${row.id}`
  await sql`
    DELETE FROM user_mfa_device_trust
    WHERE user_type = ${userType} AND user_id = ${userId}
  `
}

export async function storeRecoveryCodes(userMfaId: number, codes: string[]): Promise<void> {
  await ensureMfaSchema()
  await sql`DELETE FROM user_mfa_recovery_codes WHERE user_mfa_id = ${userMfaId}`
  for (const code of codes) {
    const codeHash = hashMfaToken(code.replace(/-/g, "").toLowerCase())
    await sql`
      INSERT INTO user_mfa_recovery_codes (user_mfa_id, code_hash)
      VALUES (${userMfaId}, ${codeHash})
    `
  }
}

export async function consumeRecoveryCode(userType: MfaUserType, userId: number, code: string): Promise<boolean> {
  const row = await getUserMfa(userType, userId)
  if (!row?.enabled_at) return false
  const normalized = code.replace(/-/g, "").toLowerCase()
  const codeHash = hashMfaToken(normalized)
  const matches = (await sql`
    SELECT id FROM user_mfa_recovery_codes
    WHERE user_mfa_id = ${row.id}
      AND code_hash = ${codeHash}
      AND used_at IS NULL
    LIMIT 1
  `) as { id: number }[]
  if (matches.length === 0) return false
  await sql`
    UPDATE user_mfa_recovery_codes SET used_at = NOW()
    WHERE id = ${matches[0].id}
  `
  return true
}

export async function countUnusedRecoveryCodes(userType: MfaUserType, userId: number): Promise<number> {
  const row = await getUserMfa(userType, userId)
  if (!row) return 0
  const rows = (await sql`
    SELECT COUNT(*)::int AS count
    FROM user_mfa_recovery_codes
    WHERE user_mfa_id = ${row.id} AND used_at IS NULL
  `) as { count: number }[]
  return Number(rows[0]?.count ?? 0)
}

export function generateRecoveryCodeSet(count = 8): string[] {
  return Array.from({ length: count }, () => generateRecoveryCode())
}
