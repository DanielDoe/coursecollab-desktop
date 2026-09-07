import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    // Get verification stats by topic
    const stats = await sql`
      SELECT 
        topic,
        COUNT(*) as verified_count,
        MAX(created_at) as last_verified
      FROM ai_verification_history
      WHERE status = 'approved'
      GROUP BY topic
    `

    // Convert to object for easy lookup
    const statsMap: Record<string, { verifiedCount: number; lastVerified: string }> = {}
    
    stats.forEach((stat: any) => {
      statsMap[stat.topic] = {
        verifiedCount: Number(stat.verified_count),
        lastVerified: stat.last_verified
      }
    })

    return NextResponse.json({ success: true, stats: statsMap })

  } catch (error) {
    console.error("[Verification Stats] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch verification stats" },
      { status: 500 }
    )
  }
}

