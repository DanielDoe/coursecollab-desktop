import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"
import { INSTITUTION_ADMIN_ROLES } from "@/lib/institutions/auth"
import { persistRefreshToken, setRefreshTokenCookie } from "@/lib/auth-refresh-tokens"
import { verifyFacultyPassword } from "@/lib/faculty-password"
import { verifyAdminPassword } from "@/lib/admin-password"
import { AUTH_RATE_LIMIT, checkRateLimit, rateLimitKey } from "@/lib/compliance/rate-limit"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const limited = checkRateLimit(rateLimitKey(request, "institution-login"), AUTH_RATE_LIMIT.limit, AUTH_RATE_LIMIT.windowMs)
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many sign-in attempts. Try again later." }, { status: 429 })
  }

  await ensureInstitutionSchema()
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const email = String(body.email ?? body.username ?? "").trim().toLowerCase()
  const password = String(body.password ?? "")
  const rememberMe = Boolean(body.rememberMe)
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
  }

  const adminAccounts = (await sql`
    SELECT id, password_hash FROM institution_admin_accounts WHERE LOWER(email) = ${email} LIMIT 1
  `) as { id: number; password_hash: string }[]
  if (adminAccounts[0]) {
    const account = adminAccounts[0]
    const ok = await verifyAdminPassword(password, account.password_hash)
    if (!ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    const members = await sql`
      SELECT m.id, m.institution_id, m.role, u.name AS institution_name
      FROM institution_members m
      JOIN universities u ON u.id = m.institution_id
      WHERE m.user_type = 'institution_admin'
        AND m.user_id = ${Number(account.id)}
        AND m.status = 'active'
        AND m.removed_at IS NULL
      LIMIT 1
    `
    const member = members[0]
    if (!member || !(INSTITUTION_ADMIN_ROLES as readonly string[]).includes(String(member.role))) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }
    const { rawToken, expiresAt } = await persistRefreshToken({
      userType: "institution_admin",
      userId: Number(account.id),
      universityId: Number(member.institution_id),
      rememberMe,
    })
    const response = NextResponse.json({
      success: true,
      institution: {
        id: Number(member.institution_id),
        name: String(member.institution_name),
        role: String(member.role),
        memberId: Number(member.id),
      },
    })
    setRefreshTokenCookie(response, rawToken, expiresAt)
    return response
  }

  const members = await sql`
    SELECT m.id, m.institution_id, m.user_type, m.user_id, m.role, m.status, m.email, u.name AS institution_name
    FROM institution_members m
    JOIN universities u ON u.id = m.institution_id
    WHERE LOWER(m.email) = ${email}
      AND m.status = 'active'
      AND m.removed_at IS NULL
    LIMIT 1
  `
  const member = members[0]
  if (!member || !(INSTITUTION_ADMIN_ROLES as readonly string[]).includes(String(member.role))) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const userType = String(member.user_type)
  const userId = Number(member.user_id)
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ error: "Invitation pending. Create a CourseCollab account first." }, { status: 403 })
  }

  let ok = false
  let universityId: number | null = Number(member.institution_id)
  if (userType === "instructor") {
    const rows = await sql`SELECT password FROM instructors WHERE id = ${userId} LIMIT 1`
    ok = rows[0] ? await verifyFacultyPassword(password, String(rows[0].password ?? "")) : false
  } else if (userType === "admin") {
    const rows = await sql`SELECT password_hash FROM admin_users WHERE id = ${userId} LIMIT 1`
    ok = rows[0] ? await verifyAdminPassword(password, String(rows[0].password_hash ?? "")) : false
  }

  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  const { rawToken, expiresAt } = await persistRefreshToken({
    userType: userType === "admin" ? "admin" : userType === "student" ? "student" : "instructor",
    userId,
    universityId,
    rememberMe,
  })

  const response = NextResponse.json({
    success: true,
    institution: {
      id: Number(member.institution_id),
      name: String(member.institution_name),
      role: String(member.role),
      memberId: Number(member.id),
    },
  })
  setRefreshTokenCookie(response, rawToken, expiresAt)
  return response
}
