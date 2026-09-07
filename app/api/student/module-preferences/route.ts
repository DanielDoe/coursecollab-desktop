import { getSQL } from "@/lib/db"
import { NextResponse } from "next/server"

// 🔹 GET student preferences
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    const sql = getSQL()

    const preferences = await sql`
      SELECT module_name, is_favorite, display_order, usage_count, last_accessed
      FROM student_module_preferences
      WHERE student_id = ${studentId}
      ORDER BY display_order ASC
    `

    return NextResponse.json({ preferences })
  } catch (error) {
    console.error("[v0] Error fetching student module preferences:", error)
    return NextResponse.json({ error: "Failed to fetch student module preferences" }, { status: 500 })
  }
}

// 🔹 POST - toggle favorite
export async function POST(request: Request) {
  try {
    const { studentId, moduleName, isFavorite } = await request.json()

    if (!studentId || !moduleName) {
      return NextResponse.json({ error: "Student ID and module name are required" }, { status: 400 })
    }

    const sql = getSQL()

    await sql`
      INSERT INTO student_module_preferences (student_id, module_name, is_favorite, last_accessed)
      VALUES (${studentId}, ${moduleName}, ${isFavorite}, NOW())
      ON CONFLICT (student_id, module_name)
      DO UPDATE SET is_favorite = ${isFavorite}, last_accessed = NOW()
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error updating student module preference:", error)
    return NextResponse.json({ error: "Failed to update student module preference" }, { status: 500 })
  }
}

// 🔹 PUT - update order
export async function PUT(request: Request) {
  try {
    const { studentId, preferences } = await request.json()

    if (!studentId || !preferences) {
      return NextResponse.json({ error: "Student ID and preferences are required" }, { status: 400 })
    }

    const sql = getSQL()

    for (const pref of preferences) {
      await sql`
        INSERT INTO student_module_preferences (student_id, module_name, display_order)
        VALUES (${studentId}, ${pref.module_name}, ${pref.display_order})
        ON CONFLICT (student_id, module_name)
        DO UPDATE SET display_order = ${pref.display_order}
      `
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error updating student module order:", error)
    return NextResponse.json({ error: "Failed to update student module order" }, { status: 500 })
  }
}
