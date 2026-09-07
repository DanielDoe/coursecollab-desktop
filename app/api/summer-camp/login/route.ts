import { type NextRequest, NextResponse } from "next/server"
import { getSQL } from "@/lib/db"
import bcrypt from "bcryptjs"
import { ensureSummerProgramRole } from "@/lib/require-summer-camper"
import { isSummerProgramRole } from "@/lib/summer-camp/program-roles"
import { gateLoginWithMfa } from "@/lib/mfa/login-gate"
import {
  ACTIVITY_ACTIONS,
  logPlatformActivityFromRequest,
} from "@/lib/platform-activity-log"
import { resolveAccountAccessState } from "@/lib/access-governance/login-state"
import { isDeletedAccountRow } from "@/lib/compliance/account-deletion"

export const dynamic = "force-dynamic"

function lifecycleErrorMessage(lifecycle: string): string {
  switch (lifecycle) {
    case "pending_email_verification":
      return "Verify your email to continue"
    case "pending_approval":
      return "Your summer program access request is pending approval"
    case "rejected":
      return "Access request not approved"
    case "suspended":
      return "This account is suspended"
    case "deactivated":
      return "This account has been deactivated"
    default:
      return "Account not found. Create an account or wait for approval."
  }
}

/** Summer program login by email or camper ID + password */
export async function POST(request: NextRequest) {
  try {
    const { email, studentId, password } = await request.json()

    if (!password || (!email && !studentId)) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    const sql = getSQL()
    const emailInput = email ? String(email).trim().toLowerCase() : null
    const idInput = studentId ? String(studentId).trim() : null
    const loginId = emailInput ?? idInput ?? ""

    const rows = emailInput
      ? ((await sql`
          SELECT * FROM students
          WHERE TRIM(LOWER(COALESCE(email, ''))) = ${emailInput}
            AND deleted_at IS NULL
          ORDER BY id DESC
          LIMIT 1
        `) as Record<string, unknown>[])
      : ((await sql`
          SELECT * FROM students
          WHERE TRIM(student_id) = ${idInput}
            AND deleted_at IS NULL
          ORDER BY id DESC
          LIMIT 1
        `) as Record<string, unknown>[])

    if (rows.length === 0) {
      const access = await resolveAccountAccessState({
        portal: "summer",
        loginId,
        email: emailInput,
      })

      if (access.lifecycle !== "not_found" && access.lifecycle !== "active") {
        return NextResponse.json(
          {
            error: lifecycleErrorMessage(access.lifecycle),
            lifecycle: access.lifecycle,
            accountType: access.accountType ?? "summer_student",
            request: access.request,
            rejectionReason: access.rejectionReason,
          },
          { status: 403 },
        )
      }

      return NextResponse.json(
        {
          error: "Account not found. Create an account or wait for approval.",
          lifecycle: "not_found",
          requiresAccessRequest: true,
        },
        { status: 403 },
      )
    }

    const student = rows[0]

    if (isDeletedAccountRow(student)) {
      return NextResponse.json({ error: "This account has been deleted." }, { status: 403 })
    }

    const lifecycleStatus = String(student.account_lifecycle_status ?? "active")
    if (lifecycleStatus === "suspended") {
      return NextResponse.json({ error: "This account is suspended.", lifecycle: "suspended" }, { status: 403 })
    }

    const role = String(student.student_program_role ?? "")
    if (!isSummerProgramRole(role) && student.section !== "SUMMER_CAMP") {
      const access = await resolveAccountAccessState({
        portal: "summer",
        loginId,
        email: emailInput ?? String(student.email ?? ""),
      })

      if (access.lifecycle === "pending_email_verification" || access.lifecycle === "pending_approval") {
        return NextResponse.json(
          {
            error: lifecycleErrorMessage(access.lifecycle),
            lifecycle: access.lifecycle,
            accountType: access.accountType ?? "summer_student",
            request: access.request,
          },
          { status: 403 },
        )
      }

      if (access.lifecycle === "rejected") {
        return NextResponse.json(
          {
            error: lifecycleErrorMessage(access.lifecycle),
            lifecycle: "rejected",
            rejectionReason: access.rejectionReason,
          },
          { status: 403 },
        )
      }
    }

    const hash = String(student.password_hash ?? "")
    if (!hash) {
      return NextResponse.json({ error: "Account not activated. Contact your camp administrator." }, { status: 401 })
    }

    const internalId = Number(student.id)

    const valid = await bcrypt.compare(String(password), hash)
    if (!valid) {
      await logPlatformActivityFromRequest(request, {
        portal: "summer_camper",
        actorType: "student",
        actorId: internalId,
        actorLabel: String(student.full_name ?? ""),
        actorEmail: student.email ? String(student.email) : null,
        action: ACTIVITY_ACTIONS.LOGIN_FAILED,
        category: "auth",
        success: false,
        summary: "Failed summer camp login (invalid password)",
        metadata: { email: emailInput, studentId: idInput },
      })
      return NextResponse.json({ error: "Invalid password" }, { status: 401 })
    }

    const programRole = await ensureSummerProgramRole(internalId, "summer_student")

    await logPlatformActivityFromRequest(request, {
      portal: "summer_camper",
      actorType: "student",
      actorId: internalId,
      actorLabel: String(student.full_name ?? ""),
      actorEmail: student.email ? String(student.email) : null,
      action: ACTIVITY_ACTIONS.LOGIN_SUCCESS,
      category: "auth",
      summary: `Summer program student ${student.full_name ?? student.email} passed password check — MFA pending`,
      metadata: { email: emailInput, studentId: idInput, programRole, mfaPending: true },
    })

    return gateLoginWithMfa({
      userType: "student",
      userId: internalId,
      request,
      loginPayload: {
        student: {
          ...student,
          student_program_role: programRole,
        },
        mfaAccountName: String(student.email ?? student.student_id ?? student.full_name ?? ""),
        mfaIssuer: "CourseCollab Summer",
      },
    })
  } catch (error) {
    console.error("[summer-camp/login]", error)
    return NextResponse.json({ error: "Login failed" }, { status: 500 })
  }
}
