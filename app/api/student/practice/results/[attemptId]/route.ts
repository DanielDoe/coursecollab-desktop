import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requirePracticeAttemptOwnership } from "@/lib/require-student-practice-auth"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  try {
    const { attemptId: attemptIdStr } = await params
    const attemptId = Number.parseInt(attemptIdStr)
    const auth = await requirePracticeAttemptOwnership(request, attemptId)
    if (!auth.ok) return auth.response
    const studentIdHeader = String(auth.studentDbId)

    // Get practice attempt details
    const attemptResult = await sql`
      SELECT 
        pa.*,
        EXTRACT(EPOCH FROM (pa.completed_at - pa.started_at))/60 as duration_minutes
      FROM practice_attempts pa
      WHERE pa.id = ${attemptId} AND pa.student_id = ${auth.studentDbId}
    `

    if (attemptResult.length === 0) {
      return NextResponse.json({ error: "Practice attempt not found" }, { status: 404 })
    }

    const attempt = attemptResult[0]

    // Get individual answer results
    const answersResult = await sql`
      SELECT 
        pa.bank_question_id,
        qb.question_text,
        pa.student_answer,
        qb.correct_answer,
        pa.is_correct,
        qb.difficulty,
        qb.topic,
        qb.options,
        qb.question_type
      FROM practice_answers pa
      JOIN question_bank qb ON pa.bank_question_id = qb.id
      WHERE pa.attempt_id = ${attemptId}
      ORDER BY pa.id
    `

    // Transform the results
    const answers = answersResult.map(answer => {
      // Convert JSONB options to individual option fields
      let options = []
      try {
        // If options is already an object/array (from JSONB), use it directly; otherwise parse it
        if (typeof answer.options === 'string') {
          options = JSON.parse(answer.options || "[]")
        } else if (Array.isArray(answer.options)) {
          options = answer.options
        }
      } catch (e) {
        console.error("[Practice Results] Error parsing options:", e)
        options = []
      }

      // Options are stored as simple strings in an array, not objects with 'text' property
      const optionA = options[0] || null
      const optionB = options[1] || null
      const optionC = options[2] || null
      const optionD = options[3] || null
      const optionE = options[4] || null

      return {
        question_id: answer.bank_question_id,
        question_text: answer.question_text,
        selected_answer: typeof answer.student_answer === 'string' 
          ? answer.student_answer 
          : JSON.parse(answer.student_answer || '""'),
        correct_answer: answer.correct_answer,
        is_correct: answer.is_correct,
        difficulty: answer.difficulty,
        topic: answer.topic,
        option_a: optionA,
        option_b: optionB,
        option_c: optionC,
        option_d: optionD,
        option_e: optionE,
        question_type: answer.question_type
      }
    })

    const result = {
      id: attempt.id,
      score: attempt.score_percentage,
      correct_answers: attempt.correct_answers,
      total_questions: attempt.total_questions,
      topics: attempt.topics || [],
      difficulty: attempt.difficulty,
      completed_at: attempt.completed_at,
      started_at: attempt.started_at,
      duration_minutes: Math.round(attempt.duration_minutes || 0),
      time_spent_seconds: attempt.time_spent_seconds
    }

    // Get student's overall practice statistics
    const studentStats = await sql`
      SELECT 
        COUNT(*)::INTEGER as total_attempts,
        AVG(score_percentage)::NUMERIC(5,2) as avg_score,
        SUM(correct_answers)::INTEGER as total_correct,
        SUM(total_questions)::INTEGER as total_questions_attempted,
        MAX(score_percentage)::NUMERIC(5,2) as best_score
      FROM practice_attempts
      WHERE student_id = ${studentIdHeader}
        AND completed_at IS NOT NULL
    `

    // Get student's leaderboard position and stats
    const leaderboardStats = await sql`
      SELECT 
        pl.*,
        (
          SELECT COUNT(*)::INTEGER + 1
          FROM practice_leaderboard pl2
          WHERE pl2.total_practice_points > pl.total_practice_points
        ) as rank
      FROM practice_leaderboard pl
      WHERE pl.student_id = ${studentIdHeader}
    `

    // Get recent practice history (last 5 attempts)
    const recentAttempts = await sql`
      SELECT 
        id,
        topics,
        score_percentage,
        correct_answers,
        total_questions,
        completed_at,
        time_spent_seconds
      FROM practice_attempts
      WHERE student_id = ${studentIdHeader}
        AND completed_at IS NOT NULL
      ORDER BY completed_at DESC
      LIMIT 5
    `

    // Get topic-wise performance
    const topicPerformance = await sql`
      SELECT 
        topic,
        COUNT(*)::INTEGER as questions_attempted,
        SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::INTEGER as correct_count,
        ROUND(AVG(CASE WHEN is_correct THEN 100 ELSE 0 END)::NUMERIC, 2) as accuracy
      FROM practice_answers pa
      JOIN practice_attempts pat ON pa.attempt_id = pat.id
      JOIN question_bank qb ON pa.bank_question_id = qb.id
      WHERE pat.student_id = ${studentIdHeader}
      GROUP BY topic
      ORDER BY accuracy DESC
    `

    return NextResponse.json({
      result,
      answers,
      studentStats: studentStats[0] || null,
      leaderboardStats: leaderboardStats[0] || null,
      recentAttempts: recentAttempts || [],
      topicPerformance: topicPerformance || []
    })
  } catch (error) {
    console.error("[Practice Results] Failed to fetch results:", error)
    console.error("[Practice Results] Error details:", {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error: error
    })
    return NextResponse.json({ 
      error: "Failed to fetch results",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
