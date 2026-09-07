import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    // Mock system health data - in production, this would connect to actual monitoring systems
    const health = {
      uptime: "99.9%",
      databaseStatus: "healthy" as const,
      apiLatency: Math.floor(Math.random() * 50) + 10, // 10-60ms
      memoryUsage: Math.floor(Math.random() * 30) + 40, // 40-70%
      diskUsage: Math.floor(Math.random() * 20) + 30, // 30-50%
      activeConnections: Math.floor(Math.random() * 100) + 50, // 50-150
    }

    return NextResponse.json({ health })
  } catch (error) {
    console.error("Failed to fetch system health:", error)
    return NextResponse.json({ error: "Failed to fetch system health" }, { status: 500 })
  }
}

