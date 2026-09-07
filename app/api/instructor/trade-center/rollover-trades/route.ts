import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import {
  fetchMergedRolloverRows,
  filterRolloverRows,
  mapRolloverRowToTrade,
} from "@/lib/trade-center-rollover-trades-query"

export const dynamic = "force-dynamic"

/**
 * GET /api/instructor/trade-center/rollover-trades
 * List students with rollover extensions (points-traded, instructor-granted, or Trailblazer self-apply).
 * Query: session, search, page, limit
 */
export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response
    const courseId = scope.course.id

    const { searchParams } = new URL(request.url)
    const sessionFilter = searchParams.get("session") || ""
    const search = (searchParams.get("search") || "").trim()
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(50, Math.max(5, parseInt(searchParams.get("limit") || "15", 10)))
    const offset = (page - 1) * limit

    const allRows = await fetchMergedRolloverRows(courseId)
    const filtered = filterRolloverRows(allRows, sessionFilter, search)

    const total = filtered.length
    const paged = filtered.slice(offset, offset + limit)

    const trades = paged.map((r, i) => mapRolloverRowToTrade(r, offset + i))

    const sessionsRows = await sql`
      SELECT code FROM sessions WHERE course_id = ${courseId} ORDER BY code ASC
    `
    const fromSessions = (sessionsRows as { code: string }[]).map((row) => row.code)
    const sessions = [...new Set(fromSessions)].filter(Boolean).sort()

    return NextResponse.json({
      trades,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      sessions,
    })
  } catch (error) {
    console.error("[Rollover Trades] Error:", error)
    return NextResponse.json({ error: "Failed to fetch rollover trades" }, { status: 500 })
  }
}
