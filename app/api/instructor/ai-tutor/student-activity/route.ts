import { type NextRequest, NextResponse } from "next/server"
import { inferCoraTopic, loadCoraInsightTurns, resolveInsightScope } from "@/lib/cora/instructor-cora-insights"
import { listConsentedStudentIds } from "@/lib/cora/instructor-share-consent"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { instructorId, courseId } = await resolveInsightScope(request)
  if (!instructorId) {
    return NextResponse.json({ error: "Unauthorized", students: [] }, { status: 401 })
  }
  try {
    const turns = await loadCoraInsightTurns({ instructorId, courseId })
    const consented = await listConsentedStudentIds(turns.map((turn) => turn.studentId))
    const byStudent = new Map<
      number,
      {
        id: number
        full_name: string
        student_id: string
        questions_asked: number
        last_active: Date
        topics: Map<string, number>
      }
    >()
    for (const turn of turns) {
      if (!consented.has(turn.studentId)) continue
      const row = byStudent.get(turn.studentId) ?? {
        id: turn.studentId,
        full_name: turn.studentName,
        student_id: turn.studentCode,
        questions_asked: 0,
        last_active: turn.createdAt,
        topics: new Map<string, number>(),
      }
      row.questions_asked += 1
      if (turn.createdAt > row.last_active) row.last_active = turn.createdAt
      const topic = inferCoraTopic(turn.message, turn.topic)
      if (topic !== "Course help") row.topics.set(topic, (row.topics.get(topic) ?? 0) + 1)
      byStudent.set(turn.studentId, row)
    }

    const students = [...byStudent.values()]
      .sort((a, b) => b.questions_asked - a.questions_asked)
      .slice(0, 100)
      .map((row) => {
        const weak_topics = [...row.topics.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([topic]) => topic)
        return {
          id: row.id,
          full_name: row.full_name,
          student_id: row.student_id,
          session_code: "",
          questions_asked: row.questions_asked,
          last_active: row.last_active.toLocaleString(),
          avg_satisfaction: 0,
          weak_topics,
          trend: row.questions_asked > 8 ? "up" : row.questions_asked < 3 ? "down" : "stable",
        }
      })

    return NextResponse.json({ students })
  } catch (error) {
    console.error("[AI Tutor Student Activity] Error:", error)
    return NextResponse.json({ students: [] })
  }
}
