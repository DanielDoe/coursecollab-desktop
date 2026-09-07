import { randomBytes } from "crypto"
import type { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import type { AuthUserType } from "@/lib/auth-refresh-tokens"
import { ensureMfaSchema } from "@/lib/ensure-mfa-schema"
import { hashMfaToken } from "@/lib/mfa/store"

export const MFA_TRUST_COOKIE = "cc_mfa_trust"
/** Native clients (Expo) send the trust token here — RN fetch often drops custom Cookie headers. */
export const MFA_TRUST_HEADER = "x-cc-mfa-trust"
export const DEFAULT_MFA_TRUST_DAYS = 7
export const MIN_MFA_TRUST_DAYS = 1
export const MAX_MFA_TRUST_DAYS = 90

/** Read MFA device-trust token from cookie or native header. */
export function readMfaTrustTokenFromRequest(request: NextRequest): string | null {
  const fromCookie = request.cookies.get(MFA_TRUST_COOKIE)?.value?.trim()
  if (fromCookie) return fromCookie
  const fromHeader = request.headers.get(MFA_TRUST_HEADER)?.trim()
  return fromHeader || null
}

export function clampTrustDurationDays(days: number): number {
  if (!Number.isFinite(days)) return DEFAULT_MFA_TRUST_DAYS
  return Math.min(MAX_MFA_TRUST_DAYS, Math.max(MIN_MFA_TRUST_DAYS, Math.round(days)))
}

export async function getMfaTrustDurationDays(userType: AuthUserType, userId: number): Promise<number> {
  await ensureMfaSchema()
  const rows = (await sql`
    SELECT trust_duration_days FROM user_mfa
    WHERE user_type = ${userType} AND user_id = ${userId} AND enabled_at IS NOT NULL
    LIMIT 1
  `) as { trust_duration_days: number | null }[]
  if (!rows.length) return DEFAULT_MFA_TRUST_DAYS
  return clampTrustDurationDays(Number(rows[0].trust_duration_days ?? DEFAULT_MFA_TRUST_DAYS))
}

export async function setMfaTrustDurationDays(
  userType: AuthUserType,
  userId: number,
  days: number,
): Promise<number> {
  await ensureMfaSchema()
  const clamped = clampTrustDurationDays(days)
  await sql`
    UPDATE user_mfa
    SET trust_duration_days = ${clamped}, updated_at = NOW()
    WHERE user_type = ${userType} AND user_id = ${userId} AND enabled_at IS NOT NULL
  `
  return clamped
}

async function resolveUserIdFromMfaTrust(
  request: NextRequest,
  userType: AuthUserType,
): Promise<number | null> {
  const raw = readMfaTrustTokenFromRequest(request)
  if (!raw) return null
  const tokenHash = hashMfaToken(raw)
  await ensureMfaSchema()
  const rows = (await sql`
    SELECT user_type, user_id FROM user_mfa_device_trust
    WHERE token_hash = ${tokenHash}
      AND expires_at > NOW()
    LIMIT 1
  `) as { user_type: AuthUserType; user_id: number }[]
  if (!rows.length || rows[0].user_type !== userType) return null
  const userId = Number(rows[0].user_id)
  return Number.isFinite(userId) && userId > 0 ? userId : null
}

/** Resolve a student database id from a server-issued device-trust token. */
export async function resolveStudentIdFromMfaTrust(request: NextRequest): Promise<number | null> {
  return resolveUserIdFromMfaTrust(request, "student")
}

/** Resolve an instructor id from a server-issued device-trust token. */
export async function resolveInstructorIdFromMfaTrust(request: NextRequest): Promise<number | null> {
  return resolveUserIdFromMfaTrust(request, "instructor")
}

/** Resolve an admin id from a server-issued device-trust token. */
export async function resolveAdminIdFromMfaTrust(request: NextRequest): Promise<number | null> {
  return resolveUserIdFromMfaTrust(request, "admin")
}

export async function hasValidMfaTrust(
  request: NextRequest,
  userType: AuthUserType,
  userId: number,
): Promise<boolean> {
  const raw = readMfaTrustTokenFromRequest(request)
  if (!raw) return false
  const tokenHash = hashMfaToken(raw)
  await ensureMfaSchema()
  const rows = (await sql`
    SELECT id FROM user_mfa_device_trust
    WHERE token_hash = ${tokenHash}
      AND user_type = ${userType}
      AND user_id = ${userId}
      AND expires_at > NOW()
    LIMIT 1
  `) as { id: number }[]
  return rows.length > 0
}

export async function createMfaDeviceTrust(params: {
  userType: AuthUserType
  userId: number
  trustDays?: number
}): Promise<{ rawToken: string; expiresAt: Date }> {
  const days = clampTrustDurationDays(
    params.trustDays ?? (await getMfaTrustDurationDays(params.userType, params.userId)),
  )
  const rawToken = randomBytes(32).toString("base64url")
  const tokenHash = hashMfaToken(rawToken)
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)

  await ensureMfaSchema()
  await sql`
    INSERT INTO user_mfa_device_trust (user_type, user_id, token_hash, expires_at)
    VALUES (${params.userType}, ${params.userId}, ${tokenHash}, ${expiresAt.toISOString()})
  `

  return { rawToken, expiresAt }
}

export function setMfaTrustCookieOnResponse(
  response: NextResponse,
  rawToken: string,
  expiresAt: Date,
): void {
  response.cookies.set(MFA_TRUST_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  })
}

export async function issueMfaTrustCookie(
  response: NextResponse,
  params: { userType: AuthUserType; userId: number; trustDays?: number },
): Promise<{ rawToken: string; expiresAt: Date }> {
  const trust = await createMfaDeviceTrust(params)
  setMfaTrustCookieOnResponse(response, trust.rawToken, trust.expiresAt)
  return trust
}

export async function revokeMfaDeviceTrustFromRequest(
  request: NextRequest,
  userType: AuthUserType,
  userId: number,
): Promise<void> {
  const raw = readMfaTrustTokenFromRequest(request)
  if (!raw) return
  const tokenHash = hashMfaToken(raw)
  await ensureMfaSchema()
  await sql`
    DELETE FROM user_mfa_device_trust
    WHERE token_hash = ${tokenHash}
      AND user_type = ${userType}
      AND user_id = ${userId}
  `
}

export function clearMfaTrustCookie(response: NextResponse): void {
  response.cookies.set(MFA_TRUST_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
}
