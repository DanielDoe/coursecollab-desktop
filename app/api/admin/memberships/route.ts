import { NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get("activeOnly") === "true"

    // Fetch all memberships with student info
    let memberships
    if (activeOnly) {
      // Only memberships that are active AND not expired (expires_at > NOW or null)
      memberships = await sql`
        SELECT 
          m.id,
          m.student_id,
          m.plan,
          m.status,
          m.stripe_subscription_id,
          m.start_date,
          m.end_date,
          m.expires_at,
          m.created_at,
          s.full_name as student_name,
          s.student_id as student_id_code
        FROM memberships m
        JOIN students s ON m.student_id = s.id
        WHERE m.status = 'active'
          AND (m.expires_at IS NULL OR m.expires_at > NOW())
        ORDER BY m.created_at DESC
      `
    } else {
      memberships = await sql`
        SELECT 
          m.id,
          m.student_id,
          m.plan,
          m.status,
          m.stripe_subscription_id,
          m.start_date,
          m.end_date,
          m.expires_at,
          m.created_at,
          s.full_name as student_name,
          s.student_id as student_id_code
        FROM memberships m
        JOIN students s ON m.student_id = s.id
        ORDER BY m.created_at DESC
      `
    }

    return NextResponse.json({ memberships })
  } catch (error) {
    console.error("Admin memberships fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch memberships" }, { status: 500 })
  }
}
