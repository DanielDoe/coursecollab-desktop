import { NextRequest, NextResponse } from "next/server"
import { requireCodebenchStudent } from "@/lib/codebench-request-auth"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get("studentId")
    const bound = await requireCodebenchStudent(request, studentId)
    if (!bound.ok) return bound.response

    const activityData = await sql`
      WITH codebench_activity AS (
        SELECT 
          DATE(cs.submitted_at) as activity_date,
          COUNT(*) as submissions
        FROM codebench_submissions cs
        WHERE cs.student_id = ${bound.studentDbId}
          AND cs.submitted_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(cs.submitted_at)
      ),
      practice_activity AS (
        SELECT 
          DATE(ps.submitted_at) as activity_date,
          COUNT(*) as practices
        FROM practice_submissions ps
        WHERE ps.student_id = ${bound.studentDbId}
          AND ps.submitted_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(ps.submitted_at)
      ),
      combined_activity AS (
        SELECT 
          COALESCE(c.activity_date, p.activity_date) as activity_date,
          COALESCE(c.submissions, 0) + COALESCE(p.practices, 0) as total_activities
        FROM codebench_activity c
        FULL OUTER JOIN practice_activity p ON c.activity_date = p.activity_date
      )
      SELECT 
        activity_date,
        total_activities,
        CASE WHEN total_activities > 0 THEN true ELSE false END as has_activity
      FROM combined_activity
      ORDER BY activity_date DESC
    `

    let currentStreak = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const activityMap = new Map<string, boolean>()
    activityData.forEach((row: any) => {
      const dateKey = row.activity_date instanceof Date 
        ? row.activity_date.toISOString().split("T")[0]
        : row.activity_date
      activityMap.set(dateKey, row.has_activity)
    })

    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today)
      checkDate.setDate(checkDate.getDate() - i)
      const dateKey = checkDate.toISOString().split("T")[0]
      
      if (activityMap.get(dateKey)) {
        currentStreak++
      } else if (i === 0) {
        continue
      } else {
        break
      }
    }

    const calendarData: { [key: string]: boolean } = {}
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateKey = date.toISOString().split("T")[0]
      calendarData[dateKey] = activityMap.get(dateKey) || false
    }

    return NextResponse.json({
      streakDays: currentStreak,
      calendarData,
      activityStats: {
        totalSubmissions: activityData.reduce((sum: number, row: any) => sum + (row.total_activities || 0), 0),
        activeDays: activityData.filter((row: any) => row.has_activity).length,
      },
    })
  } catch (error) {
    console.error("Streak tracking error:", error)
    return NextResponse.json({ error: "Failed to fetch streak data" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    let claimed: string | null = null
    try {
      const body = await request.json()
      claimed = body?.studentId != null ? String(body.studentId) : null
    } catch {
      claimed = null
    }

    const bound = await requireCodebenchStudent(request, claimed)
    if (!bound.ok) return bound.response

    const today = new Date().toISOString().split("T")[0]
    return NextResponse.json({ success: true, date: today })
  } catch (error) {
    console.error("Streak recording error:", error)
    return NextResponse.json({ error: "Failed to record activity" }, { status: 500 })
  }
}
