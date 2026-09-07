import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

import { createNotification } from "@/lib/create-notification"


export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const attemptId = params.id

    // Fetch attempt details with student info
    const attemptResult = await sql`
      SELECT 
        qa.id as attempt_id,
        s.full_name as student_name,
        s.student_id,
        s.section,
        q.title as quiz_title,
        qa.score,
        qa.total_questions
      FROM quiz_attempts qa
      JOIN students s ON qa.student_id = s.id
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.id = ${attemptId}
    `

    if (attemptResult.length === 0) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }

    const attempt = attemptResult[0]

    // Fetch all answers for this attempt
    const answers = await sql`
      SELECT 
        qans.id,
        qans.question_id,
        qq.question_text,
        qans.selected_answer,
        qans.is_correct,
        qans.points_earned,
        qans.feedback,
        qans.override_points,
        qans.override_comment
      FROM quiz_answers qans
      JOIN quiz_questions qq ON qans.question_id = qq.id
      WHERE qans.attempt_id = ${attemptId}
      ORDER BY qq.question_order
    `

    const percentage = Math.round((attempt.score / attempt.total_questions) * 100)

    return NextResponse.json({
      attempt_id: attempt.attempt_id,
      student_name: attempt.student_name,
      student_id: attempt.student_id,
      section: attempt.section,
      quiz_title: attempt.quiz_title,
      score: attempt.score,
      total_questions: attempt.total_questions,
      percentage,
      answers,
    })
  } catch (error) {
    console.error("[v0] Failed to fetch attempt data for editing:", error)
    return NextResponse.json({ error: "Failed to fetch attempt data" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const attemptId = params.id
    const { updates } = await request.json()

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({ error: "Invalid updates format" }, { status: 400 })
    }

    // Update each answer
    for (const update of updates) {
      await sql`
        UPDATE quiz_answers
        SET 
          override_points = ${update.overridePoints},
          override_comment = ${update.overrideComment || null},
          reviewed_by = 'admin',
          reviewed_at = NOW()
        WHERE id = ${update.answerId}
      `
    }

    // Recalculate total score
    const scoreResult = await sql`
      SELECT COALESCE(SUM(COALESCE(override_points, points_earned)), 0) as new_score
      FROM quiz_answers
      WHERE attempt_id = ${attemptId}
    `

    const newScore = scoreResult[0].new_score

    // Update attempt score
    await sql`
      UPDATE quiz_attempts
      SET score = ${newScore}
      WHERE id = ${attemptId}
    `

    // Get total questions and student info
    const attemptInfo = await sql`
      SELECT qa.total_questions, qa.student_id, qa.score as old_score, q.title as quiz_title
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.id = ${attemptId}
    `

    const oldScore = attemptInfo[0].old_score
    const totalQuestions = attemptInfo[0].total_questions
    const quizTitle = attemptInfo[0].quiz_title
    const studentId = attemptInfo[0].student_id

    const oldPercentage = Math.round((oldScore / totalQuestions) * 100)
    const newPercentage = Math.round((newScore / totalQuestions) * 100)

    if (oldScore !== newScore) {
      const changeType = newScore > oldScore ? "increased" : "decreased"
      const emoji = newScore > oldScore ? "📈" : "📉"

      await createNotification({
        studentId,
        type: "quiz",
        title: `Grade Updated: ${quizTitle}`,
        message: `${emoji} Your grade has been ${changeType} from ${oldPercentage}% to ${newPercentage}%. Check your updated report for details.`,
        link: `/student/results/${attemptId}`,
      })
    }

    return NextResponse.json({
      success: true,
      newScore,
      totalQuestions: attemptInfo[0].total_questions,
    })
  } catch (error) {
    console.error("[v0] Failed to update attempt:", error)
    return NextResponse.json({ error: "Failed to update attempt" }, { status: 500 })
  }
}
