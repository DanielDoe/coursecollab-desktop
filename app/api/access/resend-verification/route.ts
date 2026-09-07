import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { resendAccessRequestVerificationEmail } from "@/lib/access-governance/email-verification"
import { AUTH_RATE_LIMIT, checkRateLimit, rateLimitKey } from "@/lib/compliance/rate-limit"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const limited = checkRateLimit(
      rateLimitKey(request, "access-resend-verification"),
      AUTH_RATE_LIMIT.limit,
      AUTH_RATE_LIMIT.windowMs,
    )
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
      )
    }

    const { email, loginId } = await request.json()
    const emailNorm = String(email ?? loginId ?? "")
      .trim()
      .toLowerCase()
    if (!emailNorm.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 })
    }

    const [pending] = (await sql`
      SELECT id, full_name, email, email_verified_at, status
      FROM account_requests
      WHERE status = 'pending'
        AND TRIM(LOWER(email)) = ${emailNorm}
      ORDER BY created_at DESC
      LIMIT 1
    `) as Array<{ id: number; full_name: string; email: string; email_verified_at: string | null; status: string }>

    if (!pending) {
      return NextResponse.json({ success: true, message: "If a pending request exists, a verification email was sent." })
    }

    if (pending.email_verified_at) {
      return NextResponse.json({ success: true, message: "Email is already verified." })
    }

    await resendAccessRequestVerificationEmail({
      requestId: pending.id,
      email: pending.email,
      fullName: pending.full_name,
    })

    return NextResponse.json({ success: true, message: "Verification email sent." })
  } catch (e) {
    console.error("[access/resend-verification]", e)
    return NextResponse.json({ error: "Could not resend verification email" }, { status: 500 })
  }
}
