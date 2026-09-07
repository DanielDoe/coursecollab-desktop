import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { ensureFacultySignupColumns } from "@/lib/ensure-faculty-signup-columns"
import { ensureInstructorRoleColumns } from "@/lib/ensure-instructor-role-columns"
import { notifyAllAdmins } from "@/lib/create-admin-notification"
import { createAccessRequest } from "@/lib/access-governance/service"
import { ensureAccessGovernanceSchema } from "@/lib/access-governance/schema"

export const dynamic = "force-dynamic"

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/

export async function POST(request: NextRequest) {
  try {
    await ensureFacultySignupColumns()
    await ensureInstructorRoleColumns()
    await ensureAccessGovernanceSchema()

    const body = await request.json()
    const fullName = String(body.fullName ?? body.name ?? "").trim()
    const username = String(body.username ?? "").trim().toLowerCase()
    const email = String(body.email ?? "").trim().toLowerCase()
    const institution = String(body.institution ?? body.organization ?? "").trim()
    const jobTitle = String(body.jobTitle ?? body.job_title ?? "").trim()
    const password = String(body.password ?? "")
    const confirmPassword = String(body.confirmPassword ?? body.confirm_password ?? "")

    if (!fullName || fullName.length < 2) {
      return NextResponse.json({ error: "Enter your full name." }, { status: 400 })
    }
    if (!USERNAME_RE.test(username)) {
      return NextResponse.json(
        { error: "Username must be 3–32 characters (letters, numbers, . _ -)." },
        { status: 400 },
      )
    }
    if (!email.includes("@")) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })
    }
    if (!institution) {
      return NextResponse.json({ error: "Institution / university is required." }, { status: 400 })
    }
    if (!jobTitle) {
      return NextResponse.json({ error: "Job title is required (e.g. Assistant Professor)." }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 })
    }

    const existingInstructor = await sql`
      SELECT id FROM instructors
      WHERE LOWER(username) = ${username}
         OR LOWER(TRIM(email)) = ${email}
      LIMIT 1
    `
    if (existingInstructor.length > 0) {
      return NextResponse.json(
        { error: "An account with this username or email already exists. Try signing in." },
        { status: 409 },
      )
    }

    const pending = await sql`
      SELECT id FROM account_requests
      WHERE request_kind = 'faculty'
        AND status = 'pending'
        AND (
          LOWER(TRIM(student_id)) = ${username}
          OR LOWER(TRIM(email)) = ${email}
        )
      LIMIT 1
    `
    if (pending.length > 0) {
      return NextResponse.json(
        { error: "A faculty signup request is already pending for this username or email." },
        { status: 400 },
      )
    }

    await createAccessRequest({
      registrationPath: "faculty_signup",
      fullName,
      loginId: username,
      email,
      organization: institution,
      facultyJobTitle: jobTitle,
      facultyPassword: password,
    })

    try {
      await notifyAllAdmins({
        type: "account_request",
        title: "New faculty signup request",
        message: `${fullName} (${email}) requested faculty access as ${jobTitle} at ${institution}.`,
        link: "/admin/dashboard-v2/management/accounts",
      })
    } catch (e) {
      console.error("[faculty/signup] notify:", e)
    }

    return NextResponse.json({
      success: true,
      message:
        "Request submitted. Check your email for a verification link, then an administrator will review your account.",
    })
  } catch (e) {
    console.error("[faculty/signup]", e)
    return NextResponse.json({ error: "Failed to submit signup request." }, { status: 500 })
  }
}
