import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAssessmentConfig, type AssessmentType } from "@/lib/assessment-core/db"

export const dynamic = 'force-dynamic'

/**
 * POST /api/[assessmentType]/bonus-points
 * 
 * Grant bonus points to students for an assessment
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
    const { assessmentId, studentIds, bonusPoints, reason, section } = body

    if (!assessmentId || !bonusPoints) {
      return NextResponse.json(
        { error: "Assessment ID and bonus points are required" },
        { status: 400 }
      )
    }

    const config = getAssessmentConfig(assessmentType)

    // Get attempts to update
    let attemptsQuery = sql`
      SELECT att.id, att.student_id, att.score
      FROM ${sql.unsafe(config.attemptsTable)} att
      JOIN students s ON att.student_id = s.id
      WHERE att.${sql.unsafe(config.idColumn)} = ${Number(assessmentId)}
    `

    if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
      attemptsQuery = sql`
        ${attemptsQuery}
        AND att.student_id = ANY(${studentIds})
      `
    }

    if (section && section !== "all") {
      attemptsQuery = sql`
        ${attemptsQuery}
        AND s.section = ${section}
      `
    }

    const attempts = await attemptsQuery

    let updated = 0
    const updatedStudents: any[] = []

    for (const attempt of attempts) {
      // Update attempt score with bonus points
      const newScore = Number(attempt.score) + Number(bonusPoints)

      await sql`
        UPDATE ${sql.unsafe(config.attemptsTable)}
        SET 
          score = ${newScore},
          updated_at = NOW()
        WHERE id = ${attempt.id}
      `

      // Log bonus points in answer_data (bonus rows use question_id=NULL; no unique constraint applies)
      await sql`
        INSERT INTO ${sql.unsafe(config.answersTable)} (
          attempt_id, question_id, selected_answer, is_correct,
          points_earned, answer_data, feedback, requires_review
        )
        VALUES (
          ${attempt.id}, NULL, 'BONUS', true,
          ${Number(bonusPoints)}, 
          ${JSON.stringify({ type: 'bonus', reason: reason || 'Bonus points granted', granted_at: new Date().toISOString() })}::jsonb,
          ${reason || 'Bonus points granted'}, false
        )
      `

      updated++
      updatedStudents.push({
        studentId: attempt.student_id,
        oldScore: attempt.score,
        newScore
      })
    }

    return NextResponse.json({
      success: true,
      updated,
      bonusPoints: Number(bonusPoints),
      students: updatedStudents
    })
  } catch (error: any) {
    console.error(`[${params.assessmentType} Bonus Points] Error:`, error)
    return NextResponse.json(
      { error: "Failed to grant bonus points", details: error.message },
      { status: 500 }
    )
  }
}

