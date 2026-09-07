import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET() {
  try {
    // Get all unique tags from forum threads
    const result = await sql`
      SELECT DISTINCT unnest(tags) as tag, COUNT(*) as count
      FROM forum_threads
      GROUP BY tag
      ORDER BY count DESC, tag ASC
    `

    return NextResponse.json({ tags: result })
  } catch (error) {
    console.error("Failed to fetch tags:", error)
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 })
  }
}
