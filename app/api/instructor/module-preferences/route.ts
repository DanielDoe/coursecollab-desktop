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

    const preferences = await sql`
      SELECT 
        module_name,
        is_enabled,
        settings,
        last_accessed
      FROM instructor_module_preferences 
      WHERE instructor_id = ${instructorId}
      ORDER BY last_accessed DESC
    `

    return NextResponse.json({ preferences })
  } catch (error) {
    console.error("Error fetching module preferences:", error)
    return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const instructorId = request.nextUrl.searchParams.get("instructorId")
    const body = await request.json()
    
    if (!instructorId) {
      return NextResponse.json({ error: "Instructor ID required" }, { status: 400 })
    }

    const { module_name, is_enabled, settings } = body

    await sql`
      INSERT INTO instructor_module_preferences (
        instructor_id, module_name, is_enabled, settings, last_accessed
      ) VALUES (
        ${instructorId}, ${module_name}, ${is_enabled}, 
        ${JSON.stringify(settings || {})}, NOW()
      )
      ON CONFLICT (instructor_id, module_name) 
      DO UPDATE SET 
        is_enabled = ${is_enabled},
        settings = ${JSON.stringify(settings || {})},
        last_accessed = NOW()
    `

    return NextResponse.json({ message: "Preferences updated successfully" })
  } catch (error) {
    console.error("Error updating module preferences:", error)
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 })
  }
}

