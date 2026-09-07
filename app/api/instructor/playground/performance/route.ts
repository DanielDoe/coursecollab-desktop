import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { resolvePlaygroundClassroomInstructorScopeSql } from "@/lib/instructor-default-courses"
import { sqlPlaygroundResultRosterJoinOnScope, sqlPlaygroundResultRosterScope, sqlPlaygroundTermScope } from "@/lib/playground-instructor-scope"



export const dynamic = "force-dynamic"

/**
 * GET - Fetch performance data for playground sessions
 */
export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response
    const psScope = await resolvePlaygroundClassroomInstructorScopeSql(
      "ps",
      scope.course.id,
      scope.instructorId,
      scope.course.course_code,
    )
    const psQScope = await resolvePlaygroundClassroomInstructorScopeSql(
      "ps_q",
      scope.course.id,
      scope.instructorId,
      scope.course.course_code,
    )
    const termScope = await sqlPlaygroundTermScope(request)
    const termScopeQ = await sqlPlaygroundTermScope(request, "ps_q")
    const rosterScopePr = await sqlPlaygroundResultRosterScope(request, scope.course.id, "pr.student_id")
    const rosterJoinPr = await sqlPlaygroundResultRosterJoinOnScope(request, scope.course.id, "pr.student_id")

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("sessionId")

    if (sessionId) {
      // Get detailed performance for a specific session
      // Include completed results OR effectively completed (questions_answered >= question_count)
      const performance = await sql`
        SELECT 
          pr.id as result_id,
          pr.student_id,
          pr.student_name,
          pr.display_name,
          pr.score,
          pr.questions_answered,
          pr.correct_answers,
          pr.completed_at,
          ps.session_code,
          ps.question_count,
          ROUND((pr.correct_answers::NUMERIC / NULLIF(pr.questions_answered, 0)) * 100, 2) as accuracy_percentage
        FROM playground_results pr
        JOIN playground_sessions ps ON pr.session_id = ps.id
        WHERE pr.session_id = ${sessionId}
          AND ps.mode = 'CLASSROOM'
          AND (${psScope})
          ${termScope}
          ${rosterScopePr}
          AND pr.questions_answered > 0
          AND pr.score > 0
          AND (
            pr.completed_at IS NOT NULL
            OR (pr.questions_answered >= COALESCE(ps.question_count, pr.questions_answered))
          )
        ORDER BY pr.score DESC, pr.id ASC
      `

      // Get question-level statistics
      const questionStats = await sql`
        SELECT 
          pq.question_order,
          qb.question_text,
          qb.question_type,
          COUNT(pa.id) as total_answers,
          COUNT(CASE WHEN pa.is_correct THEN 1 END) as correct_answers,
          ROUND(AVG(COALESCE(pa.response_time_ms, pa.time_taken_sec * 1000)), 2) as avg_response_time_ms,
          ROUND((COUNT(CASE WHEN pa.is_correct THEN 1 END)::NUMERIC / NULLIF(COUNT(pa.id), 0)) * 100, 2) as accuracy_percentage
        FROM playground_questions pq
        JOIN question_bank qb ON pq.bank_question_id = qb.id
        JOIN playground_sessions ps_q ON ps_q.id = pq.session_id AND (${psQScope}) ${termScopeQ}
        LEFT JOIN playground_answers pa ON pq.id = COALESCE(pa.playground_question_id, pa.question_id)
        JOIN playground_results pr ON pa.result_id = pr.id
          ${rosterJoinPr}
        WHERE pq.session_id = ${sessionId}
          AND pr.questions_answered > 0
          AND pr.score > 0
          AND (
            pr.completed_at IS NOT NULL
            OR (pr.questions_answered >= COALESCE((SELECT question_count FROM playground_sessions WHERE id = ${sessionId}), pr.questions_answered))
          )
        GROUP BY pq.question_order, qb.question_text, qb.question_type
        ORDER BY pq.question_order
      `
      
      // Calculate accumulated score (total score across all students in this session)
      const accumulatedScoreResult = await sql`
        SELECT COALESCE(SUM(pr.score), 0) as accumulated_score
        FROM playground_results pr
        JOIN playground_sessions ps ON pr.session_id = ps.id
        WHERE pr.session_id = ${sessionId}
          AND ps.mode = 'CLASSROOM'
          AND (${psScope})
          ${termScope}
          ${rosterScopePr}
          AND pr.questions_answered > 0
          AND pr.score > 0
          AND (
            pr.completed_at IS NOT NULL
            OR (pr.questions_answered >= COALESCE(ps.question_count, pr.questions_answered))
          )
      `
      
      // Calculate average response time across all questions
      const avgResponseTimeResult = await sql`
        SELECT ROUND(AVG(COALESCE(pa.response_time_ms, pa.time_taken_sec * 1000)), 2) as avg_response_time_ms
        FROM playground_answers pa
        JOIN playground_results pr ON pa.result_id = pr.id
        JOIN playground_sessions ps ON pr.session_id = ps.id
        WHERE pr.session_id = ${sessionId}
          AND ps.mode = 'CLASSROOM'
          AND (${psScope})
          ${termScope}
          ${rosterScopePr}
          AND pr.questions_answered > 0
          AND pr.score > 0
          AND (
            pr.completed_at IS NOT NULL
            OR (pr.questions_answered >= COALESCE(ps.question_count, pr.questions_answered))
          )
          AND (pa.response_time_ms IS NOT NULL OR pa.time_taken_sec IS NOT NULL)
      `
      
      const accumulatedScore = parseFloat(accumulatedScoreResult[0]?.accumulated_score || "0")
      const sessionScore = accumulatedScore // Session score is the same as accumulated for this session
      const avgScore = performance.length > 0 
        ? performance.reduce((sum: number, p: any) => sum + (p.score || 0), 0) / performance.length 
        : 0
      const avgResponseTimeMs = parseFloat(avgResponseTimeResult[0]?.avg_response_time_ms || "0")

      return NextResponse.json({
        sessionId,
        accumulatedScore,
        sessionScore,
        avgScore: Math.round(avgScore),
        avgResponseTimeMs,
        performance: performance.map((p: any) => ({
          resultId: p.result_id,
          studentId: p.student_id,
          studentName: p.student_name,
          displayName: p.display_name,
          score: p.score,
          questionsAnswered: p.questions_answered,
          correctAnswers: p.correct_answers,
          accuracyPercentage: p.accuracy_percentage,
          completedAt: p.completed_at,
          sessionCode: p.session_code,
        })),
        questionStats: questionStats.map((q: any) => ({
          questionOrder: q.question_order,
          questionText: q.question_text,
          questionType: q.question_type,
          totalAnswers: parseInt(q.total_answers || "0"),
          correctAnswers: parseInt(q.correct_answers || "0"),
          avgResponseTimeMs: parseFloat(q.avg_response_time_ms || "0"),
          accuracyPercentage: parseFloat(q.accuracy_percentage || "0"),
        })),
      })
    } else {
      // Get overall statistics
      const overallStats = await sql`
        SELECT 
          COUNT(DISTINCT ps.id) as total_sessions,
          COUNT(DISTINCT pr.id) as total_participants,
          COUNT(DISTINCT pr.student_id) as unique_students,
          AVG(pr.score) as avg_score,
          AVG(pr.questions_answered) as avg_questions_answered,
          AVG(pr.correct_answers::NUMERIC / NULLIF(pr.questions_answered, 0)) * 100 as avg_accuracy
        FROM playground_sessions ps
        LEFT JOIN playground_results pr ON ps.id = pr.session_id
          ${rosterJoinPr}
        WHERE ps.mode = 'CLASSROOM'
        AND ps.created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
        AND (${psScope})
        ${termScope}
      `

      // Get recent sessions summary
      const recentSessions = await sql`
        SELECT 
          ps.id,
          ps.session_code,
          ps.created_at,
          ps.ended_at,
          ps.is_active,
          COUNT(DISTINCT pr.id) as participant_count,
          AVG(pr.score) as avg_score
        FROM playground_sessions ps
        LEFT JOIN playground_results pr ON ps.id = pr.session_id
          ${rosterJoinPr}
        WHERE ps.mode = 'CLASSROOM'
        AND (${psScope})
        ${termScope}
        GROUP BY ps.id, ps.session_code, ps.created_at, ps.ended_at, ps.is_active
        ORDER BY ps.created_at DESC
        LIMIT 10
      `

      return NextResponse.json({
        overallStats: {
          totalSessions: parseInt(overallStats[0]?.total_sessions || "0"),
          totalParticipants: parseInt(overallStats[0]?.total_participants || "0"),
          uniqueStudents: parseInt(overallStats[0]?.unique_students || "0"),
          avgScore: parseFloat(overallStats[0]?.avg_score || "0"),
          avgQuestionsAnswered: parseFloat(overallStats[0]?.avg_questions_answered || "0"),
          avgAccuracy: parseFloat(overallStats[0]?.avg_accuracy || "0"),
        },
        recentSessions: recentSessions.map((s: any) => ({
          id: s.id,
          sessionCode: s.session_code,
          createdAt: s.created_at,
          endedAt: s.ended_at,
          isActive: s.is_active,
          participantCount: parseInt(s.participant_count || "0"),
          avgScore: parseFloat(s.avg_score || "0"),
        })),
      })
    }
  } catch (error) {
    console.error("[playground/performance]", error)
    return NextResponse.json({ error: "Failed to fetch performance data" }, { status: 500 })
  }
}

