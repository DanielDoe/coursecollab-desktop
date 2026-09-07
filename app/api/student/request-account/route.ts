import { type NextRequest, NextResponse } from "next/server"
import { getSQL } from "@/lib/db"
import { notifyAllAdmins } from "@/lib/create-admin-notification"
import { findStudentsByLoginIdentifier } from "@/lib/student-login-lookup"
import { createAccessRequest } from "@/lib/access-governance/service"
import { ensureAccessGovernanceSchema } from "@/lib/access-governance/schema"
import { resolveStudentScopeFromSection } from "@/lib/access-governance/scope"

export async function POST(request: NextRequest) {
  try {
    await ensureAccessGovernanceSchema()
    const { fullName, studentId, section, email, invitationToken, universityId, courseId } =
      await request.json()

    if (!fullName || !studentId || !section || !email) {
      return NextResponse.json(
        { error: "All fields are required (Full Name, Student ID, Section, Email)" },
        { status: 400 },
      )
    }

    const parsedUniversityId =
      universityId != null && Number.isFinite(Number(universityId)) ? Math.trunc(Number(universityId)) : null
    const parsedCourseId =
      courseId != null && Number.isFinite(Number(courseId)) ? Math.trunc(Number(courseId)) : null

    if (!invitationToken) {
      if (!parsedUniversityId) {
        return NextResponse.json(
          { error: "Select your university and course before submitting an access request." },
          { status: 400 },
        )
      }
      if (!parsedCourseId) {
        return NextResponse.json({ error: "Select your course before submitting." }, { status: 400 })
      }
    }

    const sql = getSQL()
    const idInput = String(studentId).trim()

    const existingByLoginId = await findStudentsByLoginIdentifier(sql, idInput)
    const existingByEmail = await sql`
      SELECT id FROM students
      WHERE TRIM(LOWER(COALESCE(email, ''))) = TRIM(LOWER(${email}))
      LIMIT 1
    `

    if (existingByLoginId.length > 0 || existingByEmail.length > 0) {
      return NextResponse.json(
        {
          error:
            "An account with this Student ID or email already exists. Your instructor may have enrolled you — go to Sign in and use the temporary password from your welcome email.",
          code: "account_exists",
        },
        { status: 400 },
      )
    }

    const existingRequest = await sql`
      SELECT id, status FROM account_requests
      WHERE (TRIM(student_id::text) = ${idInput} OR TRIM(LOWER(email)) = TRIM(LOWER(${email})))
        AND status = 'pending'
    `

    if (existingRequest.length > 0) {
      return NextResponse.json(
        { error: "You already have a pending account request. Please wait for instructor/admin approval." },
        { status: 400 },
      )
    }

    const rejectedRequest = await sql`
      SELECT id, rejection_reason FROM account_requests
      WHERE (TRIM(student_id::text) = ${idInput} OR TRIM(LOWER(email)) = TRIM(LOWER(${email})))
        AND status = 'rejected'
      ORDER BY created_at DESC
      LIMIT 1
    `

    if (rejectedRequest.length > 0) {
      return NextResponse.json(
        {
          error:
            "Your previous account request was rejected. Please contact your instructor/admin for assistance.",
          rejectionReason: rejectedRequest[0].rejection_reason,
        },
        { status: 400 },
      )
    }

    if (!invitationToken) {
      const scope = await resolveStudentScopeFromSection(String(section), parsedUniversityId, parsedCourseId)
      if (!scope) {
        return NextResponse.json(
          {
            error:
              "That section is not available for the selected university and course. Go back and choose again.",
          },
          { status: 400 },
        )
      }
    }

    const result = await createAccessRequest({
      registrationPath: invitationToken ? "invitation" : "student_roster",
      fullName: String(fullName),
      loginId: idInput,
      email: String(email),
      section: String(section),
      universityId: parsedUniversityId,
      invitationToken: invitationToken ? String(invitationToken) : null,
      metadata:
        !invitationToken && parsedCourseId
          ? { selfEnrollmentCourseId: parsedCourseId, registrationSource: "student_self_signup" }
          : undefined,
    })

    try {
      await notifyAllAdmins({
        type: "account_request",
        title: "New Account Request",
        message: `${fullName} (${idInput}) has requested to join CourseCollab for section ${section}. Please review and approve/reject the request.`,
        link: `/instructor/students?tab=account-requests`,
      })
    } catch (notificationError) {
      console.error("[v0] Failed to send notification:", notificationError)
    }

    return NextResponse.json({
      success: true,
      requestId: result.requestId,
      message:
        "Your account request was submitted. Check your email to verify your address, then wait for instructor or admin approval.",
      requiresEmailVerification: true,
    })
  } catch (error) {
    console.error("[v0] Account request error:", error)
    const message = error instanceof Error ? error.message : "Failed to submit account request"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
