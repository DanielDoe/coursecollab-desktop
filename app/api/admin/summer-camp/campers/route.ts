import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAdminIdFromRequest, requireAdminId } from "@/lib/admin-api-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId
    if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const tab = request.nextUrl.searchParams.get("tab") ?? "campers"

    if (tab === "requests") {
      const requests = await sql`
        SELECT id, full_name, student_id, email, school_affiliation, organization,
          request_kind, status, created_at, approved_at, rejection_reason
        FROM account_requests
        WHERE request_kind IN ('summer_camper', 'summer_student', 'camp_password_reset')
        ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, created_at DESC
      `
      return NextResponse.json({ requests })
    }

    if (tab === "settings") {
      const settings = await sql`
        SELECT auto_approve_accounts, platform_admin_notify_email FROM summer_camp_settings ORDER BY id LIMIT 1
      `
      return NextResponse.json({ settings: settings[0] ?? {} })
    }

    const campers = await sql`
      SELECT s.id, s.student_id, s.full_name, s.email, s.section,
        s.student_program_role, s.created_at,
        (SELECT COUNT(*)::int FROM camp_enrollments e WHERE e.student_id = s.id AND e.status = 'active') AS enrollments
      FROM students s
      WHERE COALESCE(s.student_program_role, '') IN ('summer_camper', 'summer_student')
         OR s.section = 'SUMMER_CAMP'
      ORDER BY s.full_name ASC
    `

    return NextResponse.json({ campers })
  } catch (error) {
    console.error("[admin/summer-camp/campers GET]", error)
    return NextResponse.json({ error: "Failed to load campers" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId
    if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    if (body.settings) {
      await sql`
        UPDATE summer_camp_settings SET
          auto_approve_accounts = COALESCE(${body.settings.auto_approve_accounts ?? null}, auto_approve_accounts),
          platform_admin_notify_email = COALESCE(${body.settings.platform_admin_notify_email ?? null}, platform_admin_notify_email),
          updated_at = NOW()
        WHERE id = (SELECT id FROM summer_camp_settings ORDER BY id LIMIT 1)
      `
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: "Invalid update" }, { status: 400 })
  } catch (error) {
    console.error("[admin/summer-camp/campers PATCH]", error)
    return NextResponse.json({ error: "Failed to update" }, { status: 500 })
  }
}
