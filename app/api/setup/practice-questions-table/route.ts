import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

import * as fs from "fs"
import * as path from "path"


export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET() {
  try {
    const migrationPath = path.join(process.cwd(), "scripts", "045-create-practice-questions-table.sql")
    const migrationSql = fs.readFileSync(migrationPath, "utf-8")

    await sql.query(migrationSql)

    return NextResponse.json({ success: true, message: "Practice questions table created successfully." })
  } catch (error) {
    console.error("Error setting up practice questions table:", error)
    return NextResponse.json({ success: false, error: "Failed to set up practice questions table." }, { status: 500 })
  }
}
