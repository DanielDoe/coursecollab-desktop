import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"


// Use Node runtime for database operations
export const runtime = "nodejs"

// No caching for metrics
export const revalidate = 0
export const dynamic = "force-dynamic"


// Track API performance (in-memory, resets on cold start)
const metricsStore = {
  notificationCalls: 0,
  notificationTotalLatency: 0,
  lastReset: Date.now(),
}

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    // Verify admin/instructor access
    const authHeader = request.headers.get("authorization")
    const instructorId = request.headers.get("x-instructor-id")
    
    // Simple auth check - in production, use proper session validation
    if (!authHeader && !instructorId) {
      return NextResponse.json(
        { error: "Unauthorized - Admin/Instructor access required" },
        { status: 401 }
      )
    }

    const startTime = Date.now()

    // Get system uptime (approximate based on when metrics were last reset)
    const uptimeMs = Date.now() - metricsStore.lastReset
    const uptimeMinutes = Math.floor(uptimeMs / 60000)

    // Test database connectivity and latency
    const dbStartTime = Date.now()
    let dbStatus = "unknown"
    let dbLatency = 0
    let dbConnectionCount = 0

    try {
      const dbTest = await sql`SELECT 1 as test`
      dbLatency = Date.now() - dbStartTime
      dbStatus = "connected"

      // Try to get active connection count (may fail if not supported)
      try {
        const connResult = await sql`
          SELECT count(*) as active_connections 
          FROM pg_stat_activity 
          WHERE datname = current_database()
        `
        dbConnectionCount = parseInt(connResult[0]?.active_connections || "0")
      } catch {
        // Connection count query not supported or failed
        dbConnectionCount = -1
      }
    } catch (dbError) {
      dbStatus = "error"
      dbLatency = Date.now() - dbStartTime
      console.error("[System Metrics] Database error:", dbError)
    }

    // Calculate average notification API latency
    const avgNotificationLatency =
      metricsStore.notificationCalls > 0
        ? Math.round(metricsStore.notificationTotalLatency / metricsStore.notificationCalls)
        : 0

    // Get build information (from package.json or env)
    const buildInfo = {
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || "unknown",
      nextVersion: "15.2.4", // Update this when Next.js version changes
    }

    // Health warnings
    const warnings = []
    if (dbLatency > 1000) {
      warnings.push(`⚠️ Database latency high: ${dbLatency}ms (should be < 1000ms)`)
    }
    if (avgNotificationLatency > 500) {
      warnings.push(`⚠️ Notification API slow: ${avgNotificationLatency}ms avg (should be < 500ms)`)
    }
    if (dbConnectionCount > 50 && dbConnectionCount !== -1) {
      warnings.push(`⚠️ High connection count: ${dbConnectionCount} (monitor for leaks)`)
    }

    const response = {
      status: dbStatus === "connected" ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: {
        milliseconds: uptimeMs,
        minutes: uptimeMinutes,
        hours: Math.floor(uptimeMinutes / 60),
      },
      database: {
        status: dbStatus,
        latency: `${dbLatency}ms`,
        activeConnections: dbConnectionCount === -1 ? "unknown" : dbConnectionCount,
      },
      api: {
        notificationPolling: {
          totalCalls: metricsStore.notificationCalls,
          averageLatency: `${avgNotificationLatency}ms`,
        },
      },
      build: buildInfo,
      warnings: warnings.length > 0 ? warnings : undefined,
      responseTime: `${Date.now() - startTime}ms`,
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error("[System Metrics] Error:", error)
    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "Failed to fetch system metrics",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

// Export function to update notification metrics (called from notification API)
export function trackNotificationCall(latencyMs: number) {
  metricsStore.notificationCalls++
  metricsStore.notificationTotalLatency += latencyMs
}

