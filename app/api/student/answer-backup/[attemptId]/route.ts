import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAttemptOwnership } from "@/lib/student-api-auth"

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  // Extract attemptId before try block so it's available in catch block
  const { attemptId } = await params
  
  if (!attemptId) {
    return NextResponse.json({ error: "Missing attemptId" }, { status: 400 })
  }
  
  try {
    const attemptIdNum = parseInt(attemptId, 10)

    const ownership = await requireAttemptOwnership(request, attemptIdNum)
    if (!ownership.ok) return ownership.response

    // Get attempt's quiz_id and current question count (for "missing" calculation)
    const attemptInfo = await sql`
      SELECT 
        qa.quiz_id,
        COUNT(DISTINCT qq.id) as total_questions
      FROM quiz_attempts qa
      JOIN quiz_questions qq ON qq.quiz_id = qa.quiz_id
      WHERE qa.id = ${attemptIdNum}
      GROUP BY qa.quiz_id
    `
    const totalQuestions = attemptInfo.length > 0 ? parseInt(String(attemptInfo[0].total_questions), 10) || 0 : 0

    // Get ALL primary storage answers for this attempt (quiz_answers).
    // Use LEFT JOIN so we include answers even when question_id no longer exists in quiz_questions
    // (e.g. after questions were replaced — answers are still stored and must be counted).
    const primaryAnswers = await sql`
      SELECT 
        qa.id,
        qa.question_id,
        qa.selected_answer,
        qa.answer_data,
        qa.is_correct,
        qa.points_earned,
        qa.answered_at,
        qq.question_text,
        qq.question_order,
        qq.question_type
      FROM quiz_answers qa
      LEFT JOIN quiz_questions qq ON qq.id = qa.question_id AND qq.quiz_id = (SELECT quiz_id FROM quiz_attempts WHERE id = ${attemptIdNum} LIMIT 1)
      WHERE qa.attempt_id = ${attemptIdNum}
      ORDER BY COALESCE(qq.question_order, 999), qa.question_id, qa.id
    `

    // Create comparison map (using primary answers as the source)
    // Include backup object structure for component compatibility
    const comparison = primaryAnswers.map((primary: any) => {
      // Extract answer from answer_data if it contains auto-save info
      let answerValue = primary.selected_answer
      let answerFormat = 'text'
      let submissionMethod = 'manual'
      let autoSaveData = null
      
      if (primary.answer_data) {
        try {
          const data = typeof primary.answer_data === 'string' 
            ? JSON.parse(primary.answer_data) 
            : primary.answer_data
          
          if (data.autoSave) {
            autoSaveData = data
            answerFormat = data.questionType || 'text'
            submissionMethod = 'auto-save'
          }
          
          if (data.answer !== undefined) {
            answerValue = data.answer
          }
        } catch (e) {
          // Use selected_answer if parsing fails
        }
      }

      // Determine if answer is successfully saved (has content)
      const isSuccessfullySaved = answerValue !== null && answerValue !== '' && answerValue !== '[]'

      return {
        questionId: primary.question_id,
        questionOrder: primary.question_order,
        questionText: primary.question_text,
        questionType: primary.question_type,
        backup: {
          id: primary.id,
          rawAnswer: answerValue,
          processedAnswer: answerValue,
          processedAnswerData: primary.answer_data,
          recordedAt: primary.answered_at,
          status: isSuccessfullySaved ? 'saved' : 'empty',
          primaryStorageSuccess: isSuccessfullySaved, // Always true since we're querying primary
          primaryStorageId: primary.id,
          answerFormat: answerFormat,
          submissionMethod: submissionMethod,
          attemptNumber: 1
        },
        primary: {
          id: primary.id,
          selectedAnswer: answerValue,
          answerData: primary.answer_data,
          answeredAt: primary.answered_at,
          isCorrect: primary.is_correct,
          pointsEarned: primary.points_earned
        },
        match: true // All primary answers are "matched" since they're the source
      }
    })

    // Calculate summary statistics (count any row with selected_answer or answer_data.answer)
    const totalPrimaryRecords = primaryAnswers.length
    const successfullySaved = primaryAnswers.filter((p: any) => {
      if (p.selected_answer != null && String(p.selected_answer).trim() !== '') return true
      if (p.answer_data) {
        try {
          const ad = typeof p.answer_data === 'string' ? JSON.parse(p.answer_data) : p.answer_data
          if (ad && typeof ad === 'object' && ad.answer != null) return true
        } catch {
          // ignore
        }
      }
      return false
    }).length
    const missingInPrimary = Math.max(0, totalQuestions - totalPrimaryRecords)

    return NextResponse.json({
      success: true,
      attemptId: parseInt(attemptId),
      backupCount: 0, // No backup table
      primaryCount: totalPrimaryRecords,
      comparison,
      summary: {
        totalBackupRecords: totalPrimaryRecords, // Use primary as "recorded"
        totalPrimaryRecords: totalPrimaryRecords,
        successfullySaved: successfullySaved,
        failedToSave: 0, // All saved answers are in primary
        missingInPrimary: missingInPrimary
      }
    })
  } catch (error) {
    console.error("[Answer Backup] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to retrieve answer data",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

