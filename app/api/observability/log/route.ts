import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



// Lightweight, non-blocking logging endpoint
export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      module,
      subModule,
      eventType,
      eventData,
      status = "info",
      sessionId
    } = body

    // Validate required fields
    if (!module || !eventType) {
      return NextResponse.json(
        { error: "Missing required fields: module, eventType" },
        { status: 400 }
      )
    }

    // Get user ID from session storage (passed from frontend)
    // Convert studentId (string) to database ID (integer) to avoid FK constraint violations
    // Use studentDatabaseId if available (already the database ID), otherwise set to null
    let userId: number | null = null
    if (eventData?.studentDatabaseId) {
      // Prefer studentDatabaseId if provided (already the database ID)
      const parsedId = parseInt(eventData.studentDatabaseId)
      if (!isNaN(parsedId) && parsedId > 0) {
        userId = parsedId
      }
    }
    // If only studentId (string) is provided, we can't use it directly as it's not the database ID
    // The insert will use null for userId, which is allowed (FK constraint allows NULL)

    // Get IP address and user agent for security tracking
    const ipAddress = request.headers.get("x-forwarded-for") || 
                     request.headers.get("x-real-ip") || 
                     "unknown"
    const userAgent = request.headers.get("user-agent") || "unknown"

    // Insert log asynchronously (fire-and-forget)
    // Don't await to avoid blocking the response
    sql`
      INSERT INTO observability_logs (
        user_id,
        module,
        sub_module,
        event_type,
        event_data,
        status,
        session_id,
        ip_address,
        user_agent,
        timestamp
      )
      VALUES (
        ${userId},
        ${module},
        ${subModule || null},
        ${eventType},
        ${JSON.stringify(eventData)},
        ${status},
        ${sessionId || null},
        ${ipAddress},
        ${userAgent},
        NOW()
      )
    `.catch(error => {
      // Silent fail - don't break student experience
      console.error("[Observability] Failed to log event:", error)
    })

    // Return immediately without waiting for DB write
    return NextResponse.json({ success: true }, { status: 202 })
  } catch (error) {
    // Silent fail - observability should never break the app
    console.error("[Observability] Error processing log request:", error)
    return NextResponse.json({ success: true }, { status: 202 })
  }
}

// Batch logging endpoint for performance
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { logs } = body

    if (!Array.isArray(logs) || logs.length === 0) {
      return NextResponse.json(
        { error: "Invalid logs array" },
        { status: 400 }
      )
    }

    // Get IP and user agent once for all logs
    const ipAddress = request.headers.get("x-forwarded-for") || 
                     request.headers.get("x-real-ip") || 
                     "unknown"
    const userAgent = request.headers.get("user-agent") || "unknown"

    // Batch insert (fire-and-forget)
    // Use studentDatabaseId if available, otherwise set userId to null to avoid FK constraint violations
    const values = logs.map(log => {
      let userId: number | null = null
      if (log.eventData?.studentDatabaseId) {
        const parsedId = parseInt(log.eventData.studentDatabaseId)
        if (!isNaN(parsedId) && parsedId > 0) {
          userId = parsedId
        }
      }
      // If only studentId (string) is provided, we can't use it directly
      // The insert will use null for userId, which is allowed
      return {
        userId,
        module: log.module,
        subModule: log.subModule || null,
        eventType: log.eventType,
        eventData: JSON.stringify(log.eventData || {}),
        status: log.status || "info",
        sessionId: log.sessionId || null,
        ipAddress,
        userAgent
      }
    })

    // Insert all logs in one query
    Promise.all(
      values.map(v => sql`
        INSERT INTO observability_logs (
          user_id, module, sub_module, event_type, event_data,
          status, session_id, ip_address, user_agent, timestamp
        )
        VALUES (
          ${v.userId}, ${v.module}, ${v.subModule}, ${v.eventType},
          ${v.eventData}, ${v.status}, ${v.sessionId}, ${v.ipAddress},
          ${v.userAgent}, NOW()
        )
      `)
    ).catch(error => {
      console.error("[Observability] Batch insert failed:", error)
    })

    return NextResponse.json({ success: true, logged: logs.length }, { status: 202 })
  } catch (error) {
    console.error("[Observability] Batch log error:", error)
    return NextResponse.json({ success: true }, { status: 202 })
  }
}

