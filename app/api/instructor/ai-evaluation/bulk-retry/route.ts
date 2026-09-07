import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { evaluateCode } from "@/lib/ai-evaluate-code"
import { resolveEvaluationLanguageList } from "@/lib/ai-code-languages"
import { ensureAiEvaluationSchema } from "@/lib/ensure-ai-evaluation-schema"
import { requireInstructorGradingAccess } from "@/lib/instructor-grading-auth"
import { resolveReferenceAnswerForAiGrading } from "@/lib/resolve-reference-answer-for-ai"


export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    // Ensure schema exists
    await ensureAiEvaluationSchema(sql)

    const gradingAuth = await requireInstructorGradingAccess(request)
    if (!gradingAuth.ok) return gradingAuth.response

    const body = await request.json()
    const { assessmentType, maxRetries = 50 } = body // Limit to prevent overwhelming the AI service

    console.log(`[Bulk Retry] Starting bulk AI retry for assessment type: ${assessmentType || 'all'}`)

    // Get failed evaluations to retry
    let evaluationsQuery
    if (assessmentType) {
      evaluationsQuery = sql`
        SELECT 
          aeq.id,
          aeq.attempt_id,
          aeq.question_id,
          aeq.student_id,
          aeq.question_type,
          aeq.assessment_type,
          aeq.question_text,
          aeq.student_answer,
          aeq.correct_answer as rubric,
          aeq.max_points,
          aeq.error_type,
          aeq.retry_count,
          s.full_name as student_name,
          s.student_id as student_number
        FROM ai_evaluation_queue aeq
        JOIN students s ON aeq.student_id = s.id
        WHERE aeq.status IN ('pending', 'retried', 'failed')
          AND aeq.assessment_type = ${assessmentType}
        ORDER BY aeq.created_at ASC
        LIMIT ${maxRetries}
      `
    } else {
      evaluationsQuery = sql`
        SELECT 
          aeq.id,
          aeq.attempt_id,
          aeq.question_id,
          aeq.student_id,
          aeq.question_type,
          aeq.assessment_type,
          aeq.question_text,
          aeq.student_answer,
          aeq.correct_answer as rubric,
          aeq.max_points,
          aeq.error_type,
          aeq.retry_count,
          s.full_name as student_name,
          s.student_id as student_number
        FROM ai_evaluation_queue aeq
        JOIN students s ON aeq.student_id = s.id
        WHERE aeq.status IN ('pending', 'retried', 'failed')
        ORDER BY aeq.created_at ASC
        LIMIT ${maxRetries}
      `
    }

    const evaluations = await evaluationsQuery

    if (evaluations.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No failed evaluations found to retry",
        processed: 0,
        successful: 0,
        failed: 0
      })
    }

    console.log(`[Bulk Retry] Found ${evaluations.length} evaluations to retry`)

    let successful = 0
    let failed = 0
    const results = []

    // Process evaluations in batches to avoid overwhelming the AI service
    const batchSize = 5
    for (let i = 0; i < evaluations.length; i += batchSize) {
      const batch = evaluations.slice(i, i + batchSize)
      
      console.log(`[Bulk Retry] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(evaluations.length/batchSize)}`)

      // Process batch in parallel
      const batchPromises = batch.map(async (evaluation) => {
        try {
          // Mark as processing
          await sql`
            UPDATE ai_evaluation_queue
            SET status = 'processing', last_retried_at = NOW()
            WHERE id = ${evaluation.id}
          `

          const [langRow] = await sql`
            SELECT qq.ai_code_language,
                   qq.expected_answer,
                   COALESCE(NULLIF(TRIM(qq.ai_code_language), ''), NULLIF(TRIM(q.code_language), ''), 'cpp') as code_language,
                   q.allowed_ai_code_languages
            FROM quiz_attempts qa
            JOIN quizzes q ON q.id = qa.quiz_id
            JOIN quiz_questions qq ON qq.id = ${evaluation.question_id} AND qq.quiz_id = qa.quiz_id
            WHERE qa.id = ${evaluation.attempt_id}
            LIMIT 1
          `
          const lr = langRow as {
            ai_code_language?: string | null
            expected_answer?: string | null
            code_language?: string
            allowed_ai_code_languages?: unknown
          } | undefined
          const allowedList = resolveEvaluationLanguageList({
            questionAiCodeLanguage: lr?.ai_code_language,
            quizAllowedAiCodeLanguages: lr?.allowed_ai_code_languages,
            quizFallbackCodeLanguage: lr?.code_language,
          })

          const referenceAnswer = resolveReferenceAnswerForAiGrading({
            expected_answer: lr?.expected_answer,
            correct_answer: evaluation.rubric,
          })

          // Call evaluateCode directly (no internal HTTP fetch)
          const aiResult = await evaluateCode({
            questionType: evaluation.question_type || "code_write",
            questionText: evaluation.question_text || "",
            studentAnswer: evaluation.student_answer || "",
            correctAnswer: referenceAnswer ?? evaluation.rubric ?? undefined,
            rubric: evaluation.rubric ?? undefined,
            maxPoints: evaluation.max_points || 100,
            aiEvaluationMode: "relaxed",
            codeLanguage: allowedList[0] || "cpp",
            allowedCodeLanguages: allowedList.length > 1 ? allowedList : undefined,
          })

          if (aiResult.requiresManualReview) {
            // Still requires manual review - update retry count (use 'failed' to match schema)
            await sql`
              UPDATE ai_evaluation_queue
              SET 
                status = 'failed',
                retry_count = retry_count + 1,
                error_message = ${aiResult.feedback || 'Still requires manual review after retry'},
                last_retried_at = NOW()
              WHERE id = ${evaluation.id}
            `
            
            return {
              id: evaluation.id,
              student_name: evaluation.student_name,
              success: false,
              reason: "Still requires manual review"
            }
          } else {
            // AI evaluation succeeded - update the student's answer
            const scorePercentage = aiResult.score || 0
            const pointsEarned = (scorePercentage / 100) * evaluation.max_points

            // Update the quiz answer with the AI evaluation result
            await sql`
              UPDATE quiz_answers
              SET 
                is_correct = ${scorePercentage >= 70},
                ai_feedback = ${JSON.stringify(aiResult)},
                points_earned = ${pointsEarned},
                requires_review = false
              WHERE attempt_id = ${evaluation.attempt_id}
                AND question_id = ${evaluation.question_id}
            `

            // Mark as completed in the queue
            await sql`
              UPDATE ai_evaluation_queue
              SET 
                status = 'completed',
                resolved_at = NOW(),
                retry_count = retry_count + 1
              WHERE id = ${evaluation.id}
            `

            // Recalculate the total score for this quiz attempt
            try {
              const scoreCalculation = await sql`
                SELECT 
                  COUNT(*) as total_questions,
                  SUM(COALESCE(qans.points_earned, 0)) as total_points_earned,
                  COUNT(CASE WHEN qans.is_correct = true THEN 1 END) as correct_answers
                FROM quiz_questions qq
                LEFT JOIN quiz_answers qans ON qq.id = qans.question_id AND qans.attempt_id = ${evaluation.attempt_id}
                WHERE qq.quiz_id = (SELECT quiz_id FROM quiz_attempts WHERE id = ${evaluation.attempt_id})
              `

              const calc = scoreCalculation[0]
              const newTotalScore = parseFloat(calc.total_points_earned || 0)

              await sql`
                UPDATE quiz_attempts
                SET score = ${newTotalScore}
                WHERE id = ${evaluation.attempt_id}
              `

              console.log(`[Bulk Retry] Recalculated total score for attempt ${evaluation.attempt_id}: ${newTotalScore}`)
            } catch (recalcError) {
              console.error(`[Bulk Retry] Failed to recalculate total score for attempt ${evaluation.attempt_id}:`, recalcError)
              // Don't fail the whole operation if recalculation fails
            }

            return {
              id: evaluation.id,
              student_name: evaluation.student_name,
              success: true,
              score: scorePercentage,
              points: pointsEarned
            }
          }

        } catch (error) {
          console.error(`[Bulk Retry] Failed to retry evaluation ${evaluation.id}:`, error)
          
          // Mark as failed
          await sql`
            UPDATE ai_evaluation_queue
            SET 
              status = 'failed',
              retry_count = retry_count + 1,
              error_message = ${error instanceof Error ? error.message : 'Unknown error'},
              last_retried_at = NOW()
            WHERE id = ${evaluation.id}
          `

          return {
            id: evaluation.id,
            student_name: evaluation.student_name,
            success: false,
            reason: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      })

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // Count successes and failures
      batchResults.forEach(result => {
        if (result.success) successful++
        else failed++
      })

      // Add delay between batches to avoid rate limiting
      if (i + batchSize < evaluations.length) {
        await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second delay
      }
    }

    console.log(`[Bulk Retry] Completed: ${successful} successful, ${failed} failed`)

    return NextResponse.json({
      success: true,
      message: `Bulk retry completed: ${successful} successful, ${failed} still need manual review`,
      processed: evaluations.length,
      successful,
      failed,
      results
    })

  } catch (error) {
    console.error("[Bulk Retry] Error:", error)
    return NextResponse.json(
      { 
        error: "Failed to perform bulk retry",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
