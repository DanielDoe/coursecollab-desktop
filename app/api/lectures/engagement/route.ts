import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lectureId = searchParams.get("lectureId")

    if (!lectureId) {
      return NextResponse.json({ error: "Lecture ID is required" }, { status: 400 })
    }

    const lid = parseInt(lectureId, 10)
    if (!Number.isFinite(lid)) {
      return NextResponse.json({ error: "Invalid lecture ID" }, { status: 400 })
    }

    const topMaterials = await sql`
      SELECT *
      FROM lecture_materials
      WHERE lecture_id = ${lid}
      ORDER BY view_count DESC
      LIMIT 3
    `

    const topComments = await sql`
      SELECT lc.*
      FROM lecture_comments lc
      WHERE lc.lecture_id = ${lid}
      ORDER BY lc.likes DESC
      LIMIT 3
    `

    const [stats] = await sql`
      SELECT
        (
          SELECT COUNT(*)::int
          FROM lecture_views lv
          WHERE lv.lecture_id = ${lid}
        ) AS total_views,
        (
          SELECT COUNT(*)::int
          FROM lecture_comments lc
          WHERE lc.lecture_id = ${lid}
        ) AS total_comments,
        (
          SELECT COUNT(*)::int
          FROM lecture_bookmarks lb
          WHERE lb.lecture_id = ${lid}
        ) AS total_bookmarks
    `

    return NextResponse.json({
      topMaterials: topMaterials || [],
      topComments: topComments || [],
      stats: stats || { total_views: 0, total_comments: 0, total_bookmarks: 0 },
    })
  } catch (error) {
    console.error("Error fetching engagement data:", error)
    return NextResponse.json({ error: "Failed to fetch engagement data" }, { status: 500 })
  }
}
