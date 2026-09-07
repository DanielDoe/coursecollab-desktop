import { type NextRequest, NextResponse } from "next/server"
import { getSQL } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    console.log("[TEST-DB] Testing database connection...")
    console.log("[TEST-DB] Has DATABASE_URL:", !!process.env.DATABASE_URL)
    console.log("[TEST-DB] NODE_ENV:", process.env.NODE_ENV)
    
    const sql = getSQL()
    
    const result = await sql`SELECT NOW() as current_time, version() as version`
    
    console.log("[TEST-DB] Database connected successfully")
    
    return NextResponse.json({ 
      success: true,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      currentTime: result[0]?.current_time,
      version: result[0]?.version?.substring(0, 50) + "..."
    })
  } catch (error) {
    console.error("[TEST-DB] Database connection failed:", error)
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      hasDatabaseUrl: !!process.env.DATABASE_URL
    }, { status: 500 })
  }
}


