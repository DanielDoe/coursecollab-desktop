import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { notifyAllAdmins } from "@/lib/create-admin-notification"
import { passwordResetAcceptedResponse } from "@/lib/compliance/password-reset-public"
import { checkRateLimit, PASSWORD_RESET_RATE_LIMIT, rateLimitKey } from "@/lib/compliance/rate-limit"

export const dynamic = "force-dynamic"

function normalizePersonName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ")
}

export async function POST(request: NextRequest) {
  try {
    const { email, fullName } = await request.json()
    const em = String(email ?? "").trim().toLowerCase()
    const name = String(fullName ?? "").trim()

    const limited = checkRateLimit(
      rateLimitKey(request, "guest-password-reset"),
      PASSWORD_RESET_RATE_LIMIT.limit,
      PASSWORD_RESET_RATE_LIMIT.windowMs,
    )
    if (!limited.ok) {
      return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 })
    }

    if (!em.includes("@")) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 })
    }
    if (name.length < 2) {
      return NextResponse.json({ error: "Enter your full name as on your Career Member account" }, { status: 400 })
    }

    const matches = await sql`
      SELECT id, full_name, student_id, email
      FROM students
      WHERE is_platform_guest = true
        AND TRIM(LOWER(COALESCE(email, ''))) = ${em}
      LIMIT 2
    `

    if (matches.length !== 1) {
      return NextResponse.json(passwordResetAcceptedResponse())
    }

    const student = matches[0] as { id: number; full_name: string; student_id: string; email: string | null }
    if (normalizePersonName(student.full_name) !== normalizePersonName(name)) {
      return NextResponse.json(passwordResetAcceptedResponse())
    }

    const existingRequests = await sql`
      SELECT id FROM password_reset_requests
      WHERE student_id = ${student.id} AND status = 'pending'
    `

    if (existingRequests.length > 0) {
      return NextResponse.json(passwordResetAcceptedResponse())
    }

    await sql`
      INSERT INTO password_reset_requests (student_id, status, email)
      VALUES (${student.id}, 'pending', ${em})
      RETURNING id
    `

    try {
      await notifyAllAdmins({
        type: "password_reset_request",
        title: "Career Member password reset request",
        message: `${student.full_name} (Career Member, ${student.student_id}) requested a password reset. Approve from Password resets to email a temporary password.`,
        link: `/admin/students?tab=password-resets`,
      })
    } catch (e) {
      console.error("[guest/request-password-reset] notify:", e)
    }

    return NextResponse.json(passwordResetAcceptedResponse())
  } catch (e) {
    console.error("[guest/request-password-reset]", e)
    return NextResponse.json({ error: "Failed to submit request" }, { status: 500 })
  }
}
