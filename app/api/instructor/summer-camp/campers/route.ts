import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireSummerCampStaff } from "@/lib/summer-camp/permissions"
import { requireInstructorTaManager } from "@/lib/instructor-ta-api-auth"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import {
  approveAllPendingSummerCamperRequests,
  createSummerCamperFromSignup,
} from "@/lib/summer-camp/camper-accounts"
import { approveAccessRequest, rejectAccessRequest } from "@/lib/access-governance/service"
import bcrypt from "bcryptjs"

export const dynamic = "force-dynamic"

/** Faculty mirror of admin camper management */
export async function GET(request: NextRequest) {
  try {
    const courseScope = await requireInstructorCourse(request)
    if (!courseScope.ok) return courseScope.response
    const scope = await requireSummerCampStaff(request)
    if (!scope.ok) return scope.response

    const tab = request.nextUrl.searchParams.get("tab") ?? "campers"

    if (tab === "requests") {
      const requests = await sql`
        SELECT id, full_name, student_id, email, school_affiliation, organization,
          request_kind, status, created_at
        FROM account_requests
        WHERE request_kind IN ('summer_camper', 'summer_student', 'camp_password_reset')
        ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, created_at DESC
      `
      return NextResponse.json({ requests })
    }

    const campers = await sql`
      SELECT s.id, s.student_id, s.full_name, s.email,
        (SELECT COUNT(*)::int FROM camp_enrollments e WHERE e.student_id = s.id) AS enrollments
      FROM students s
      WHERE COALESCE(s.student_program_role, '') = 'summer_camper'
      ORDER BY s.full_name ASC
    `
    return NextResponse.json({ campers })
  } catch (error) {
    console.error("[instructor/summer-camp/campers]", error)
    return NextResponse.json({ error: "Failed to load campers" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const courseScope = await requireInstructorCourse(request)
    if (!courseScope.ok) return courseScope.response
    const scope = await requireSummerCampStaff(request)
    if (!scope.ok) return scope.response

    const body = await request.json()
    const { action, request_id, student_id, password, reason } = body

    if (action === "create_account") {
      const manager = await requireInstructorTaManager(request)
      if (!manager.ok) return manager.response

      const { fullName, email, school, password, programRole, campId } = body as {
        fullName?: string
        email?: string
        school?: string
        password?: string
        programRole?: "summer_camper" | "summer_student"
        campId?: number
      }

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

      const existingStudent = await sql`
        SELECT id FROM students WHERE TRIM(LOWER(COALESCE(email, ''))) = ${emailNorm} LIMIT 1
      `
      if (existingStudent.length > 0) {
        return NextResponse.json(
          { error: "An account with this email already exists." },
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
          { error: "A pending request already exists for this email." },
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
        markEmailVerified: true,
        allowSystemAutoApprove: true,
      })

      return NextResponse.json({
        success: true,
        autoApproved: result.autoApproved,
        message: result.autoApproved
          ? "Camper account approved. They can sign in now."
          : "Camper request submitted. Approve from the Requests tab when ready.",
      })
    }

    if (action === "approve" && request_id) {
      const result = await approveAccessRequest({
        requestId: Number(request_id),
        reviewer: {
          role: "faculty",
          instructorId: scope.instructorId,
          courseId: courseScope.course.id,
          isActive: true,
        },
        approvalSource: "faculty",
      })
      return NextResponse.json({ success: true, studentId: result.userId, accountType: result.accountType })
    }

    if (action === "reject" && request_id) {
      await rejectAccessRequest({
        requestId: Number(request_id),
        reviewer: {
          role: "faculty",
          instructorId: scope.instructorId,
          courseId: courseScope.course.id,
          isActive: true,
        },
        reason: reason ?? undefined,
      })
      return NextResponse.json({ success: true, message: "Camper request rejected" })
    }

    if (action === "approve_all") {
      const result = await approveAllPendingSummerCamperRequests(scope.instructorId)
      return NextResponse.json({
        success: true,
        approvedCount: result.approved.length,
        failedCount: result.failed.length,
        ...result,
        message:
          result.failed.length === 0
            ? `Approved ${result.approved.length} camper account${result.approved.length === 1 ? "" : "s"}.`
            : `Approved ${result.approved.length}; ${result.failed.length} could not be approved.`,
      })
    }

    if (action === "reset_password" && student_id && password) {
      const hash = await bcrypt.hash(String(password), 10)
      await sql`
        UPDATE students SET password_hash = ${hash}
        WHERE id = ${Number(student_id)} AND student_program_role = 'summer_camper'
      `
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("[instructor/summer-camp/campers POST]", error)
    return NextResponse.json({ error: "Action failed" }, { status: 500 })
  }
}
