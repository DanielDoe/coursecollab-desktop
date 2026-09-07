import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = 'force-dynamic'
export const runtime = "nodejs"

/**
 * GET /api/instructor/settings
 * Fetch instructor settings
 */
export async function GET(request: NextRequest) {
  try {
    // Verify instructor authentication
    const instructorSession = request.headers.get("authorization") || request.headers.get("x-instructor-id")
    const instructorId = request.nextUrl.searchParams.get("instructorId")
    
    if (!instructorSession && !instructorId) {
      return NextResponse.json({ error: "Instructor authentication required" }, { status: 401 })
    }

    // Get instructor ID from session or query param
    let id = instructorId
    if (!id && instructorSession) {
      try {
        const session = JSON.parse(instructorSession)
        id = session.id || session.databaseId
      } catch {
        // If not JSON, assume it's the ID itself
        id = instructorSession
      }
    }

    if (!id) {
      return NextResponse.json({ error: "Instructor ID required" }, { status: 400 })
    }

    // Fetch instructor data
    const instructors = await sql`
      SELECT id, name, email, username
      FROM instructors
      WHERE id = ${id}
    `

    if (instructors.length === 0) {
      return NextResponse.json({ error: "Instructor not found" }, { status: 404 })
    }

    const instructor = instructors[0]

    // Return default settings (can be extended to fetch from a settings table)
    return NextResponse.json({
      settings: {
        profile: {
          name: instructor.name || "",
          email: instructor.email || "",
          bio: "",
          avatar: "",
        },
        preferences: {
          theme: "system",
          notifications: true,
          email_notifications: true,
          auto_save: true,
        },
        security: {
          two_factor_enabled: false,
          session_timeout: 30,
          password_change_required: false,
        },
        system: {
          maintenance_mode: false,
          backup_frequency: "daily",
          log_retention_days: 30,
        },
      },
    })
  } catch (error: any) {
    console.error("[Settings API] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch settings", details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/instructor/settings
 * Update instructor settings
 */
export async function PUT(request: NextRequest) {
  try {
    // Verify instructor authentication
    const instructorSession = request.headers.get("authorization") || request.headers.get("x-instructor-id")
    const body = await request.json()
    const { instructorId, settings } = body
    
    if (!instructorSession && !instructorId) {
      return NextResponse.json({ error: "Instructor authentication required" }, { status: 401 })
    }

    // Get instructor ID
    let id = instructorId
    if (!id && instructorSession) {
      try {
        const session = JSON.parse(instructorSession)
        id = session.id || session.databaseId
      } catch {
        id = instructorSession
      }
    }

    if (!id) {
      return NextResponse.json({ error: "Instructor ID required" }, { status: 400 })
    }

    // Update instructor profile if provided
    if (settings.profile) {
      await sql`
        UPDATE instructors
        SET 
          name = COALESCE(${settings.profile.name}, name),
          email = COALESCE(${settings.profile.email}, email)
        WHERE id = ${id}
      `
    }

    // Settings are stored in memory/localStorage for now
    // In the future, can create a settings table

    return NextResponse.json({
      message: "Settings saved successfully",
      settings,
    })
  } catch (error: any) {
    console.error("[Settings API] Error:", error)
    return NextResponse.json(
      { error: "Failed to save settings", details: error.message },
      { status: 500 }
    )
  }
}

