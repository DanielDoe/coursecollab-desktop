import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

import { promises as fs } from "fs"
import path from "path"


export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminId(request)
    if (!admin.ok) return admin.response

    console.log("🚀 Updating populate_playground_questions function...")

    const scriptPath = path.join(process.cwd(), "scripts", "update-populate-playground-questions.sql")
    const migrationScript = await fs.readFile(scriptPath, "utf8")

    await sql.unsafe(migrationScript)

    console.log("✅ 'populate_playground_questions' function updated successfully.")
    return NextResponse.json({
      success: true,
      message: "Successfully updated 'populate_playground_questions' function",
    })
  } catch (error: any) {
    console.error("❌ Error updating function:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

