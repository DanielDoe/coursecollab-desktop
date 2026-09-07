import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAssessmentConfig, type AssessmentType } from "@/lib/assessment-core/db"
import { evaluateAssessmentAnswer } from "@/lib/assessment-core/evaluate"

export const dynamic = 'force-dynamic'

/**
 * POST /api/[assessmentType]/reevaluate
 * 
 * Re-evaluate all answers for an assessment or specific questions
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { assessmentType: string } }
) {
  try {
    const assessmentType = params.assessmentType as AssessmentType
    
    // Validate assessment type
    const validTypes: AssessmentType[] = ['quiz', 'homework', 'midsem', 'final', 'practice', 'points']
    if (!validTypes.includes(assessmentType)) {
      return NextResponse.json(
        { error: `Invalid assessment type: ${assessmentType}` },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { assessmentId, questionIds, studentIds, attemptIds } = body

    if (!assessmentId) {
      return NextResponse.json(
        { error: "Assessment ID is required" },
        { status: 400 }
      )
    }

    const config = getAssessmentConfig(assessmentType)

    // Get attempts to re-evaluate
    let attemptsQuery = sql`
      SELECT DISTINCT att.id, att.student_id
      FROM ${sql.unsafe(config.attemptsTable)} att
      WHERE att.${sql.unsafe(config.idColumn)} = ${Number(assessmentId)}
    `

    if (attemptIds && Array.isArray(attemptIds) && attemptIds.length > 0) {
      attemptsQuery = sql`
        SELECT DISTINCT att.id, att.student_id
        FROM ${sql.unsafe(config.attemptsTable)} att
        WHERE att.id = ANY(${attemptIds})
      `
    } else if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
      attemptsQuery = sql`
        SELECT DISTINCT att.id, att.student_id
        FROM ${sql.unsafe(config.attemptsTable)} att
        WHERE att.${sql.unsafe(config.idColumn)} = ${Number(assessmentId)}
        AND att.student_id = ANY(${studentIds})
      `
    }

    const attempts = await attemptsQuery

    let reevaluated = 0
    let errors = 0
    const errorDetails: string[] = []

    for (const attempt of attempts) {
      // Get answers for this attempt
      let answersQuery = sql`
        SELECT ans.*, q.*
        FROM ${sql.unsafe(config.answersTable)} ans
        JOIN ${sql.unsafe(config.questionsTable)} q ON ans.question_id = q.id
        WHERE ans.attempt_id = ${attempt.id}
      `

      if (questionIds && Array.isArray(questionIds) && questionIds.length > 0) {
        answersQuery = sql`
          SELECT ans.*, q.*
          FROM ${sql.unsafe(config.answersTable)} ans
          JOIN ${sql.unsafe(config.questionsTable)} q ON ans.question_id = q.id
          WHERE ans.attempt_id = ${attempt.id}
          AND ans.question_id = ANY(${questionIds})
        `
      }

      const answers = await answersQuery

      for (const answer of answers) {
        try {
          // Parse student answer
          let studentAnswer = answer.selected_answer || answer.answer_data
          try {
            if (typeof studentAnswer === 'string') {
              studentAnswer = JSON.parse(studentAnswer)
            }
          } catch {
            // Keep as string if parsing fails
          }

          // Get question data
          const question = {
            id: answer.question_id,
            question_type: answer.question_type,
            correct_answer: answer.correct_answer,
            option_a: answer.option_a,
            option_b: answer.option_b,
            option_c: answer.option_c,
            option_d: answer.option_d,
            option_e: answer.option_e,
            max_points: answer.max_points || answer.points || 1,
            points: answer.points || answer.max_points || 1
          }

          // Re-evaluate the answer
          const result = await evaluateAssessmentAnswer({
            assessmentType,
            attemptId: attempt.id,
            questionId: answer.question_id,
            question,
            studentAnswer,
            questionType: answer.question_type,
            maxPoints: answer.max_points || answer.points || 1
          })

          // Update answer with new evaluation
          await sql`
            UPDATE ${sql.unsafe(config.answersTable)}
            SET 
              is_correct = ${result.isCorrect ?? false},
              points_earned = ${result.pointsEarned},
              feedback = ${result.feedback || null},
              requires_review = ${result.requiresReview || false},
              answered_at = NOW()
            WHERE id = ${answer.id}
          `

          reevaluated++
        } catch (error: any) {
          errors++
          errorDetails.push(`Attempt ${attempt.id}, Question ${answer.question_id}: ${error.message}`)
        }
      }

      // Recalculate attempt score
      const scoreResult = await sql`
        SELECT 
          COUNT(*) as total_questions,
          SUM(points_earned) as total_points,
          COUNT(CASE WHEN is_correct = true THEN 1 END) as correct_count
        FROM ${sql.unsafe(config.answersTable)}
        WHERE attempt_id = ${attempt.id}
      `

      const scoreData = scoreResult[0]
      const newScore = Number(scoreData.correct_count) || 0
      const totalQuestions = Number(scoreData.total_questions) || 0

      await sql`
        UPDATE ${sql.unsafe(config.attemptsTable)}
        SET 
          score = ${newScore},
          total_questions = ${totalQuestions},
          updated_at = NOW()
        WHERE id = ${attempt.id}
      `
    }

    return NextResponse.json({
      success: true,
      reevaluated,
      errors,
      errorDetails: errors > 0 ? errorDetails : undefined
    })
  } catch (error: any) {
    console.error(`[${params.assessmentType} Re-evaluate] Error:`, error)
    return NextResponse.json(
      { error: "Failed to re-evaluate", details: error.message },
      { status: 500 }
    )
  }
}

