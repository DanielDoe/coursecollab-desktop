import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

import { verifyAnswerLocally, canVerifyLocally } from "@/lib/local-answer-verification"
import { sectionSqlInClause } from "@/lib/session-code-aliases"

/**
 * CRITICAL - Re-evaluation NEVER: deletes quiz_answers, updates selected_answer/answer_data, or updates question_id.
 * Only updates: is_correct, points_earned.
 */
export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    // Verify instructor authentication
    const instructorSession = request.headers.get("authorization") || request.headers.get("x-instructor-id")
    
    if (!instructorSession) {
      console.log("[Instructor Re-evaluate] Unauthorized: No instructor credentials")
      return NextResponse.json({ error: "Instructor authentication required" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const quizId = searchParams.get("quizId")
    const sessionCode = searchParams.get("sessionCode")
    const studentId = searchParams.get("studentId")

    console.log("[Instructor Re-evaluate] Request params:", { quizId, sessionCode, studentId })

    if (!quizId && !sessionCode && !studentId) {
      return NextResponse.json({ error: "Must specify quizId, sessionCode, or studentId" }, { status: 400 })
    }

    let data
    const whereParts: string[] = ["qa.completed_at IS NOT NULL"]

    if (quizId) whereParts.push(`qa.quiz_id = ${Number.parseInt(quizId, 10)}`)
    if (sessionCode) whereParts.push(sectionSqlInClause("TRIM(sess.code)", sessionCode))
    if (studentId) whereParts.push(`s.id = ${Number.parseInt(studentId, 10)}`)

    const whereClause = whereParts.join(" AND ")

    console.log("[Instructor Re-evaluate] Executing query with whereClause:", whereClause)

    data = await sql`
      SELECT 
        qa.id as attempt_id,
        qa.quiz_id,
        q.id as question_id,
        q.question_text,
        q.question_type,
        q.correct_answer,
        q.option_a,
        q.option_b,
        q.option_c,
        q.option_d,
        q.option_e,
        q.evaluation_mode,
        q.points as question_points,
        qans.id as answer_id,
        qans.selected_answer,
        qans.is_correct as old_is_correct,
        qans.points_earned as old_points_earned,
        s.student_id,
        s.full_name,
        s.email as student_email,
        sess.code as session_code
      FROM quiz_attempts qa
      JOIN students s ON s.id = qa.student_id
      JOIN sessions sess ON sess.id = s.session_id
      JOIN quiz_questions q ON q.quiz_id = qa.quiz_id
      LEFT JOIN quiz_answers qans ON qans.question_id = q.id AND qans.attempt_id = qa.id
      WHERE ${sql.unsafe(whereClause)}
      ORDER BY qa.id, q.question_order
    `

    if (data.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No completed quiz attempts found matching the criteria",
        attemptsProcessed: 0
      })
    }

    console.log("[Instructor Re-evaluate] Found", data.length, "rows to re-evaluate")

    // Group by attempt and re-evaluate each answer
    const groupedByAttempt = data.reduce((acc: any, row: any) => {
      const key = row.attempt_id
      if (!acc[key]) {
        acc[key] = {
          studentName: row.full_name,
          studentId: row.student_id,
          studentEmail: row.student_email,
          sessionCode: row.session_code,
          quizId: row.quiz_id,
          assessmentType: 'quiz', // Default to quiz for regular quiz re-evaluation
          total: 0,
          totalPoints: 0,
          earnedPoints: 0,
          answers: []
        }
      }
      acc[key].answers.push(row)
      acc[key].total++
      acc[key].totalPoints += Number(row.question_points) || 1
      return acc
    }, {})

    console.log("[Instructor Re-evaluate] Grouped into", Object.keys(groupedByAttempt).length, "attempts")

    const answerUpdates: any[] = []
    const attemptScores = new Map()
    let changedCount = 0
    let correctCount = 0
    let incorrectCount = 0
    let skippedCount = 0
    let issuesFound = false
    const studentsWithNullAnswers = new Set()
    const correctedAnswers: any[] = []

    for (const [attemptId, attemptData] of Object.entries(groupedByAttempt)) {
      const data = attemptData as any
      let attemptEarnedPoints = 0

      for (const answerRow of data.answers) {
        if (!answerRow.selected_answer) {
          console.log(`[Instructor Re-evaluate] Skipping question ${answerRow.question_id} for student ${data.studentName} - no answer provided`)
          skippedCount++
          studentsWithNullAnswers.add(data.studentName)
          issuesFound = true
          continue
        }

        const questionData = {
          correctAnswer: answerRow.correct_answer,
          options: {
            A: answerRow.option_a,
            B: answerRow.option_b,
            C: answerRow.option_c,
            D: answerRow.option_d,
            E: answerRow.option_e
          }
        }
        const qt = (answerRow.question_type || "").toLowerCase()
        let studentAns: any = answerRow.selected_answer
        if (qt === "select_all" || qt === "multi_output") {
          if (Array.isArray(studentAns)) {
            // already array
          } else if (typeof studentAns === "string") {
            try {
              studentAns = JSON.parse(studentAns)
              if (!Array.isArray(studentAns)) studentAns = [answerRow.selected_answer]
            } catch {
              studentAns = [answerRow.selected_answer]
            }
          } else {
            studentAns = [answerRow.selected_answer]
          }
        }
        const result = canVerifyLocally(qt)
          ? verifyAnswerLocally(answerRow.question_type || "", studentAns, questionData)
          : { isCorrect: false, score: 0 }
        const newIsCorrect = result.isCorrect
        const questionPoints = Number(answerRow.question_points) || 1
        const newPointsEarned = parseFloat(((result.score / 100) * questionPoints).toFixed(2))

        if (newIsCorrect) {
          correctCount++
        } else {
          incorrectCount++
        }

        attemptEarnedPoints += newPointsEarned

        // Check if the correctness or points changed
        const oldPointsEarned = Number(answerRow.old_points_earned) || 0
        if (answerRow.old_is_correct !== newIsCorrect || Math.abs(oldPointsEarned - newPointsEarned) > 0.01) {
          console.log(`[Instructor Re-evaluate] Score changed for student ${data.studentName}, question ${answerRow.question_id}: ${answerRow.old_is_correct}/${oldPointsEarned} → ${newIsCorrect}/${newPointsEarned}`)
          changedCount++
          correctedAnswers.push({
            student: data.studentName,
            question: answerRow.question_text,
            oldCorrect: answerRow.old_is_correct,
            newCorrect: newIsCorrect,
            oldPoints: oldPointsEarned,
            newPoints: newPointsEarned,
            answer: answerRow.selected_answer
          })

          answerUpdates.push({
            id: answerRow.answer_id,
            isCorrect: newIsCorrect,
            pointsEarned: newPointsEarned
          })
        }
      }

      // Calculate final score based on assessment type
      let finalScore = attemptEarnedPoints
      let storedTotalQuestions = data.totalPoints

      if (data.assessmentType === 'mid_semester' && data.totalPoints > 0) {
        // For mid-semester: convert to percentage out of 100
        const percentage = (attemptEarnedPoints / data.totalPoints) * 100
        finalScore = Math.round(percentage * 100) / 100
        storedTotalQuestions = 100
      }

      attemptScores.set(attemptId, {
        score: finalScore,
        totalQuestions: storedTotalQuestions,
        earnedPoints: attemptEarnedPoints,
        totalPoints: data.totalPoints,
        studentName: data.studentName,
        assessmentType: data.assessmentType
      })
    }

    console.log("[Instructor Re-evaluate] Processing updates...")
    console.log("[Instructor Re-evaluate] Answer updates:", answerUpdates.length)
    console.log("[Instructor Re-evaluate] Attempt scores:", attemptScores.size)

    if (answerUpdates.length > 0) {
      console.log("[Instructor Re-evaluate] Sample updates:", answerUpdates.slice(0, 5))
      console.log("[Instructor Re-evaluate] Sample corrections:", correctedAnswers.slice(0, 5))
    }

    // Batch update answers with decimal points
    if (answerUpdates.length > 0) {
      for (const update of answerUpdates) {
        await sql`
          UPDATE quiz_answers
          SET is_correct = ${update.isCorrect},
              points_earned = ${update.pointsEarned}
          WHERE id = ${update.id}
        `
      }
    }

    // Batch update attempt scores with decimal points
    if (attemptScores.size > 0) {
      for (const [attemptId, scoreData] of attemptScores) {
        await sql`
          UPDATE quiz_attempts
          SET score = ${scoreData.score},
              total_questions = ${scoreData.totalQuestions}
          WHERE id = ${attemptId}
        `
      }
    }

    console.log("[Instructor Re-evaluate] Re-evaluation complete successfully")

    return NextResponse.json({
      success: true,
      message: `Re-evaluated ${attemptScores.size} quiz attempts`,
      attemptsProcessed: attemptScores.size,
      answersUpdated: answerUpdates.length,
      answersChanged: changedCount,
      correctAnswers: correctCount,
      incorrectAnswers: incorrectCount,
      skippedQuestions: skippedCount,
      issuesFound: issuesFound,
      studentsWithIssues: Array.from(studentsWithNullAnswers.values()),
      sampleCorrections: correctedAnswers.slice(0, 10),
    })
  } catch (error: any) {
    console.error("[Instructor Re-evaluate] Error in re-evaluation:", error.message, error.stack)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}