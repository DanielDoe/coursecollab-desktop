import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireStudentPracticeCaller } from "@/lib/require-student-practice-auth"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStudentPracticeCaller(request)
    if (!auth.ok) return auth.response

    const studentId = auth.studentDbId
    const courseId = auth.ctx.courseId

    // Get total questions practiced
    const totalPracticed = await sql`
      SELECT COUNT(DISTINCT pa.bank_question_id) as total_practiced
      FROM practice_answers pa
      JOIN practice_attempts pat ON pa.attempt_id = pat.id
      WHERE pat.student_id = ${studentId}
    `

    // Get total questions available by topic
    const topicsWithCounts = await sql`
      SELECT 
        topic,
        COUNT(*) as total_questions,
        COUNT(CASE WHEN practiced.bank_question_id IS NOT NULL THEN 1 END) as practiced_count
      FROM question_bank qb
      LEFT JOIN (
        SELECT DISTINCT pa.bank_question_id
        FROM practice_answers pa
        JOIN practice_attempts pat ON pa.attempt_id = pat.id
        WHERE pat.student_id = ${studentId}
      ) practiced ON qb.id = practiced.bank_question_id
      WHERE qb.course_id = ${courseId}
        AND qb.deleted_at IS NULL
      GROUP BY topic
      ORDER BY topic
    `

    // Get recent practice sessions
    const recentSessions = await sql`
      SELECT 
        topics,
        difficulty,
        total_questions,
        correct_answers,
        score_percentage,
        completed_at
      FROM practice_attempts
      WHERE student_id = ${studentId}
        AND completed_at IS NOT NULL
      ORDER BY completed_at DESC
      LIMIT 10
    `

    // Get accuracy by topic
    const topicAccuracy = await sql`
      SELECT 
        qb.topic,
        COUNT(pa.id) as total_attempts,
        COUNT(CASE WHEN pa.is_correct THEN 1 END) as correct_attempts,
        ROUND(
          (COUNT(CASE WHEN pa.is_correct THEN 1 END)::DECIMAL / COUNT(pa.id)) * 100, 2
        ) as accuracy_percentage
      FROM practice_answers pa
      JOIN practice_attempts pat ON pa.attempt_id = pat.id
      JOIN question_bank qb ON pa.bank_question_id = qb.id
      WHERE pat.student_id = ${studentId}
      GROUP BY qb.topic
      ORDER BY accuracy_percentage DESC
    `

    const stats = {
      totalPracticed: totalPracticed[0]?.total_practiced || 0,
      topicsWithCounts,
      recentSessions,
      topicAccuracy
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error("[Practice Stats] Failed to fetch stats:", error)
    return NextResponse.json({ error: "Failed to fetch practice stats" }, { status: 500 })
  }
}
