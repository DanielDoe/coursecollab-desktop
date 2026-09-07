import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"

export const dynamic = "force-dynamic"

type Insight = {
  id: string
  title: string
  body: string
  severity?: "info" | "warning" | "success"
  capabilityId?: string
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const courseId = scope.course.id
    const insights: Insight[] = []

    const misconception = await sql`
      SELECT topic, COUNT(DISTINCT struggles.student_id) as struggling_count
      FROM (
        SELECT aitc.student_id, aitc.topic, COUNT(*) as q_count
        FROM ai_tutor_conversations aitc
        INNER JOIN students s ON s.id = aitc.student_id
        INNER JOIN sessions sess ON sess.id = s.session_id
        WHERE aitc.topic IS NOT NULL
          AND aitc.created_at >= NOW() - INTERVAL '7 days'
          AND sess.course_id = ${courseId}
        GROUP BY aitc.student_id, aitc.topic
        HAVING COUNT(*) >= 4
      ) as struggles
      GROUP BY topic
      ORDER BY struggling_count DESC
      LIMIT 1
    `.catch(() => [])

    if (misconception.length > 0 && Number(misconception[0].struggling_count) > 0) {
      insights.push({
        id: "struggle-topic",
        title: "Students struggling this week",
        body: `${misconception[0].struggling_count} students asked repeated questions about "${misconception[0].topic}". Consider a review activity or improved practice.`,
        severity: "warning",
        capabilityId: "analyze",
      })
    }

    const peakTime = await sql`
      SELECT EXTRACT(HOUR FROM aitc.created_at) as hour, COUNT(*) as count
      FROM ai_tutor_conversations aitc
      INNER JOIN students s ON s.id = aitc.student_id
      INNER JOIN sessions sess ON sess.id = s.session_id
      WHERE aitc.created_at >= NOW() - INTERVAL '7 days'
        AND sess.course_id = ${courseId}
      GROUP BY EXTRACT(HOUR FROM aitc.created_at)
      ORDER BY count DESC
      LIMIT 1
    `.catch(() => [])

    if (peakTime.length > 0) {
      const hour = Number(peakTime[0].hour)
      insights.push({
        id: "cora-peak",
        title: "Peak Cora usage",
        body: `Most student AI questions happen around ${hour}:00–${hour + 1}:00. Consider aligning office hours or announcements.`,
        severity: "info",
        capabilityId: "insights",
      })
    }

    if (insights.length === 0) {
      insights.push({
        id: "welcome",
        title: "Teaching copilot ready",
        body: "Ask Cora to create assessments, improve quizzes, or analyze results. Insights will appear as your course accumulates activity.",
        severity: "success",
        capabilityId: "assistant",
      })
    }

    return NextResponse.json({ insights })
  } catch (error) {
    console.error("[instructor/cora/insights]", error)
    return NextResponse.json({ insights: [] })
  }
}
