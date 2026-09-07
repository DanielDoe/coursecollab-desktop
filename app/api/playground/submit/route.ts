import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"
import { verifyAnswerLocally, canVerifyLocally } from "@/lib/local-answer-verification"
import { syncPlaygroundEngagementByResultId } from "@/lib/playground-engagement-sync"
import { markPlaygroundResultComplete } from "@/lib/playground-result-complete"
import {
  getPlaygroundSessionByResultId,
  isClassroomSessionEnded,
  PLAYGROUND_SESSION_ENDED_MESSAGE,
} from "@/lib/playground-session-guard"
import { computePlaygroundAnswerPoints } from "@/lib/playground-scoring"
import {
  playgroundScoringFromPolicy,
} from "@/lib/playground-policy-settings"
import { getPlaygroundPolicyForCourse } from "@/lib/playground-policy-settings.server"
import { parsePlaygroundCorrectLetters } from "@/lib/playground-question-utils"
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

    // Get the full question data from question bank for proper evaluation
    // questionId here is playground_question_id, we need to get the actual question_bank question
    let isCorrect = false
    let questionType = 'mcq'
    let resolvedCorrectAnswer: unknown = null

    try {
      // Query question bank with JSONB options and correct_answer
      await ensurePlaygroundQuestionSnapshotColumns()
      const playgroundQuestion = await sql`
        SELECT 
          qb.id, 
          qb.question_type, 
          qb.correct_answer,
          qb.options,
          pq.snapshot_question_type,
          pq.snapshot_options,
          pq.snapshot_correct_answer
        FROM playground_questions pq
        JOIN question_bank qb ON pq.bank_question_id = qb.id
        WHERE pq.id = ${questionId}
      `

      if (playgroundQuestion.length > 0) {
        const question = playgroundQuestion[0]
        const snapshotType = typeof question.snapshot_question_type === "string"
          ? question.snapshot_question_type
          : ""
        questionType = (snapshotType || question.question_type)?.toLowerCase() || 'mcq'

        let optionsArray: any[] = []
        let correctAnswerValue: string | string[] = ''
        const optionsSource = question.snapshot_options ?? question.options
        const correctSource = question.snapshot_correct_answer || question.correct_answer

        if (optionsSource) {
          try {
            const parsedOptions = typeof optionsSource === 'string' 
              ? JSON.parse(optionsSource) 
              : optionsSource
            
            if (Array.isArray(parsedOptions)) {
              optionsArray = parsedOptions.map((opt: any) => {
                if (typeof opt === 'string') return opt
                if (opt && typeof opt === 'object' && opt.text) return opt.text
                return String(opt)
              })
            }
          } catch (e) {
            // Error parsing options
          }
        }

        if (correctSource) {
          try {
            const parsedCorrect = typeof correctSource === 'string'
              ? JSON.parse(correctSource)
              : correctSource
            
            if (Array.isArray(parsedCorrect)) {
              correctAnswerValue = parsedCorrect
            } else {
              correctAnswerValue = String(parsedCorrect)
            }
          } catch (e) {
            correctAnswerValue = String(correctSource)
          }
        }

        // Build options object with letters (A, B, C, D, E)
        const optionsObject: Record<string, string> = {}
        optionsArray.forEach((opt, index) => {
          const letter = String.fromCharCode(65 + index) // A, B, C, D, E
          optionsObject[letter] = String(opt)
        })

        // For MCQ and true_false, correct_answer might be stored as:
        // 1. Option letter (A, B, C, D, E)
        // 2. Full option text
        // 3. Index (0, 1, 2, 3, 4)
        const normalizedType = questionType.toLowerCase().replace(/[_-]/g, "")
        const isSelectAll = normalizedType === "selectall" || normalizedType === "multipleselect"

        let normalizedCorrectAnswer: string | string[] = Array.isArray(correctAnswerValue)
          ? parsePlaygroundCorrectLetters(correctAnswerValue)
          : correctAnswerValue

        if (!isSelectAll) {
          let normalizedSingle = String(normalizedCorrectAnswer)

          // If correct_answer is a number (index), convert to letter
          if (!isNaN(Number(normalizedSingle)) && optionsArray.length > 0) {
            const index = parseInt(normalizedSingle)
            if (index >= 0 && index < optionsArray.length) {
              normalizedSingle = String.fromCharCode(65 + index)
            }
          }
          // If correct_answer is full option text, find the matching letter
          else if (
            normalizedSingle.length > 2 &&
            !["A", "B", "C", "D", "E"].includes(normalizedSingle.toUpperCase())
          ) {
            const matchingIndex = optionsArray.findIndex(
              (opt) =>
                String(opt).toLowerCase().trim() === normalizedSingle.toLowerCase().trim(),
            )
            if (matchingIndex >= 0) {
              normalizedSingle = String.fromCharCode(65 + matchingIndex)
            }
          }
          normalizedCorrectAnswer = normalizedSingle
        } else if (!Array.isArray(normalizedCorrectAnswer)) {
          normalizedCorrectAnswer = parsePlaygroundCorrectLetters(normalizedCorrectAnswer)
        }

        let studentAnswer: string | string[] = selectedAnswer || ""
        if (isSelectAll && typeof studentAnswer === "string") {
          try {
            const parsed = JSON.parse(studentAnswer)
            studentAnswer = Array.isArray(parsed)
              ? parsed.map((entry) => String(entry).trim().toUpperCase())
              : [String(studentAnswer).trim().toUpperCase()]
          } catch {
            studentAnswer = studentAnswer
              ? [String(studentAnswer).trim().toUpperCase()]
              : []
          }
        }

        // Use the same evaluation logic as assessments
        if (canVerifyLocally(questionType)) {
          const questionData = {
            correctAnswer: normalizedCorrectAnswer,
            options: optionsObject,
          }

          const verificationResult = verifyAnswerLocally(questionType, studentAnswer, questionData)
          isCorrect = verificationResult.isCorrect
          resolvedCorrectAnswer = normalizedCorrectAnswer
        } else {
          // Fallback to simple comparison for unsupported types
          isCorrect = String(selectedAnswer || '').toLowerCase().trim() === String(normalizedCorrectAnswer || '').toLowerCase().trim()
        }
      } else {
        return NextResponse.json({ error: "Question not found" }, { status: 404 })
      }
    } catch (queryError: any) {
      console.error("[playground/submit] question lookup failed:", queryError)
      return NextResponse.json({ error: "Failed to evaluate answer" }, { status: 500 })
    }

    let points = 0
    if (isCorrect) {
      const actualResponseTime = responseTimeMs || timeTaken * 1000
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
      points = computePlaygroundAnswerPoints(
        true,
        actualResponseTime,
        playgroundScoringFromPolicy(policy),
      )
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
