import { NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET() {
  try {
    // Check if the table exists first
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ai_verification_history'
      )
    `
    
    if (!tableExists[0]?.exists) {
      // Table doesn't exist, return empty stats
      console.log("[Verification Stats] ai_verification_history table does not exist, returning empty stats")
      return NextResponse.json({ success: true, stats: {} })
    }

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
    // Return empty stats instead of error to prevent UI breakage
    return NextResponse.json({ success: true, stats: {} })
  }
}

