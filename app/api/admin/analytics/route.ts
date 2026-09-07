import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const searchParams = request.nextUrl.searchParams
    const quizId = searchParams.get("quiz_id")

    // Overall stats
    const overallStatsQuery = quizId
      ? sql`
          SELECT 
            COUNT(DISTINCT q.id) as total_quizzes,
            COUNT(DISTINCT a.id) as total_attempts,
            COALESCE(AVG(a.score), 0) as avg_score,
            COUNT(DISTINCT a.student_id) as total_students
          FROM quizzes q
          LEFT JOIN attempts a ON q.id = a.quiz_id
          WHERE q.id = ${quizId}
        `
      : sql`
          SELECT 
            COUNT(DISTINCT q.id) as total_quizzes,
            COUNT(DISTINCT a.id) as total_attempts,
            COALESCE(AVG(a.score), 0) as avg_score,
            COUNT(DISTINCT a.student_id) as total_students
          FROM quizzes q
          LEFT JOIN attempts a ON q.id = a.quiz_id
        `

    const overallStats = await overallStatsQuery

    // Quiz analytics
    const quizAnalyticsQuery = quizId
      ? sql`
          SELECT 
            q.id as quiz_id,
            q.title as quiz_title,
            COUNT(DISTINCT a.id) as total_attempts,
            COALESCE(AVG(a.score), 0) as avg_score,
            COALESCE(AVG(CASE WHEN a.completed_at IS NOT NULL THEN 100 ELSE 0 END), 0) as completion_rate,
            COALESCE(AVG(EXTRACT(EPOCH FROM (a.completed_at - a.started_at))), 0) as avg_time_spent
          FROM quizzes q
          LEFT JOIN attempts a ON q.id = a.quiz_id
          WHERE q.id = ${quizId}
          GROUP BY q.id, q.title
          ORDER BY total_attempts DESC
        `
      : sql`
          SELECT 
            q.id as quiz_id,
            q.title as quiz_title,
            COUNT(DISTINCT a.id) as total_attempts,
            COALESCE(AVG(a.score), 0) as avg_score,
            COALESCE(AVG(CASE WHEN a.completed_at IS NOT NULL THEN 100 ELSE 0 END), 0) as completion_rate,
            COALESCE(AVG(EXTRACT(EPOCH FROM (a.completed_at - a.started_at))), 0) as avg_time_spent
          FROM quizzes q
          LEFT JOIN attempts a ON q.id = a.quiz_id
          GROUP BY q.id, q.title
          ORDER BY total_attempts DESC
        `

    const quizAnalytics = await quizAnalyticsQuery

    // Question analytics
    const questionAnalyticsQuery = quizId
      ? sql`
          SELECT 
            ques.id as question_id,
            ques.question_text,
            q.title as quiz_title,
            COUNT(ar.id) as total_attempts,
            SUM(CASE WHEN ar.is_correct THEN 1 ELSE 0 END) as correct_count,
            SUM(CASE WHEN NOT ar.is_correct THEN 1 ELSE 0 END) as incorrect_count,
            COALESCE(AVG(CASE WHEN ar.is_correct THEN 100 ELSE 0 END), 0) as accuracy_rate,
            COALESCE(AVG(ar.time_spent), 0) as avg_time_spent,
            CASE 
              WHEN COALESCE(AVG(CASE WHEN ar.is_correct THEN 100 ELSE 0 END), 0) >= 70 THEN 'Easy'
              WHEN COALESCE(AVG(CASE WHEN ar.is_correct THEN 100 ELSE 0 END), 0) >= 40 THEN 'Medium'
              ELSE 'Hard'
            END as difficulty_level
          FROM questions ques
          JOIN quizzes q ON ques.quiz_id = q.id
          LEFT JOIN attempt_responses ar ON ques.id = ar.question_id
          WHERE q.id = ${quizId}
          GROUP BY ques.id, ques.question_text, q.title
          ORDER BY accuracy_rate ASC
        `
      : sql`
          SELECT 
            ques.id as question_id,
            ques.question_text,
            q.title as quiz_title,
            COUNT(ar.id) as total_attempts,
            SUM(CASE WHEN ar.is_correct THEN 1 ELSE 0 END) as correct_count,
            SUM(CASE WHEN NOT ar.is_correct THEN 1 ELSE 0 END) as incorrect_count,
            COALESCE(AVG(CASE WHEN ar.is_correct THEN 100 ELSE 0 END), 0) as accuracy_rate,
            COALESCE(AVG(ar.time_spent), 0) as avg_time_spent,
            CASE 
              WHEN COALESCE(AVG(CASE WHEN ar.is_correct THEN 100 ELSE 0 END), 0) >= 70 THEN 'Easy'
              WHEN COALESCE(AVG(CASE WHEN ar.is_correct THEN 100 ELSE 0 END), 0) >= 40 THEN 'Medium'
              ELSE 'Hard'
            END as difficulty_level
          FROM questions ques
          JOIN quizzes q ON ques.quiz_id = q.id
          LEFT JOIN attempt_responses ar ON ques.id = ar.question_id
          GROUP BY ques.id, ques.question_text, q.title
          HAVING COUNT(ar.id) > 0
          ORDER BY accuracy_rate ASC
          LIMIT 20
        `

    const questionAnalytics = await questionAnalyticsQuery

    // Session analytics
    const sessionAnalyticsQuery = sql`
      SELECT 
        s.code as session_code,
        COUNT(DISTINCT st.id) as total_students,
        COUNT(DISTINCT a.id) as total_attempts,
        COALESCE(AVG(a.score), 0) as avg_score,
        COUNT(DISTINCT qa.quiz_id) as active_quizzes
      FROM sessions s
      LEFT JOIN students st ON s.id = st.session_id
      LEFT JOIN attempts a ON st.id = a.student_id
      LEFT JOIN quiz_access qa ON s.code = qa.session_code AND qa.is_active = true
      GROUP BY s.id, s.code
      ORDER BY s.code
    `

    const sessionAnalytics = await sessionAnalyticsQuery

    return NextResponse.json({
      overallStats: overallStats[0] || {
        total_quizzes: 0,
        total_attempts: 0,
        avg_score: 0,
        total_students: 0,
      },
      quizAnalytics: quizAnalytics.map((q) => ({
        ...q,
        total_attempts: Number(q.total_attempts),
        avg_score: Number(q.avg_score),
        completion_rate: Number(q.completion_rate),
        avg_time_spent: Number(q.avg_time_spent),
      })),
      questionAnalytics: questionAnalytics.map((q) => ({
        ...q,
        total_attempts: Number(q.total_attempts),
        correct_count: Number(q.correct_count),
        incorrect_count: Number(q.incorrect_count),
        accuracy_rate: Number(q.accuracy_rate),
        avg_time_spent: Number(q.avg_time_spent),
      })),
      sessionAnalytics: sessionAnalytics.map((s) => ({
        ...s,
        total_students: Number(s.total_students),
        total_attempts: Number(s.total_attempts),
        avg_score: Number(s.avg_score),
        active_quizzes: Number(s.active_quizzes),
      })),
    })
  } catch (error) {
    console.error("[v0] Failed to fetch analytics:", error)
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 })
  }
}
