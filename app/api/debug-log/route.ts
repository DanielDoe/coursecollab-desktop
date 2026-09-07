import { NextRequest, NextResponse } from "next/server"

export const dynamic = 'force-dynamic'
export const runtime = "nodejs"

/**
 * POST /api/debug-log
 * 
 * Server-side logging endpoint for debugging violation detection
 * Logs appear in the server terminal/console
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { level = "info", message, data } = body

    // Format log message with timestamp
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`
    
    // Print to server console
    if (data) {
      console.log(logMessage, JSON.stringify(data, null, 2))
    } else {
      console.log(logMessage)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[Debug Log API] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to log" },
      { status: 500 }
    )
  }
}
