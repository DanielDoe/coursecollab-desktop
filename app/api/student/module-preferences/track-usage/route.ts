import { getSQL } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { studentId, moduleName } = await request.json()

    if (!studentId || !moduleName) {
      return NextResponse.json({ error: "Student ID and module name are required" }, { status: 400 })
    }

    const sql = getSQL()

    await sql`
      INSERT INTO student_module_preferences (student_id, module_name, usage_count, last_accessed)
      VALUES (${studentId}, ${moduleName}, 1, NOW())
      ON CONFLICT (student_id, module_name)
      DO UPDATE SET 
        usage_count = student_module_preferences.usage_count + 1,
        last_accessed = NOW()
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error tracking module usage:", error)
    return NextResponse.json({ error: "Failed to track module usage" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { studentId } = await request.json()

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    const sql = getSQL()

    await sql`
      UPDATE student_module_preferences
      SET last_accessed = NULL
      WHERE student_id = ${studentId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error clearing recently used:", error)
    return NextResponse.json({ error: "Failed to clear recently used" }, { status: 500 })
  }
}
