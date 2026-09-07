import { NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { asSqlRows, sql } from "@/lib/db"
import { ensureFacultySignupColumns } from "@/lib/ensure-faculty-signup-columns"
import { ensureAccessGovernanceSchema } from "@/lib/access-governance/schema"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    await ensureFacultySignupColumns()
    await ensureAccessGovernanceSchema()

    const status = request.nextUrl.searchParams.get("status")
    const accountType = request.nextUrl.searchParams.get("accountType")
    const statusFilter =
      status === "pending" || status === "approved" || status === "rejected" ? status : null
    const typeFilter =
      accountType === "faculty" ||
      accountType === "student" ||
      accountType === "career_member" ||
      accountType === "summer_student"
        ? accountType
        : null

    const raw = await sql`
      SELECT 
        id,
        full_name,
        student_id,
        section,
        email,
        status,
        created_at,
        approved_by,
        approved_at,
        rejected_at,
        rejection_reason,
        request_kind,
        account_type,
        guest_purpose,
        guest_purpose_detail,
        organization,
        school_affiliation,
        faculty_job_title,
        university_id,
        course_id,
        session_id,
        camp_id,
        sponsoring_faculty_id,
        invitation_id,
        email_verified_at,
        approval_source,
        reviewer_role,
        metadata
      FROM account_requests
      WHERE request_kind != 'camp_password_reset'
        AND status = COALESCE(${statusFilter}, status)
      ORDER BY 
        CASE 
          WHEN status = 'pending' THEN 1
          WHEN status = 'approved' THEN 2
          WHEN status = 'rejected' THEN 3
          ELSE 4
        END,
        created_at DESC
    `

    const requests = asSqlRows(raw).filter((row) => {
      if (!typeFilter) return true
      const kind = String(row.request_kind ?? "")
      const type =
        String(row.account_type ?? "") ||
        (kind === "faculty"
          ? "faculty"
          : kind === "guest"
            ? "career_member"
            : kind === "summer_student" || kind === "summer_camper"
              ? "summer_student"
              : "student")
      return type === typeFilter
    })

    return NextResponse.json({ requests })
  } catch (error) {
    console.error("[Admin Account Requests] Error:", error)
    return NextResponse.json({ error: "Failed to fetch account requests" }, { status: 500 })
  }
}
