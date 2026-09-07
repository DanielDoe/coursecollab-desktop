import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")

    if (!query) {
      return NextResponse.json({ results: [] })
    }

    console.log("[v0] Searching lectures for:", query)

    const results = await sql`
      SELECT DISTINCT 
        l.id,
        l.title,
        l.week,
        l.session,
        ls.heading,
        ls.content,
        ls.section_order
      FROM lectures l
      LEFT JOIN lecture_sections ls ON l.id = ls.lecture_id
      WHERE 
        l.title ILIKE ${"%" + query + "%"}
        OR ls.heading ILIKE ${"%" + query + "%"}
        OR ls.content ILIKE ${"%" + query + "%"}
      ORDER BY l.week ASC, l.session ASC, ls.section_order ASC
      LIMIT 20
    `

    console.log("[v0] Found", results.length, "search results")
    return NextResponse.json({ results })
  } catch (error) {
    console.error("[v0] Failed to search lectures:", error)
    return NextResponse.json({ error: "Failed to search lectures" }, { status: 500 })
  }
}
