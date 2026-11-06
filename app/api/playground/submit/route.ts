import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"
import { syncPlaygroundEngagementByResultId } from "@/lib/playground-engagement-sync"
import { markPlaygroundResultComplete } from "@/lib/playground-result-complete"
import {
  getPlaygroundSessionByResultId,
  isClassroomSessionEnded,
  PLAYGROUND_SESSION_ENDED_MESSAGE,
} from "@/lib/playground-session-guard"
import { playgroundScoringFromPolicy } from "@/lib/playground-policy-settings"
import { getPlaygroundPolicyForCourse } from "@/lib/playground-policy-settings.server"
import { evaluatePlaygroundAnswer } from "@/lib/playground-answer-evaluation"
import { ensurePlaygroundQuestionSnapshotColumns } from "@/lib/playground-session-question-snapshot"

export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    const bound = await requireBoundStudentCaller(
      request,
      request.headers.get("x-student-id") ?? new URL(request.url).searchParams.get("studentId"),
    )
    if (!bound.ok) return bound.response

    const { resultId, questionId, selectedAnswer, timeTaken, responseTimeMs } = await request.json()

    if (!resultId || !questionId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const owned = await sql`
      SELECT 1
      FROM playground_results pr
      JOIN students s ON s.deleted_at IS NULL
        AND (s.student_id = pr.student_id OR pr.student_id = s.id::text)
      WHERE pr.id = ${Number(resultId)}
        AND s.id = ${bound.studentDbId}
      LIMIT 1
    `
    if (owned.length === 0) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const session = await getPlaygroundSessionByResultId(Number(resultId))
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }
    if (isClassroomSessionEnded(session)) {
      return NextResponse.json(
        { error: PLAYGROUND_SESSION_ENDED_MESSAGE, sessionEnded: true },
        { status: 403 },
      )
    }

    // Grade with the same local path quizzes and practice use.
    // questionId is playground_questions.id; the bank row (or its session snapshot) is the key.
    let isCorrect = false
    let points = 0
    let correctAnswer: string | null = null

    try {
      await ensurePlaygroundQuestionSnapshotColumns()
      const playgroundQuestion = await sql`
        SELECT 
          qb.id, 
          qb.question_text,
          qb.question_type, 
          qb.correct_answer,
          qb.options,
          qb.hint,
          qb.explanation,
          pq.snapshot_question_text,
          pq.snapshot_question_type,
          pq.snapshot_options,
          pq.snapshot_correct_answer
        FROM playground_questions pq
        JOIN question_bank qb ON pq.bank_question_id = qb.id
        WHERE pq.id = ${questionId}
      `

      if (playgroundQuestion.length === 0) {
        return NextResponse.json({ error: "Question not found" }, { status: 404 })
      }

      const courseRow = await sql`
        SELECT ps.course_id
        FROM playground_results pr
        JOIN playground_sessions ps ON ps.id = pr.session_id
        WHERE pr.id = ${resultId}
        LIMIT 1
      `
      const courseId =
        courseRow[0]?.course_id != null ? Number(courseRow[0].course_id) : null
      const policy = await getPlaygroundPolicyForCourse(courseId)
      const actualResponseTime = responseTimeMs || (timeTaken || 0) * 1000
      const evaluation = evaluatePlaygroundAnswer({
        question: playgroundQuestion[0],
        selectedAnswer,
        responseTimeMs: actualResponseTime,
        scoring: playgroundScoringFromPolicy(policy),
      })
      isCorrect = evaluation.isCorrect
      points = evaluation.points
      correctAnswer = evaluation.correctAnswer
    } catch (queryError: any) {
      console.error("[playground/submit] question lookup failed:", queryError)
      return NextResponse.json({ error: "Failed to evaluate answer" }, { status: 500 })
    }

    // Record the answer with precise timing
    // questionId here is the playground_question_id (id from playground_questions table)
    // Use INSERT ... ON CONFLICT DO UPDATE to handle duplicates gracefully
    let isNewAnswer = true
    try {
      // Check if answer already exists to determine if it's new
      const existingCheck = await sql`
        SELECT id, is_correct, response_time_ms
        FROM playground_answers
        WHERE result_id = ${resultId} AND playground_question_id = ${questionId}
        LIMIT 1
      `
      
      isNewAnswer = existingCheck.length === 0

      if (!isNewAnswer) {
        const existing = existingCheck[0] as {
          is_correct: boolean | null
          response_time_ms: number | null
        }
        const resultRows = await sql`
          SELECT score, correct_answers
          FROM playground_results
          WHERE id = ${resultId}
          LIMIT 1
        `
        if (resultRows.length === 0) {
          return NextResponse.json(
            { error: "Attempt not found — rejoin the session.", attemptRevoked: true },
            { status: 404 },
          )
        }
        return NextResponse.json({
          alreadyAnswered: true,
          locked: true,
          isCorrect: Boolean(existing.is_correct),
          points: 0,
          score: Number(resultRows[0].score ?? 0),
          correctAnswers: Number(resultRows[0].correct_answers ?? 0),
        })
      }

      {
        // Insert new answer
        await sql`
          INSERT INTO playground_answers (
            result_id, playground_question_id, selected_answer, is_correct, 
            time_taken_sec, response_time_ms
          )
          VALUES (
            ${resultId}, ${questionId}, ${selectedAnswer || ''}, ${isCorrect}, 
            ${timeTaken || 0}, ${responseTimeMs || (timeTaken || 0) * 1000}
          )
        `
      }
    } catch (insertError: unknown) {
      throw insertError
    }

    // Update the result score
    // Only increment if this is a new answer (not an update)
    let updateResult
    try {
      if (isNewAnswer) {
        // New answer - increment counters
        updateResult = await sql`
          UPDATE playground_results
          SET 
            score = COALESCE(score, 0) + ${points},
            questions_answered = COALESCE(questions_answered, 0) + 1,
            correct_answers = COALESCE(correct_answers, 0) + ${isCorrect ? 1 : 0}
          WHERE id = ${resultId}
          RETURNING score, correct_answers, questions_answered, session_id
        `
      }
    } catch (updateError: any) {
      throw updateError
    }

    if (isNewAnswer && (!updateResult || updateResult.length === 0)) {
      return NextResponse.json(
        { error: "Attempt not found — rejoin the session.", attemptRevoked: true },
        { status: 404 },
      )
    }

    // When this student finishes all session questions, mark their result complete
    if (updateResult && updateResult.length > 0) {
      const result = updateResult[0]
      const sessionId = result.session_id
      
      if (sessionId) {
        try {
          // Get session info to check if all questions are answered
          const sessionInfo = await sql`
            SELECT ps.question_count, COUNT(DISTINCT pq.id) as total_questions
            FROM playground_sessions ps
            LEFT JOIN playground_questions pq ON ps.id = pq.session_id
            WHERE ps.id = ${sessionId}
            GROUP BY ps.id, ps.question_count
          `

          if (sessionInfo.length > 0) {
            const session = sessionInfo[0]
            const totalQuestions = parseInt(session.total_questions || session.question_count || "0")
            const questionsAnswered = parseInt(result.questions_answered || "0")

            // When this student finishes all questions, mark their result complete (do not end the classroom session)
            if (questionsAnswered >= totalQuestions && totalQuestions > 0) {
              const resultUpdate = await markPlaygroundResultComplete(resultId)

              if (resultUpdate.length > 0 && resultUpdate[0].student_id) {
                  try {
                    await syncPlaygroundEngagementByResultId(resultId)
                  } catch {
                    // non-critical
                  }
              }
            }
          }
        } catch (completionError: unknown) {
          // Don't fail the whole request if completion sync fails
        }
      }
    }

    // Sync activity points to Trade Center after every answer submission
    // Get student database ID for sync
    try {
      syncPlaygroundEngagementByResultId(resultId).catch(() => {})
    } catch {
      // Sync error is non-critical
    }

    return NextResponse.json({
      isCorrect,
      points,
      correctAnswer,
      score: updateResult?.[0]?.score != null ? Number(updateResult[0].score) : undefined,
      correctAnswers:
        updateResult?.[0]?.correct_answers != null
          ? Number(updateResult[0].correct_answers)
          : undefined,
    })
  } catch (error: any) {
    return NextResponse.json({ 
      error: "Failed to submit answer",
      details: error.message || "Unknown error"
    }, { status: 500 })
  }
}
