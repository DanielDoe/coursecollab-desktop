import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const instructorId = request.nextUrl.searchParams.get("instructorId")
    
    if (!instructorId) {
      return NextResponse.json({ error: "Instructor ID required" }, { status: 400 })
    }

    const passwordRequests = await sql`
      SELECT 
        pr.*,
        s.username,
        s.email,
        s.session_code
      FROM password_reset_requests pr
      JOIN students s ON pr.student_id = s.id
      WHERE pr.status = 'pending'
      ORDER BY pr.created_at DESC
    `

    return NextResponse.json({ passwordRequests })
  } catch (error) {
    console.error("Error fetching password requests:", error)
    return NextResponse.json({ error: "Failed to fetch password requests" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const instructorId = request.nextUrl.searchParams.get("instructorId")
    const body = await request.json()
    
    if (!instructorId) {
      return NextResponse.json({ error: "Instructor ID required" }, { status: 400 })
    }

    const { requestId, action } = body // action: "approve" or "reject"

    if (action === "approve") {
      await sql`
        UPDATE password_reset_requests 
        SET status = 'approved', approved_by = ${instructorId}, approved_at = NOW()
        WHERE id = ${requestId}
      `
    } else if (action === "reject") {
      await sql`
        UPDATE password_reset_requests 
        SET status = 'rejected', approved_by = ${instructorId}, approved_at = NOW()
        WHERE id = ${requestId}
      `
    }

    return NextResponse.json({ message: `Password request ${action}d successfully` })
  } catch (error) {
    console.error("Error processing password request:", error)
    return NextResponse.json({ error: "Failed to process password request" }, { status: 500 })
  }
}

