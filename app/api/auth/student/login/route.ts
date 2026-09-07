import "@/lib/console-override"
import { type NextRequest, NextResponse } from "next/server"
import {
  authenticateStudentAtUniversity,
  findStudentEnrollmentsAtUniversity,
  maskStudentName,
} from "@/lib/student-university-auth"
import { getUniversityById } from "@/lib/universities"
import { sessionDurationMs } from "@/lib/auth-refresh-tokens"
import { gateLoginWithMfa } from "@/lib/mfa/login-gate"
import {
  ACTIVITY_ACTIONS,
  logPlatformActivityFromRequest,
} from "@/lib/platform-activity-log"
import { logAuthError } from "@/lib/system-log"
import { getSQL } from "@/lib/db"
import bcrypt from "bcryptjs"
import { getStudentRosterDefaultPassword } from "@/lib/student-roster-default-password"
import { serializeStudentEnrollment } from "@/lib/student-active-enrollment-logic"
import {
  enrichStudentEnrollmentOptions,
  findEnrollmentsForStudentDbId,
  publicStudentEnrollments,
} from "@/lib/student-active-enrollment"

export const dynamic = "force-dynamic"

function clientIp(request: NextRequest): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  )
}

/** University-first student login — no course selection before authentication. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const universityId = Number(body.universityId)
    const identifier = String(body.identifier ?? body.studentId ?? "").trim()
    const password = String(body.password ?? "").trim()
    const rememberMe = Boolean(body.rememberMe)
    const courseId = body.courseId != null ? Number(body.courseId) : null
    const section = typeof body.section === "string" ? body.section : null

    if (!Number.isFinite(universityId)) {
      return NextResponse.json({ error: "Select your university to continue." }, { status: 400 })
    }

    const result = await authenticateStudentAtUniversity({
      universityId,
      identifier,
      password,
      courseId,
      section,
      rememberMe,
    })

    if (!result.ok) {
      if ("error" in result && result.status === 401) {
        await logPlatformActivityFromRequest(request, {
          portal: "student",
          actorType: "student",
          action: ACTIVITY_ACTIONS.LOGIN_FAILED,
          category: "auth",
          success: false,
          summary: `Failed student login for ID ${identifier}`,
          metadata: { identifier, universityId },
        })
        await logAuthError(request, {
          action: "student_login_failed",
          userId: identifier,
          userRole: "student",
          pageAttempted: "/auth/student",
          errorMessage: result.error,
          success: false,
        })
      }
      const { error, status, ...rest } = result
      return NextResponse.json({ error, ...rest }, { status })
    }

    if ("requiresCourseSelection" in result && result.requiresCourseSelection) {
      const enriched = await enrichStudentEnrollmentOptions(result.enrollments)
      return NextResponse.json({
        requiresCourseSelection: true,
        enrollments: publicStudentEnrollments(enriched),
        studentPreview: result.studentPreview,
      })
    }

    if (!("student" in result)) {
      return NextResponse.json({ error: "Login failed" }, { status: 500 })
    }

    const university = await getUniversityById(universityId)
    const student = result.student
    const enrollment = result.selectedEnrollment

    const studentDbId = Number(student.id)
    const enrichedEnrollments = await findEnrollmentsForStudentDbId(studentDbId)

    const loginPayload = {
      student,
      effectiveMembershipTier: result.effectiveMembershipTier,
      hasApprovedResetRequest: result.hasApprovedResetRequest,
      resetRequestId: result.resetRequestId,
      trialActivated: result.trialActivated,
      university,
      enrollment: serializeStudentEnrollment(
        enrichedEnrollments.find((row) => row.studentRowId === studentDbId) ??
          enrichedEnrollments.find(
            (row) =>
              row.courseId === enrollment.courseId &&
              row.section.trim() === enrollment.section.trim(),
          ) ??
          enrichedEnrollments[0]!,
      ),
      enrollments: publicStudentEnrollments(enrichedEnrollments),
      sessionExpiresIn: sessionDurationMs(rememberMe),
      rememberMe,
      mfaAccountName: String(student.email ?? student.student_id ?? student.full_name ?? ""),
      mfaIssuer: university?.short_name ? `CourseCollab (${university.short_name})` : "CourseCollab",
      _refreshMeta: {
        userType: "student" as const,
        userId: Number(student.id),
        universityId,
        rememberMe,
      },
    }

    const mfaResponse = await gateLoginWithMfa({
      userType: "student",
      userId: Number(student.id),
      loginPayload,
      request,
    })

    await logPlatformActivityFromRequest(request, {
      portal: "student",
      actorType: "student",
      actorId: Number(student.id),
      actorLabel: String(student.full_name ?? ""),
      actorEmail: student.email ? String(student.email) : null,
      action: ACTIVITY_ACTIONS.LOGIN_SUCCESS,
      category: "auth",
      courseId: enrollment.courseId,
      summary: `Student ${student.full_name} logged in`,
      metadata: {
        studentId: String(student.student_id),
        section: enrollment.section,
        courseId: enrollment.courseId,
        universityId,
      },
    })

    return mfaResponse
  } catch (error) {
    console.error("[auth/student/login]", error)
    return NextResponse.json({ error: "Failed to login" }, { status: 500 })
  }
}

/** Account activation — set password after roster ID lookup (no roster enumeration). */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const universityId = Number(body.universityId)
    const identifier = String(body.identifier ?? "").trim()
    const password = String(body.newPassword ?? body.password ?? "")
    const confirmPassword = String(body.confirmPassword ?? password)

    if (!Number.isFinite(universityId) || !identifier || !password) {
      return NextResponse.json({ error: "University, student ID, and password are required." }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 })
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 })
    }

    const enrollments = await findStudentEnrollmentsAtUniversity(universityId, identifier)
    if (enrollments.length === 0) {
      return NextResponse.json({
        message: "If your ID is on the roster, you can sign in with your new password.",
      })
    }

    const sql = getSQL()
    const studentRowId = enrollments[0].studentRowId
    const rows = (await sql`SELECT * FROM students WHERE id = ${studentRowId} LIMIT 1`) as Record<
      string,
      unknown
    >[]
    if (rows.length === 0) {
      return NextResponse.json({
        message: "If your ID is on the roster, you can sign in with your new password.",
      })
    }

    const row = rows[0] as Record<string, unknown>
    if (row.has_changed_password) {
      return NextResponse.json(
        {
          error: "Account already activated. Sign in with your password.",
          code: "already_activated",
          message:
            "Your instructor already enrolled you on CourseCollab. Use Sign in (not activation) with your Student ID or email and your password. First time signing in? Use the temporary password from your welcome email.",
        },
        { status: 409 },
      )
    }

    const defaultPassword = getStudentRosterDefaultPassword(enrollments[0].courseCode)
    const hash = await bcrypt.hash(password, 10)
    await sql`
      UPDATE students
      SET password_hash = ${hash}, has_changed_password = true, university_id = ${universityId}
      WHERE id = ${studentRowId}
    `

    return NextResponse.json({
      activated: true,
      maskedName: maskStudentName(String(row.full_name ?? "")),
      hint: defaultPassword ? undefined : "Sign in with your new password.",
    })
  } catch (error) {
    console.error("[auth/student/login PUT activate]", error)
    return NextResponse.json({ error: "Activation failed" }, { status: 500 })
  }
}
