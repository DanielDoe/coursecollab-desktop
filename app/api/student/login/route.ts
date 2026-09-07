// Import console override early to disable logs in production
import "@/lib/console-override"
import { type NextRequest, NextResponse } from "next/server"
import { getSQL } from "@/lib/db"
import { getPlaygroundCredits, getEffectiveMembershipTier } from "@/lib/membership"
import bcrypt from "bcryptjs"
import {
  studentRowSectionMatchesLogin,
} from "@/lib/session-code-aliases"
import { findStudentsByLoginIdentifier } from "@/lib/student-login-lookup"
import { requireActiveCourse } from "@/lib/instructor-course-scope"
import { getStudentRosterDefaultPassword } from "@/lib/student-roster-default-password"
import { resolveSessionForCourseLogin } from "@/lib/student-login-session"
import { studentLoginNotFoundPayload } from "@/lib/student-login-errors"
import {
  ACTIVITY_ACTIONS,
  logPlatformActivityFromRequest,
} from "@/lib/platform-activity-log"
import { logAuthError } from "@/lib/system-log"
import { gateLoginWithMfa } from "@/lib/mfa/login-gate"
import { isDeletedAccountRow } from "@/lib/compliance/account-deletion"
import { AUTH_RATE_LIMIT, checkRateLimit, rateLimitKey } from "@/lib/compliance/rate-limit"
import { findPendingAccessRequestForLogin } from "@/lib/access-governance/service"

export async function POST(request: NextRequest) {
  try {
    const limited = checkRateLimit(
      rateLimitKey(request, "student-login"),
      AUTH_RATE_LIMIT.limit,
      AUTH_RATE_LIMIT.windowMs,
    )
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Too many sign-in attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
      )
    }
    console.log("[v0] ===== Student Login API Called =====")
    console.log("[v0] Environment check:", {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      nodeEnv: process.env.NODE_ENV
    })

    const { fullName, studentId, section, password, courseId: courseIdBody } = await request.json()

    const courseId = courseIdBody != null ? Number(courseIdBody) : null

    console.log("[v0] Login attempt:", {
      studentId,
      section,
      fullName,
      courseId,
    })

    // Validate input
    if (!fullName || !studentId || !section || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    if (courseId == null || !Number.isFinite(courseId)) {
      return NextResponse.json({ error: "Select a course to continue." }, { status: 400 })
    }

    const courseGate = await requireActiveCourse(courseId)
    if (!courseGate.ok) {
      return courseGate.response
    }

    console.log("[v0] Getting SQL client...")
    const sql = getSQL()

    const courseRows = await sql`
      SELECT course_code FROM courses WHERE id = ${courseId} AND is_active = true LIMIT 1
    `
    const defaultPassword = getStudentRosterDefaultPassword(
      courseRows[0]?.course_code as string | undefined,
    )

    const idInput = String(studentId).trim()

    console.log("[v0] Querying database for student (PVAMU student_id or Canvas sis_user_id)...")
    const existingStudent = (await findStudentsByLoginIdentifier(sql, idInput)) as Record<
      string,
      unknown
    >[]
    if (existingStudent.length > 1) {
      return NextResponse.json(
        {
          error:
            "Multiple accounts match this ID. Use your PVAMU student number from the syllabus, or pick your name from Roster login.",
        },
        { status: 400 },
      )
    }
    console.log("[v0] Query completed, found:", existingStudent.length, "students")

    /** Catalog row for enrollments (quiz_session_access, etc.); prefer ELEG* when both legacy and canonical exist */
    let resolvedSessionId: number | null = null
    let resolvedSectionCode = section

    const preferredSessionFromRow =
      existingStudent.length > 0 && existingStudent[0].session_id != null
        ? Number(existingStudent[0].session_id)
        : null

    const resolvedSession = await resolveSessionForCourseLogin(
      courseId,
      section,
      preferredSessionFromRow,
    )

    if (!resolvedSession) {
      return NextResponse.json(
        {
          error: "Could not resolve your course section. Contact your instructor.",
          message:
            existingStudent.length > 0
              ? "Your roster account was found, but this course section is not set up yet. Ask your instructor to confirm your section code."
              : "Confirm the course and section match your syllabus, or ask your instructor to add you to the roster.",
        },
        { status: 400 },
      )
    }
    resolvedSessionId = resolvedSession.sessionId
    resolvedSectionCode = resolvedSession.sectionCode
    console.log("[v0] SQL client obtained successfully")

    console.log("[v0] Database query result:", {
      found: existingStudent.length > 0,
      studentData:
        existingStudent.length > 0
          ? {
              id: existingStudent[0].id,
              student_id: existingStudent[0].student_id,
              full_name: existingStudent[0].full_name,
              section: existingStudent[0].section,
              password_hash: existingStudent[0].password_hash,
              has_changed_password: existingStudent[0].has_changed_password,
            }
          : null,
    })

    let student

    if (existingStudent.length > 0) {
      const row = existingStudent[0]
      const internalStudentId = Number(row.id)
      const canonicalStudentId = String(row.student_id ?? "")
      const currentSection = row.section

      let catalogSectionCode: string | null = null
      if (row.session_id != null && Number(row.session_id) > 0) {
        const scr = await sql`
          SELECT code FROM sessions WHERE id = ${Number(row.session_id)} LIMIT 1
        `
        if (scr.length > 0) catalogSectionCode = String(scr[0].code ?? "")
      }

      const rowCourseId = row.course_id != null ? Number(row.course_id) : null
      if (rowCourseId != null && rowCourseId !== courseId) {
        return NextResponse.json(
          {
            error:
              "This student ID is registered in a different course. Select the course that matches your enrollment.",
          },
          { status: 403 },
        )
      }

      // Match denormalized section OR catalog row (survives renames / stale `students.section`)
      if (
        !studentRowSectionMatchesLogin(
          String(currentSection ?? ""),
          catalogSectionCode,
          section,
          resolvedSectionCode,
        )
      ) {
        const hint = catalogSectionCode || String(currentSection ?? "").trim() || "your roster section"
        return NextResponse.json(
          {
            error: `This account is enrolled in ${hint}. Choose that lecture section in the login form (or use Roster login).`,
          },
          { status: 403 },
        )
      }

      if (isDeletedAccountRow(row as Record<string, unknown>)) {
        return NextResponse.json({ error: "This account has been deleted." }, { status: 403 })
      }

      // Special handling for demo student (DEMO001) - accept "demo123" password
      let passwordMatch = false
      if (canonicalStudentId === "DEMO001" && password === "demo123") {
        // For demo student, check if password hash matches "demo123"
        passwordMatch = await bcrypt.compare("demo123", String(row.password_hash ?? ""))
        
        // If password hash doesn't match, update it to the correct hash
        if (!passwordMatch) {
          console.log("[v0] Demo student password hash mismatch, updating...")
          const demoPasswordHash = await bcrypt.hash("demo123", 10)
          await sql`
            UPDATE students
            SET password_hash = ${demoPasswordHash}
            WHERE student_id = 'DEMO001'
          `
          passwordMatch = true
          console.log("[v0] Demo student password hash updated")
        }
      } else {
        // Normal password comparison for all other students
        passwordMatch = await bcrypt.compare(password, String(row.password_hash ?? ""))
      }

      if (!passwordMatch) {
        await logPlatformActivityFromRequest(request, {
          portal: "student",
          actorType: "student",
          action: ACTIVITY_ACTIONS.LOGIN_FAILED,
          category: "auth",
          courseId: courseId,
          success: false,
          summary: `Failed student login for ID ${studentId}`,
          metadata: { studentId, section, fullName },
        })
        await logAuthError(request, {
          action: "student_login_failed",
          userId: String(studentId),
          userRole: "student",
          pageAttempted: "/student/login",
          errorMessage: "Invalid password",
          success: false,
        })
        return NextResponse.json({ error: "Invalid password. Please try again." }, { status: 401 })
      }

      const resetRequests = await sql`
        SELECT id FROM password_reset_requests
        WHERE student_id = ${internalStudentId} AND status = 'approved'
        ORDER BY requested_at DESC
        LIMIT 1
      `

      // Check if this is first login (hasn't changed password) and activate trial
      // DEMO STUDENT: Always set has_changed_password = true to skip password change prompt
      const isDemoStudent = canonicalStudentId === "DEMO001"
      const isFirstLogin = !row.has_changed_password && !isDemoStudent
      const hasTrial = row.trial_start_date !== null
      let trialActivated = false

      // Update student profile to match resolved catalog section on login; trial on first visit.
      if (isFirstLogin && !hasTrial) {
        const updated = await sql`
          UPDATE students
          SET full_name = ${fullName},
              section = ${resolvedSectionCode},
              session_id = ${resolvedSessionId},
              course_id = ${courseId},
              trial_start_date = NOW()
          WHERE id = ${internalStudentId}
          RETURNING *
        `
        student = updated[0]
        trialActivated = true
      } else {
        // For demo student, ensure has_changed_password is true
        if (isDemoStudent && !row.has_changed_password) {
          const updated = await sql`
            UPDATE students
            SET full_name = ${fullName},
                section = ${resolvedSectionCode},
                session_id = ${resolvedSessionId},
                course_id = ${courseId},
                has_changed_password = true
            WHERE id = ${internalStudentId}
            RETURNING *
          `
          student = updated[0]
        } else {
          const updated = await sql`
            UPDATE students
            SET full_name = ${fullName},
                section = ${resolvedSectionCode},
                session_id = ${resolvedSessionId},
                course_id = ${courseId}
            WHERE id = ${internalStudentId}
            RETURNING *
          `
          student = updated[0]
        }
      }

      const effectiveMembershipTier = await getEffectiveMembershipTier(internalStudentId)

      return NextResponse.json({
        student,
        effectiveMembershipTier,
        hasApprovedResetRequest: resetRequests.length > 0,
        resetRequestId: resetRequests.length > 0 ? resetRequests[0].id : null,
        trialActivated,
      })
    } else {
      const pending = await findPendingAccessRequestForLogin({
        loginId: idInput,
        email: null,
        requestKinds: ["roster"],
      })
      if (pending) {
        return NextResponse.json(
          {
            error: "Access request pending",
            lifecycle: "pending_approval",
            accountType: "student",
            request: {
              fullName: pending.full_name,
              section: pending.section,
              submittedAt: pending.created_at,
            },
          },
          { status: 403 },
        )
      }

      if (idInput === "DEMO001" && password === "demo123") {
        const passwordHash = await bcrypt.hash("demo123", 10)
        const created = await sql`
          INSERT INTO students (student_id, full_name, section, session_id, course_id, password_hash, has_changed_password, trial_start_date, beta_user)
          VALUES (${idInput}, ${fullName}, ${resolvedSectionCode}, ${resolvedSessionId}, ${courseId}, ${passwordHash}, true, NOW(), true)
          RETURNING *
        `
        student = created[0]
      } else {
        return NextResponse.json(studentLoginNotFoundPayload(), { status: 403 })
      }
    }

    console.log("[v0] Login successful for student:", student.id)

    try {
      await getPlaygroundCredits(Number(student.id))
    } catch {
      // Non-blocking: ensure weekly Scholar/Explorer playground allowance is synced
    }

    await logPlatformActivityFromRequest(request, {
      portal: "student",
      actorType: "student",
      actorId: Number(student.id),
      actorLabel: String(student.full_name ?? fullName),
      actorEmail: student.email ? String(student.email) : null,
      action: ACTIVITY_ACTIONS.LOGIN_SUCCESS,
      category: "auth",
      courseId: courseId,
      summary: `Student ${student.full_name ?? fullName} logged in`,
      metadata: { studentId: String(student.student_id ?? studentId), section: resolvedSectionCode, courseId },
    })
    
    // For new students, trial is already activated in the INSERT statement
    const trialActivated = student.trial_start_date !== null && !existingStudent.length
    
    const effectiveMembershipTier = await getEffectiveMembershipTier(Number(student.id))

    return gateLoginWithMfa({
      userType: "student",
      userId: Number(student.id),
      request,
      loginPayload: {
        student,
        trialActivated,
        effectiveMembershipTier,
        mfaAccountName: String(student.email ?? student.student_id ?? fullName),
        mfaIssuer: "CourseCollab",
      },
    })
  } catch (error) {
    console.error("[v0] Student login error:", error)
    console.error("[v0] Error details:", {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    })
    return NextResponse.json({ 
      error: "Failed to login",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
