import { createHash, randomBytes } from "crypto"
import type { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export type AuthUserType = "student" | "instructor" | "admin" | "institution_admin"

const REFRESH_COOKIE = "cc_refresh"
/** Native clients send this when RN fetch drops the Cookie header. */
export const REFRESH_TOKEN_HEADER = "x-cc-refresh"
const REMEMBER_ME_DAYS = 30
const SESSION_DAYS = 7

export function hashRefreshToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex")
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString("base64url")
}

export function refreshTokenExpiry(rememberMe: boolean): Date {
  const days = rememberMe ? REMEMBER_ME_DAYS : SESSION_DAYS
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

export function sessionDurationMs(rememberMe: boolean): number {
  const days = rememberMe ? REMEMBER_ME_DAYS : SESSION_DAYS
  return days * 24 * 60 * 60 * 1000
}

let schemaReady: Promise<void> | null = null

export async function ensureAuthRefreshTokenSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
          id SERIAL PRIMARY KEY,
          token_hash VARCHAR(128) NOT NULL UNIQUE,
          user_type VARCHAR(32) NOT NULL,
          user_id INTEGER NOT NULL,
          university_id INTEGER,
          remember_me BOOLEAN NOT NULL DEFAULT false,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          revoked_at TIMESTAMPTZ,
          user_agent VARCHAR(512),
          ip_address VARCHAR(64)
        )
      `
      await sql`
        CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user
        ON auth_refresh_tokens (user_type, user_id)
      `
      await sql`
        CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_expires
        ON auth_refresh_tokens (expires_at)
        WHERE revoked_at IS NULL
      `
    })().catch((err) => {
      schemaReady = null
      throw err
    })
  }
  return schemaReady
}

export async function persistRefreshToken(params: {
  userType: AuthUserType
  userId: number
  universityId?: number | null
  rememberMe: boolean
  userAgent?: string | null
  ipAddress?: string | null
}): Promise<{ rawToken: string; expiresAt: Date }> {
  await ensureAuthRefreshTokenSchema()
  const rawToken = generateRefreshToken()
  const tokenHash = hashRefreshToken(rawToken)
  const expiresAt = refreshTokenExpiry(params.rememberMe)

  await sql`
    INSERT INTO auth_refresh_tokens (
      token_hash, user_type, user_id, university_id, remember_me, expires_at, user_agent, ip_address
    ) VALUES (
      ${tokenHash},
      ${params.userType},
      ${params.userId},
      ${params.universityId ?? null},
      ${params.rememberMe},
      ${expiresAt.toISOString()},
      ${params.userAgent ?? null},
      ${params.ipAddress ?? null}
    )
  `

  return { rawToken, expiresAt }
}

/**
 * Issue a replacement token first, then revoke the old one.
 * Revoking first used to drop users when the insert failed.
 */
export async function rotateRefreshToken(params: {
  previousRawToken: string
  userType: AuthUserType
  userId: number
  universityId?: number | null
  rememberMe: boolean
  userAgent?: string | null
  ipAddress?: string | null
}): Promise<{ rawToken: string; expiresAt: Date }> {
  const next = await persistRefreshToken(params)
  await revokeRefreshToken(params.previousRawToken)
  return next
}

export async function revokeAllRefreshTokensForUser(
  userType: AuthUserType,
  userId: number,
): Promise<void> {
  if (!Number.isFinite(userId) || userId <= 0) return
  try {
    await sql`
      UPDATE auth_refresh_tokens
      SET revoked_at = NOW()
      WHERE user_type = ${userType}
        AND user_id = ${userId}
        AND revoked_at IS NULL
    `
  } catch {
    /* table may be missing in older environments */
  }
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(rawToken)
  try {
    await sql`
      UPDATE auth_refresh_tokens
      SET revoked_at = NOW()
      WHERE token_hash = ${tokenHash} AND revoked_at IS NULL
    `
  } catch {
    /* non-blocking */
  }
}

async function slideRefreshTokenIfNeeded(
  tokenHash: string,
  rememberMe: boolean,
  expiresAt: Date,
): Promise<void> {
  const remainingMs = expiresAt.getTime() - Date.now()
  const fullMs = sessionDurationMs(rememberMe)
  // Active use should keep a valid session alive (half-window remaining).
  if (remainingMs > fullMs / 2) return
  const nextExpiry = refreshTokenExpiry(rememberMe)
  try {
    await sql`
      UPDATE auth_refresh_tokens
      SET expires_at = ${nextExpiry.toISOString()}
      WHERE token_hash = ${tokenHash}
        AND revoked_at IS NULL
    `
  } catch {
    /* non-blocking — request can still proceed with the current token */
  }
}

export async function validateRefreshToken(rawToken: string): Promise<{
  userType: AuthUserType
  userId: number
  universityId: number | null
  rememberMe: boolean
} | null> {
  const tokenHash = hashRefreshToken(rawToken)
  try {
    await ensureAuthRefreshTokenSchema()
    const rows = (await sql`
      SELECT user_type, user_id, university_id, remember_me, expires_at, revoked_at
      FROM auth_refresh_tokens
      WHERE token_hash = ${tokenHash}
      LIMIT 1
    `) as Array<{
      user_type: AuthUserType
      user_id: number
      university_id: number | null
      remember_me: boolean
      expires_at: string | Date
      revoked_at: string | Date | null
    }>
    if (rows.length === 0) return null
    const row = rows[0]
    if (row.revoked_at) return null
    const expiresAt = new Date(row.expires_at)
    if (expiresAt.getTime() <= Date.now()) return null
    const rememberMe = Boolean(row.remember_me)
    void slideRefreshTokenIfNeeded(tokenHash, rememberMe, expiresAt)
    return {
      userType: row.user_type,
      userId: Number(row.user_id),
      universityId: row.university_id != null ? Number(row.university_id) : null,
      rememberMe,
    }
  } catch {
    return null
  }
}

export function setRefreshTokenCookie(response: NextResponse, rawToken: string, expiresAt: Date): void {
  response.cookies.set(REFRESH_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  })
}

export function clearRefreshTokenCookie(response: NextResponse): void {
  response.cookies.set(REFRESH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
}

export function readRefreshTokenFromRequest(request: NextRequest): string | null {
  const fromCookie = request.cookies.get(REFRESH_COOKIE)?.value?.trim()
  if (fromCookie) return fromCookie
  const fromHeader = request.headers.get(REFRESH_TOKEN_HEADER)?.trim()
  return fromHeader || null
}

export { REFRESH_COOKIE, REMEMBER_ME_DAYS, SESSION_DAYS }
