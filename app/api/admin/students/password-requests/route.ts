import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    // Fetch password reset requests
    const requests = await sql`
      SELECT 
        prr.id,
        prr.student_id,
        s.full_name as student_name,
        s.email as student_email,
        prr.requested_at,
        prr.status,
        prr.admin_notes
      FROM password_reset_requests prr
      JOIN students s ON prr.student_id = s.id
      ORDER BY prr.requested_at DESC
    `

    return NextResponse.json({ requests })
  } catch (error) {
    console.error("Failed to fetch password reset requests:", error)
    return NextResponse.json({ error: "Failed to fetch password reset requests" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = sessionStorage.getItem("adminId")
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { requestId, action, notes } = body

    if (!requestId || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Update the request status
    const result = await sql`
      UPDATE password_reset_requests 
      SET 
        status = ${action},
        admin_notes = ${notes || null},
        processed_at = NOW(),
        processed_by = ${adminId}
      WHERE id = ${requestId}
      RETURNING id
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    // If approved, we could send an email notification here
    if (action === "approved") {
      // Get student email for notification
      const studentInfo = await sql`
        SELECT s.email, s.full_name
        FROM password_reset_requests prr
        JOIN students s ON prr.student_id = s.id
        WHERE prr.id = ${requestId}
      `

      if (studentInfo.length > 0) {
        // Here you would typically send an email notification
        console.log(`Password reset approved for ${studentInfo[0].full_name} (${studentInfo[0].email})`)
      }
    }

    return NextResponse.json({ 
      message: `Password request ${action}d successfully` 
    })
  } catch (error) {
    console.error("Failed to update password request:", error)
    return NextResponse.json({ error: "Failed to update password request" }, { status: 500 })
  }
}

