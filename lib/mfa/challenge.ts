import { randomBytes } from "crypto"
import { sql } from "@/lib/db"
import type { AuthUserType } from "@/lib/auth-refresh-tokens"
import { ensureMfaSchema } from "@/lib/ensure-mfa-schema"
import { encryptMfaSecret } from "@/lib/mfa/encryption"
import { generateTotpSecret } from "@/lib/mfa/totp"
import { getDecryptedTotpSecret, hashMfaToken, isMfaEnabled } from "@/lib/mfa/store"

const CHALLENGE_TTL_MS = 10 * 60 * 1000

export type MfaChallengeRow = {
  id: number
  user_type: AuthUserType
  user_id: number
  requires_setup: boolean
  login_payload: Record<string, unknown>
  pending_secret_encrypted: string | null
  expires_at: Date | string
  consumed_at: Date | string | null
}

export async function createMfaLoginChallenge(params: {
  userType: AuthUserType
  userId: number
  loginPayload: Record<string, unknown>
}): Promise<{ challengeToken: string; requiresSetup: boolean }> {
  await ensureMfaSchema()
  let requiresSetup = !(await isMfaEnabled(params.userType, params.userId))

  if (!requiresSetup) {
    const secret = await getDecryptedTotpSecret(params.userType, params.userId)
    if (!secret) {
      console.error("[mfa] enabled but TOTP secret unreadable — verify-only challenge", {
        userType: params.userType,
        userId: params.userId,
      })
    }
  }
  const rawToken = randomBytes(32).toString("base64url")
  const tokenHash = hashMfaToken(rawToken)
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS)

  let pendingSecretEncrypted: string | null = null
  if (requiresSetup) {
    pendingSecretEncrypted = encryptMfaSecret(generateTotpSecret())
  }

  await sql`
    INSERT INTO auth_mfa_challenges (
      token_hash, user_type, user_id, requires_setup, login_payload,
      pending_secret_encrypted, expires_at
    ) VALUES (
      ${tokenHash},
      ${params.userType},
      ${params.userId},
      ${requiresSetup},
      ${JSON.stringify(params.loginPayload)}::jsonb,
      ${pendingSecretEncrypted},
      ${expiresAt.toISOString()}
    )
  `

  return { challengeToken: rawToken, requiresSetup }
}

/** Settings → Security enrollment (no login session required beyond knowing userType/userId). */
export async function createMfaSettingsEnrollmentChallenge(params: {
  userType: AuthUserType
  userId: number
  accountName?: string
  issuer?: string
}): Promise<{ challengeToken: string }> {
  if (await isMfaEnabled(params.userType, params.userId)) {
    throw new Error("MFA_ALREADY_ENABLED")
  }
  return createMfaLoginChallenge({
    userType: params.userType,
    userId: params.userId,
    loginPayload: {
      settingsEnrollment: true,
      mfaAccountName: params.accountName ?? `user-${params.userId}`,
      mfaIssuer: params.issuer ?? "CourseCollab",
    },
  }).then(({ challengeToken }) => ({ challengeToken }))
}

export async function loadMfaChallenge(challengeToken: string): Promise<MfaChallengeRow | null> {
  await ensureMfaSchema()
  const tokenHash = hashMfaToken(challengeToken)
  const rows = (await sql`
    SELECT id, user_type, user_id, requires_setup, login_payload,
           pending_secret_encrypted, expires_at, consumed_at
    FROM auth_mfa_challenges
    WHERE token_hash = ${tokenHash}
    LIMIT 1
  `) as MfaChallengeRow[]
  if (rows.length === 0) return null
  const row = rows[0]
  if (row.consumed_at) return null
  if (new Date(row.expires_at).getTime() < Date.now()) return null
  return row
}

export async function consumeMfaChallenge(challengeId: number): Promise<void> {
  await sql`
    UPDATE auth_mfa_challenges SET consumed_at = NOW() WHERE id = ${challengeId}
  `
}

export async function getPendingEnrollmentSecret(challenge: MfaChallengeRow): Promise<string | null> {
  if (!challenge.requires_setup || !challenge.pending_secret_encrypted) {
    return null
  }
  try {
    const { decryptMfaSecretWithKeyIndex } = await import("@/lib/mfa/encryption")
    return decryptMfaSecretWithKeyIndex(challenge.pending_secret_encrypted)?.plaintext ?? null
  } catch (err) {
    console.error("[mfa] Failed to decrypt pending enrollment secret:", err)
    return null
  }
}

/** True when token matched a challenge that was already consumed (duplicate verify). */
export async function wasMfaChallengeConsumed(challengeToken: string): Promise<boolean> {
  await ensureMfaSchema()
  const tokenHash = hashMfaToken(challengeToken)
  const rows = (await sql`
    SELECT id FROM auth_mfa_challenges
    WHERE token_hash = ${tokenHash}
      AND consumed_at IS NOT NULL
    LIMIT 1
  `) as { id: number }[]
  return rows.length > 0
}
