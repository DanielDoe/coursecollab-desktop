import { sql, asSqlRows } from "@/lib/db"
import type { AuthUserType } from "@/lib/auth-refresh-tokens"
import { ensureMfaBypassColumns } from "@/lib/mfa/ensure-mfa-bypass-columns"

/**
 * App Store / beta review accounts may skip MFA so Apple reviewers can sign in
 * without an authenticator. Only rows with mfa_bypass=true qualify.
 */
export async function shouldBypassMfa(
  userType: AuthUserType,
  userId: number,
): Promise<boolean> {
  if (!Number.isFinite(userId) || userId < 1) return false
  if (userType !== "student" && userType !== "instructor") return false

  await ensureMfaBypassColumns()

  if (userType === "instructor") {
    const rows = asSqlRows<{ mfa_bypass: boolean }>(await sql`
      SELECT COALESCE(mfa_bypass, false) AS mfa_bypass
      FROM instructors
      WHERE id = ${userId}
      LIMIT 1
    `)
    return Boolean(rows[0]?.mfa_bypass)
  }

  const rows = asSqlRows<{ mfa_bypass: boolean }>(await sql`
    SELECT COALESCE(mfa_bypass, false) AS mfa_bypass
    FROM students
    WHERE id = ${userId}
    LIMIT 1
  `)
  return Boolean(rows[0]?.mfa_bypass)
}
