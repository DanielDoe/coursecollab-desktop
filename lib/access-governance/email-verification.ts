import { createHash, randomBytes } from "node:crypto"
import { sql } from "@/lib/db"
import { sendEmail } from "@/lib/email/sendEmail"
import { ensureAccessGovernanceSchema } from "@/lib/access-governance/schema"

const TOKEN_TTL_MS = 48 * 60 * 60 * 1000

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

function verifyBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || "https://course-collab.com").replace(/\/$/, "")
}

export async function ensureEmailVerificationSchema(): Promise<void> {
  await ensureAccessGovernanceSchema()
  await sql`
    CREATE TABLE IF NOT EXISTS access_email_verifications (
      id SERIAL PRIMARY KEY,
      account_request_id INTEGER NOT NULL REFERENCES account_requests(id) ON DELETE CASCADE,
      email VARCHAR(255) NOT NULL,
      token_hash VARCHAR(128) NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_access_email_verifications_request ON access_email_verifications(account_request_id)`
}

export async function sendAccessRequestVerificationEmail(input: {
  requestId: number
  email: string
  fullName: string
  portal?: "student" | "faculty" | "guest"
}): Promise<void> {
  await ensureEmailVerificationSchema()
  const email = input.email.trim().toLowerCase()
  if (!email.includes("@")) return

  const token = randomBytes(32).toString("base64url")
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)

  await sql`
    UPDATE access_email_verifications
    SET verified_at = NOW()
    WHERE account_request_id = ${input.requestId} AND verified_at IS NULL
  `

  await sql`
    INSERT INTO access_email_verifications (account_request_id, email, token_hash, expires_at)
    VALUES (${input.requestId}, ${email}, ${tokenHash}, ${expiresAt})
  `

  const portal = input.portal ?? "student"
  const link = `${verifyBaseUrl()}/auth/verify-access-email?token=${encodeURIComponent(token)}&portal=${portal}`
  const first = input.fullName.trim().split(/\s+/)[0] || "there"

  await sendEmail("account_verification", email, {
    name: first,
    link,
  })
}

export async function verifyAccessRequestEmail(token: string): Promise<{
  ok: true
  requestId: number
  email: string
} | { ok: false; reason: string }> {
  await ensureEmailVerificationSchema()
  const trimmed = token.trim()
  if (!trimmed) return { ok: false, reason: "Missing verification token." }

  const tokenHash = hashToken(trimmed)
  const [row] = (await sql`
    SELECT v.id, v.account_request_id, v.email, v.expires_at, v.verified_at
    FROM access_email_verifications v
    WHERE v.token_hash = ${tokenHash}
    LIMIT 1
  `) as Array<{
    id: number
    account_request_id: number
    email: string
    expires_at: string
    verified_at: string | null
  }>

  if (!row) return { ok: false, reason: "Invalid or expired verification link." }
  if (row.verified_at) {
    return { ok: true, requestId: row.account_request_id, email: row.email }
  }
  if (new Date(row.expires_at) < new Date()) {
    return { ok: false, reason: "Verification link has expired." }
  }

  await sql`
    UPDATE access_email_verifications
    SET verified_at = NOW()
    WHERE id = ${row.id}
  `
  await sql`
    UPDATE account_requests
    SET email_verified_at = NOW()
    WHERE id = ${row.account_request_id}
  `

  try {
    await maybeAutoApproveVerifiedRequest(row.account_request_id)
  } catch (e) {
    console.warn("[access-governance] auto-approve after verify failed:", e)
  }

  return { ok: true, requestId: row.account_request_id, email: row.email }
}

export async function resendAccessRequestVerificationEmail(input: {
  requestId: number
  email: string
  fullName: string
}): Promise<void> {
  await sendAccessRequestVerificationEmail(input)
}

async function maybeAutoApproveVerifiedRequest(requestId: number): Promise<void> {
  const [row] = (await sql`
    SELECT id, metadata, status, request_kind, account_type
    FROM account_requests
    WHERE id = ${requestId}
    LIMIT 1
  `) as Array<{ id: number; metadata: Record<string, unknown> | null; status: string }>

  if (!row || row.status !== "pending") return
  if (!row.metadata || row.metadata.autoApproveOnVerify !== true) return

  const { approveAccessRequest } = await import("@/lib/access-governance/service")
  await approveAccessRequest({
    requestId: row.id,
    reviewer: { role: "admin", adminId: "system" },
    approvalSource: "invitation",
  })
}
