import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const startTime = Date.now()

    // Test database connectivity and fetch counts in parallel
    const [studentCount, quizCount, attemptCount, sessionCount] = await Promise.all([
      sql`SELECT COUNT(*)::int as count FROM students`,
      sql`SELECT COUNT(*)::int as count FROM quizzes`,
      sql`SELECT COUNT(*)::int as count FROM quiz_attempts`,
      sql`SELECT COUNT(*)::int as count FROM sessions`,
    ])

    const dbLatency = Date.now() - startTime
    const totalStudents = (studentCount[0] as { count: number })?.count ?? 0
    const totalQuizzes = (quizCount[0] as { count: number })?.count ?? 0
    const totalAttempts = (attemptCount[0] as { count: number })?.count ?? 0
    const activeSessions = (sessionCount[0] as { count: number })?.count ?? 0

    // Calculate system health score
    const healthScore = Math.min(100, Math.max(0, 100 - (dbLatency / 10)))

    return NextResponse.json({
      status: "healthy",
      healthScore: Math.round(healthScore),
      database: {
        status: "connected",
        latency: dbLatency,
        responseTime: `${dbLatency}ms`
      },
      system: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      },
      metrics: {
        totalStudents,
        totalQuizzes,
        totalAttempts,
        activeSessions
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Error fetching system health:", error)
    return NextResponse.json(
      {
        status: "unhealthy",
        healthScore: 0,
        error: "Failed to fetch system health",
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

