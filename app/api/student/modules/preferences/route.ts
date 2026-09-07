import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const studentId = searchParams.get("studentId")

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    const preferences = await sql`
      SELECT 
        module_name,
        is_favorite,
        usage_count,
        display_order,
        last_accessed
      FROM student_module_preferences
      WHERE student_id = ${studentId}
      ORDER BY display_order ASC, usage_count DESC
    `

    return NextResponse.json({ preferences })
  } catch (error) {
    console.error("Failed to fetch module preferences:", error)
    return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { studentId, moduleName, isFavorite, displayOrder } = body

    if (!studentId || !moduleName) {
      return NextResponse.json({ error: "Student ID and module name are required" }, { status: 400 })
    }

    // Upsert preference
    await sql`
      INSERT INTO student_module_preferences (student_id, module_name, is_favorite, display_order, usage_count, last_accessed)
      VALUES (${studentId}, ${moduleName}, ${isFavorite || false}, ${displayOrder || 0}, 1, CURRENT_TIMESTAMP)
      ON CONFLICT (student_id, module_name)
      DO UPDATE SET
        is_favorite = COALESCE(${isFavorite}, student_module_preferences.is_favorite),
        display_order = COALESCE(${displayOrder}, student_module_preferences.display_order),
        usage_count = student_module_preferences.usage_count + 1,
        last_accessed = CURRENT_TIMESTAMP
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to update module preference:", error)
    return NextResponse.json({ error: "Failed to update preference" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { studentId, preferences } = body

    if (!studentId || !preferences || !Array.isArray(preferences)) {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400 })
    }

    // Update display order for all modules
    for (const pref of preferences) {
      await sql`
        UPDATE student_module_preferences
        SET display_order = ${pref.displayOrder}
        WHERE student_id = ${studentId} AND module_name = ${pref.moduleName}
      `
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to update module order:", error)
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 })
  }
}
