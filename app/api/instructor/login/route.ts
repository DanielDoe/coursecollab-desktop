import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sessionDurationMs } from "@/lib/auth-refresh-tokens"
import { ensureInstructorRoleColumns } from "@/lib/ensure-instructor-role-columns"
import { ensureTaPermissionColumns } from "@/lib/ensure-ta-permissions-columns"
import { ensurePortalRbacSchema } from "@/lib/ensure-portal-rbac-schema"
import { normalizeCourseStaffRole } from "@/lib/roles"
import { gateLoginWithMfa } from "@/lib/mfa/login-gate"
import {
  ACTIVITY_ACTIONS,
  logPlatformActivityFromRequest,
} from "@/lib/platform-activity-log"
import { ensureAccountDeletionSchema, isDeletedAccountRow } from "@/lib/compliance/account-deletion"
import { AUTH_RATE_LIMIT, checkRateLimit, rateLimitKey } from "@/lib/compliance/rate-limit"
import {
  courseRowMatchesUniversity,
  facultyEmailMatchesUniversity,
  parseUniversityIdFromRequest,
} from "@/lib/instructor-university-scope"
import {
  instructorTeachesAtUniversity,
  resolveFacultyInstructorForLogin,
} from "@/lib/faculty-login-resolve"
import { resolveAccountAccessState } from "@/lib/access-governance/login-state"
import {
  ensureFacultyPasswordColumn,
  facultyPasswordNeedsRehash,
  hashFacultyPassword,
  resolveFacultyPasswordGate,
  verifyFacultyPassword,
} from "@/lib/faculty-password"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const limited = checkRateLimit(
      rateLimitKey(request, "instructor-login"),
      AUTH_RATE_LIMIT.limit,
      AUTH_RATE_LIMIT.windowMs,
    )
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Too many sign-in attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
      )
    }
    const { username, password, rememberMe: rememberMeRaw, universityId: universityIdRaw } =
      await request.json()
    const loginId = String(username ?? "").trim()
    const loginPassword = String(password ?? "")
    const rememberMe = Boolean(rememberMeRaw)
    const loginUniversityId =
      universityIdRaw != null && Number.isFinite(Number(universityIdRaw))
        ? Math.trunc(Number(universityIdRaw))
        : parseUniversityIdFromRequest(request)

    if (!loginId || !loginPassword) {
      return NextResponse.json({ error: "Username and password required" }, { status: 400 })
    }

    await ensureInstructorRoleColumns()
    await ensureTaPermissionColumns()
    await ensureAccountDeletionSchema()
    await ensureFacultyPasswordColumn()

    const row = await resolveFacultyInstructorForLogin(loginId, loginUniversityId)

    if (!row) {
      const access = await resolveAccountAccessState({
        portal: "faculty",
        loginId,
        email: loginId.includes("@") ? loginId : null,
      })
      if (access.lifecycle === "pending_approval") {
        return NextResponse.json(
          {
            error: "Your faculty account request is pending administrator approval.",
            lifecycle: "pending_approval",
            accountType: "faculty",
            request: access.request,
          },
          { status: 403 },
        )
      }
      if (access.lifecycle === "rejected") {
        return NextResponse.json(
          {
            error: "Your faculty account request was not approved.",
            lifecycle: "rejected",
            rejectionReason: access.rejectionReason,
          },
          { status: 403 },
        )
      }
      await logPlatformActivityFromRequest(request, {
        portal: "faculty",
        actorType: "instructor",
        action: ACTIVITY_ACTIONS.LOGIN_FAILED,
        category: "auth",
        success: false,
        summary: `Failed faculty login for username "${loginId}"`,
        metadata: { username: loginId },
      })
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const passwordOk = await verifyFacultyPassword(loginPassword, row.password)
    if (!passwordOk) {
      await logPlatformActivityFromRequest(request, {
        portal: "faculty",
        actorType: "instructor",
        action: ACTIVITY_ACTIONS.LOGIN_FAILED,
        category: "auth",
        success: false,
        summary: `Failed faculty login for username "${loginId}"`,
        metadata: { username: loginId },
      })
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    if (facultyPasswordNeedsRehash(row.password)) {
      const nextHash = await hashFacultyPassword(loginPassword)
      await sql`UPDATE instructors SET password = ${nextHash} WHERE id = ${row.id}`
      row.password = nextHash
    }

    if (!row.is_active || isDeletedAccountRow(row as Record<string, unknown>)) {
      return NextResponse.json({ error: "Account is deactivated" }, { status: 403 })
    }

    if (loginUniversityId != null) {
      const campusOk =
        row.university_id == null ||
        Number(row.university_id) === loginUniversityId ||
        (await instructorTeachesAtUniversity(row.id, loginUniversityId))

      if (!campusOk) {
        return NextResponse.json(
          {
            error:
              "This account is not registered for the selected university. Choose the correct school on the sign-in page.",
          },
          { status: 403 },
        )
      }
    } else if (!facultyEmailMatchesUniversity(row.email, loginUniversityId)) {
      return NextResponse.json(
        {
          error:
            "Select your university before signing in so we can show the correct courses and data.",
        },
        { status: 400 },
      )
    }

    if (row.role === "ta" && !row.assigned_instructor_id) {
      return NextResponse.json(
        { error: "TA account is not assigned to an instructor. Contact your administrator." },
        { status: 403 },
      )
    }

    await ensurePortalRbacSchema()

    const { ensurePortalRbacSeed } = await import("@/lib/ensure-portal-rbac-seed")
    const { provisionFacultyTeachingAccess } = await import("@/lib/provision-faculty-course-access")
    await ensurePortalRbacSeed()
    if (row.role !== "ta") {
      await provisionFacultyTeachingAccess(row.id)
    }

    const assignments = await sql`
      SELECT c.id AS course_id, c.course_code, c.course_title, c.semester, c.university_id, c.university,
             cs.role AS staff_role
      FROM course_staff cs
      INNER JOIN courses c ON c.id = cs.course_id
      WHERE cs.instructor_id = ${row.id}
        AND cs.is_active = true
        AND c.is_active = true
      ORDER BY c.course_title ASC
    `

    const scopedAssignments =
      loginUniversityId != null
        ? (assignments as Record<string, unknown>[]).filter((a) =>
            courseRowMatchesUniversity(
              {
                university_id: a.university_id as number | null,
                course_code: a.course_code as string,
                university: a.university as string | null,
              },
              loginUniversityId,
            ),
          )
        : assignments

    const passwordGate = await resolveFacultyPasswordGate({
      instructorId: row.id,
      passwordHash: row.password,
      hasChangedPasswordFlag: row.has_changed_password,
    })
    const sessionData = {
      id: row.id,
      username: row.username,
      email: row.email,
      name: row.name,
      accountType: "faculty" as const,
      role: row.role,
      hasChangedPassword: passwordGate.hasChangedPassword,
      requiresPasswordChange: passwordGate.requiresPasswordChange,
      assignedInstructorId: row.assigned_instructor_id,
      taPermissions: row.ta_permissions ?? {},
      selectedUniversityId: loginUniversityId,
      loginTime: new Date().toISOString(),
      courseAssignments: (scopedAssignments as { staff_role: string }[]).map((a) => ({
        ...a,
        staff_role: normalizeCourseStaffRole(a.staff_role) ?? a.staff_role,
      })),
    }

    await logPlatformActivityFromRequest(request, {
      portal: "faculty",
      actorType: "instructor",
      actorId: row.id,
      actorLabel: row.name,
      actorEmail: row.email,
      action: ACTIVITY_ACTIONS.LOGIN_SUCCESS,
      category: "auth",
      summary: `Faculty ${row.name} (${row.role}) passed password check — MFA pending`,
      metadata: { username: row.username, role: row.role, mfaPending: true },
    })

    return gateLoginWithMfa({
      userType: "instructor",
      userId: row.id,
      request,
      loginPayload: {
        message: "Login successful",
        accountType: "faculty",
        instructor: sessionData,
        faculty: sessionData,
        mfaAccountName: row.email || row.username,
        mfaIssuer: "CourseCollab Faculty",
        rememberMe,
        sessionExpiresIn: sessionDurationMs(rememberMe),
        _refreshMeta: {
          userType: "instructor" as const,
          userId: row.id,
          rememberMe,
          universityId: loginUniversityId,
        },
      },
    })
  } catch (error) {
    console.error("Error during instructor login:", error)
    return NextResponse.json({ error: "Login failed" }, { status: 500 })
  }
}
