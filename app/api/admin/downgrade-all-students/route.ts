import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminId(request)
    if (!admin.ok) return admin.response

    console.log("🚀 Starting student downgrade to Scholar tier...")
    
    // Get count of students with non-Scholar tiers
    const beforeCount = await sql`
      SELECT COUNT(*) as count
      FROM students
      WHERE membership_tier != 'Scholar' OR membership_tier IS NULL
    `
    console.log(`  Found ${beforeCount[0].count} students to downgrade`)

    // Downgrade all students to Scholar
    await sql`
      UPDATE students
      SET membership_tier = 'Scholar'
      WHERE membership_tier != 'Scholar' OR membership_tier IS NULL
    `

    // Update memberships table
    await sql`
      UPDATE memberships
      SET 
        tier = 'Scholar',
        plan = 'Scholar',
        status = 'active',
        expires_at = NULL,
        end_date = NULL,
        auto_renew = false,
        updated_at = CURRENT_TIMESTAMP
      WHERE tier != 'Scholar' OR tier IS NULL
    `

    // Verify the downgrade
    const afterCount = await sql`
      SELECT COUNT(*) as count
      FROM students
      WHERE membership_tier != 'Scholar'
    `

    if (afterCount[0].count === 0) {
      console.log("✅ All students successfully downgraded to Scholar tier!")
      return NextResponse.json({ 
        success: true,
        message: `Successfully downgraded ${beforeCount[0].count} students to Scholar tier`,
        studentsUpdated: beforeCount[0].count
      })
    } else {
      return NextResponse.json({ 
        success: false,
        error: `${afterCount[0].count} students still have non-Scholar tiers`,
        remaining: afterCount[0].count
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error("❌ Downgrade failed:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

