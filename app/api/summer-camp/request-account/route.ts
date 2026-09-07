import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { createSummerCamperFromSignup } from "@/lib/summer-camp/camper-accounts"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { fullName, email, school, password, confirmPassword, programRole, campId, invitationToken } =
      await request.json()

    if (!fullName?.trim() || !email?.trim() || !school?.trim() || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    const emailNorm = String(email).trim().toLowerCase()
    if (!emailNorm.includes("@")) {
      return NextResponse.json({ error: "Enter a valid email" }, { status: 400 })
    }

    if (String(password).length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match" }, { status: 400 })
    }

    const existingStudent = await sql`
      SELECT id FROM students WHERE TRIM(LOWER(COALESCE(email, ''))) = ${emailNorm} LIMIT 1
    `
    if (existingStudent.length > 0) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in." },
        { status: 409 },
      )
    }

    const pending = await sql`
      SELECT id FROM account_requests
      WHERE request_kind IN ('summer_camper', 'summer_student') AND status = 'pending'
        AND TRIM(LOWER(email)) = ${emailNorm}
      LIMIT 1
    `
    if (pending.length > 0) {
      return NextResponse.json(
        { error: "You already have a pending request. Wait for admin approval." },
        { status: 400 },
      )
    }

    const result = await createSummerCamperFromSignup({
      fullName: String(fullName),
      email: emailNorm,
      school: String(school),
      password: String(password),
      programRole: programRole === "summer_student" ? "summer_student" : "summer_camper",
      campId: campId != null && Number.isFinite(Number(campId)) ? Number(campId) : null,
      invitationToken: invitationToken ? String(invitationToken) : null,
    })

    return NextResponse.json({
      success: true,
      autoApproved: result.autoApproved,
      requestId: result.requestId,
      message: result.autoApproved
        ? "Your account is approved. You can sign in now."
        : "Your request was submitted. Check your email to verify your address, then wait for program faculty or admin approval.",
      requiresEmailVerification: !result.autoApproved,
    })
  } catch (error) {
    console.error("[summer-camp/request-account]", error)
    return NextResponse.json({ error: "Failed to submit request" }, { status: 500 })
  }
}
