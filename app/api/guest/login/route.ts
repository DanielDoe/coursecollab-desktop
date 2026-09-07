import { type NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { sql } from "@/lib/db"
import { gateLoginWithMfa } from "@/lib/mfa/login-gate"
import { normalizeGuestOnboardingPurpose } from "@/lib/guest/onboarding"
import { ensureGuestFreeEntitlement, ensureGuestProfile } from "@/lib/guest/entitlements"
import { isDeletedAccountRow } from "@/lib/compliance/account-deletion"
import { AUTH_RATE_LIMIT, checkRateLimit, rateLimitKey } from "@/lib/compliance/rate-limit"
import { resolveAccountAccessState } from "@/lib/access-governance/login-state"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const limited = checkRateLimit(
      rateLimitKey(request, "guest-login"),
      AUTH_RATE_LIMIT.limit,
      AUTH_RATE_LIMIT.windowMs,
    )
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Too many sign-in attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
      )
    }
    const body = await request.json()
    const email = String(body.email ?? "").trim().toLowerCase()
    const password = String(body.password ?? "")

    if (!email.includes("@") || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 })
    }

    const rows = await sql`
      SELECT *
      FROM students
      WHERE is_platform_guest = true
        AND TRIM(LOWER(COALESCE(email, ''))) = ${email}
      LIMIT 2
    `
    if (rows.length === 0) {
      const access = await resolveAccountAccessState({
        portal: "guest",
        loginId: email,
        email,
      })
      if (access.lifecycle === "pending_email_verification" || access.lifecycle === "pending_approval") {
        return NextResponse.json(
          {
            error:
              access.lifecycle === "pending_email_verification"
                ? "Verify your email to continue"
                : "Access request pending",
            lifecycle: access.lifecycle,
            accountType: access.accountType ?? "career_member",
            request: access.request,
          },
          { status: 403 },
        )
      }
      if (access.lifecycle === "rejected") {
        return NextResponse.json(
          {
            error: "Access request not approved",
            lifecycle: "rejected",
            rejectionReason: access.rejectionReason,
          },
          { status: 403 },
        )
      }
      return NextResponse.json({ error: "No Career Member account found for this email." }, { status: 401 })
    }
    if (rows.length > 1) {
      return NextResponse.json({ error: "Multiple Career Member accounts match. Contact support." }, { status: 500 })
    }

    const row = rows[0] as Record<string, unknown>
    if (isDeletedAccountRow(row)) {
      return NextResponse.json({ error: "This account has been deleted." }, { status: 403 })
    }
    const ok = await bcrypt.compare(password, String(row.password_hash ?? ""))
    if (!ok) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 })
    }

    // Never send credential material to the client.
    const { password_hash: _passwordHash, ...safeStudent } = row

    const guestAccessPurpose = normalizeGuestOnboardingPurpose(row.guest_access_purpose)
    await ensureGuestFreeEntitlement(Number(row.id))
    await ensureGuestProfile(Number(row.id))

    return gateLoginWithMfa({
      userType: "student",
      userId: Number(row.id),
      request,
      loginPayload: {
        student: safeStudent,
        guestAccessPurpose,
        hasApprovedResetRequest: false,
        resetRequestId: null,
        trialActivated: false,
        mfaAccountName: email,
        mfaIssuer: "CourseCollab Career Member",
        // Rotate the refresh cookie to this guest — otherwise a previous student's
        // refresh cookie survives and session-restore resurrects the wrong account.
        _refreshMeta: {
          userType: "student" as const,
          userId: Number(row.id),
          universityId: row.university_id != null ? Number(row.university_id) : null,
          rememberMe: Boolean(body.rememberMe),
        },
      },
    })
  } catch (e) {
    console.error("[guest/login]", e)
    return NextResponse.json({ error: "Login failed" }, { status: 500 })
  }
}
