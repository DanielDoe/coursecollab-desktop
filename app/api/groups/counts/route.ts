import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { resolveGroupProjectCourseScope } from "@/lib/student-course-scope"
import { resolveGroupProjectTermScope } from "@/lib/group-project-term-scope"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scope = await resolveGroupProjectCourseScope(request)
    if (!scope.ok) return scope.response
    const groupsCourseScope = scope.gCourseScope
    const gTermScope = await resolveGroupProjectTermScope(request, scope.courseId, null)
    const sessionCounts = await sql`
      SELECT session, COUNT(*)::bigint AS count
      FROM groups
      WHERE deleted_at IS NULL
      AND (${groupsCourseScope}) AND (${gTermScope})
      GROUP BY session
    `

    let total = 0
    const counts: Record<string, number> = {}
    for (const row of sessionCounts as { session: string | null; count: string | bigint }[]) {
      const n = Number(row.count)
      total += n
      const key =
        row.session != null && row.session !== "" ? String(row.session) : "(no session)"
      counts[key] = n
    }
    counts.total = total

    return NextResponse.json({ counts })
  } catch (error) {
    console.error("[Groups Counts] Error:", error)
    return NextResponse.json(
      { error: "Database unavailable", counts: { total: 0 } },
      { status: 503 },
    )
  }
}

