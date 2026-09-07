import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    // Check if instructors table exists and has data
    const instructors = await sql`
      SELECT id, username, email, name FROM instructors LIMIT 5
    `
    
    return NextResponse.json({
      success: true,
      instructors: instructors,
      count: instructors.length,
      message: instructors.length > 0 ? "Instructors found" : "No instructors found - you may need to run setup"
    })
  } catch (error) {
    console.error("Error checking instructors:", error)
    return NextResponse.json({ 
      error: "Database error", 
      details: error instanceof Error ? error.message : String(error),
      suggestion: "You may need to run the instructor setup script"
    }, { status: 500 })
  }
}
