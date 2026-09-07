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

    // Fetch system health metrics
    const health = {
      cpu_usage: Math.floor(Math.random() * 30) + 20, // Mock data
      memory_usage: Math.floor(Math.random() * 40) + 30,
      disk_usage: Math.floor(Math.random() * 20) + 10,
      database_connected: true,
      api_latency: Math.floor(Math.random() * 50) + 10
    }

    return NextResponse.json({ health })
  } catch (error) {
    console.error("Error fetching system health:", error)
    return NextResponse.json({ error: "Failed to fetch system health" }, { status: 500 })
  }
}

