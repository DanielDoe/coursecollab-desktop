import { NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { corrections } = await request.json()

    if (!corrections || !Array.isArray(corrections)) {
      return NextResponse.json({ error: "Corrections array required" }, { status: 400 })
    }

    if (corrections.length === 0) {
      return NextResponse.json({ success: true, updated: 0 })
    }

    console.log(`[Apply Corrections] Applying ${corrections.length} corrections`)

    // Apply corrections one by one to preserve format integrity
    let successCount = 0
    let errorCount = 0
    const errors = []

    for (const correction of corrections) {
      try {
        const { questionId, suggestedAnswer, questionType, topic, currentAnswer, reasoning, confidence } = correction

        // Format the answer correctly based on question type
        // Note: question_bank uses JSONB for correct_answer
        let formattedAnswer = suggestedAnswer

        if (questionType === 'select_all') {
          // For select_all, store as JSON array
          if (Array.isArray(suggestedAnswer)) {
            formattedAnswer = suggestedAnswer // Store as array for JSONB
          } else if (typeof suggestedAnswer === 'string') {
            try {
              formattedAnswer = JSON.parse(suggestedAnswer)
            } catch {
              formattedAnswer = [suggestedAnswer] // Wrap single value
            }
          } else {
            formattedAnswer = [suggestedAnswer]
          }
        } else {
          // For MCQ and true_false, store as string (JSONB will handle it)
          formattedAnswer = typeof suggestedAnswer === 'string' 
            ? suggestedAnswer.trim().toUpperCase()
            : String(suggestedAnswer).trim().toUpperCase()
        }

        // Validate the formatted answer
        if (questionType === 'select_all') {
          if (!Array.isArray(formattedAnswer)) {
            throw new Error("Select all answer must be an array")
          }
        } else if (['mcq', 'true_false'].includes(questionType)) {
          if (!/^[A-E]$/.test(formattedAnswer)) {
            throw new Error(`Invalid ${questionType} answer: ${formattedAnswer}`)
          }
        }

        // Apply the update
        const result = await sql`
          UPDATE question_bank
          SET correct_answer = ${formattedAnswer}
          WHERE id = ${questionId}
            AND deleted_at IS NULL
          RETURNING id, question_type, correct_answer
        `

        if (result.length > 0) {
          console.log(`[Apply Corrections] ✅ Updated Q${questionId}: ${formattedAnswer}`)
          
          // Save to verification history
          try {
            await sql`
              INSERT INTO ai_verification_history (
                question_id, topic, question_type, old_answer, new_answer,
                ai_reasoning, ai_confidence, verified_by, status
              ) VALUES (
                ${questionId}, ${topic || 'Unknown'}, ${questionType}, 
                ${currentAnswer}, ${formattedAnswer},
                ${reasoning || 'AI suggested correction'}, ${confidence || 'medium'},
                'admin', 'approved'
              )
            `
          } catch (historyError) {
            console.error(`[Apply Corrections] Failed to save history for Q${questionId}:`, historyError)
            // Don't fail the whole operation if history save fails
          }
          
          successCount++
        } else {
          console.log(`[Apply Corrections] ⚠️  Q${questionId}: No rows updated (may be deleted)`)
          errorCount++
          errors.push({ questionId, error: "Question not found or deleted" })
        }

      } catch (error) {
        console.error(`[Apply Corrections] ❌ Error updating Q${correction.questionId}:`, error)
        errorCount++
        errors.push({
          questionId: correction.questionId,
          error: error instanceof Error ? error.message : "Update failed"
        })
      }
    }

    // Also update quiz_questions if these questions are used in quizzes
    for (const correction of corrections) {
      try {
        const { questionId, suggestedAnswer, questionType } = correction

        // Format the answer correctly
        let formattedAnswer = suggestedAnswer
        if (questionType === 'select_all') {
          if (Array.isArray(suggestedAnswer)) {
            formattedAnswer = JSON.stringify(suggestedAnswer)
          } else if (typeof suggestedAnswer === 'string' && !suggestedAnswer.startsWith('[')) {
            formattedAnswer = JSON.stringify([suggestedAnswer])
          }
        } else {
          formattedAnswer = typeof suggestedAnswer === 'string' 
            ? suggestedAnswer.trim().toUpperCase()
            : String(suggestedAnswer).trim().toUpperCase()
        }

        // Update any quiz questions that reference this bank question
        await sql`
          UPDATE quiz_questions
          SET correct_answer = ${formattedAnswer}
          WHERE bank_question_id = ${questionId}
        `

      } catch (error) {
        console.error(`[Apply Corrections] Error updating quiz questions for Q${correction.questionId}:`, error)
        // Don't fail the whole operation if quiz update fails
      }
    }

    console.log(`[Apply Corrections] Complete: ${successCount} updated, ${errorCount} errors`)

    return NextResponse.json({
      success: true,
      updated: successCount,
      errors: errorCount,
      errorDetails: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error("[Apply Corrections] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to apply corrections"
      },
      { status: 500 }
    )
  }
}

