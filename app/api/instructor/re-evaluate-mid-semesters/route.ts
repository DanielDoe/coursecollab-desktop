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
    // Verify instructor or admin authentication
    const instructorSession = request.headers.get("authorization") || request.headers.get("x-instructor-id")
    const adminId = request.headers.get("x-admin-id")

    if (!instructorSession && !adminId) {
      console.log("[Instructor Mid-Semester Re-evaluate] Unauthorized: No instructor or admin credentials")
      return NextResponse.json({ error: "Instructor or admin authentication required" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const examId = searchParams.get("examId")
    const sessionCode = searchParams.get("sessionCode")
    const studentId = searchParams.get("studentId")

    console.log("[Instructor Mid-Semester Re-evaluate] Request params:", { examId, sessionCode, studentId })

    if (!examId && !sessionCode && !studentId) {
      return NextResponse.json({ error: "Must specify examId, sessionCode, or studentId" }, { status: 400 })
    }

    const whereParts = ["qa.completed_at IS NOT NULL", "q.assessment_type = 'mid_semester'"]

    if (examId) whereParts.push(`qa.quiz_id = ${Number.parseInt(examId, 10)}`)
    if (sessionCode) whereParts.push(sectionSqlInClause("TRIM(sess.code)", sessionCode))
    if (studentId) whereParts.push(`s.id = ${Number.parseInt(studentId, 10)}`)

    const whereClause = whereParts.join(" AND ")

    // Fetch attempts (same source as results view)
    const attempts = await sql`
      SELECT 
        qa.id as attempt_id,
        qa.quiz_id,
        qa.student_id,
        s.student_id as student_number,
        s.full_name as student_name,
        s.email as student_email,
        sess.code as session_code
      FROM quiz_attempts qa
      JOIN students s ON s.id = qa.student_id
      JOIN sessions sess ON sess.id = s.session_id
      JOIN quizzes q ON q.id = qa.quiz_id
      WHERE ${sql.unsafe(whereClause)}
      ORDER BY qa.id
    `

    if (attempts.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No completed mid-semester attempts found matching the criteria",
        attemptsProcessed: 0
      })
    }

    console.log("[Instructor Mid-Semester Re-evaluate] Found", attempts.length, "attempts")

    const answerUpdates: any[] = []
    const attemptScores = new Map()
    let changedCount = 0
    let correctCount = 0
    let incorrectCount = 0
    let skippedCount = 0
    let issuesFound = false
    const studentsWithNullAnswers = new Set()
    const correctedAnswers: any[] = []

    // Use answer-centric approach (same as results view) - load answers per attempt, match to questions
    for (const attempt of attempts as any[]) {
      const attemptId = attempt.attempt_id
      const quizId = attempt.quiz_id

      // Load questions for this quiz (ordered)
      const questions = await sql`
        SELECT id as question_id, question_order, question_text, question_type,
               correct_answer, option_a, option_b, option_c, option_d, option_e,
               evaluation_mode, points as question_points
        FROM quiz_questions
        WHERE quiz_id = ${quizId}
        ORDER BY question_order ASC NULLS LAST, id ASC
      `

      // Load ALL answers for this attempt (answer-centric - same as results view)
      const answersForAttempt = await sql`
        SELECT qa.id as answer_id, qa.question_id, qa.selected_answer, qa.answer_data,
               qa.points_earned as old_points_earned, qa.is_correct as old_is_correct,
               qq.question_order
        FROM quiz_answers qa
        LEFT JOIN quiz_questions qq ON qq.id = qa.question_id AND qq.quiz_id = ${quizId}
        WHERE qa.attempt_id = ${attemptId}
        ORDER BY COALESCE(qq.question_order, 999), qa.question_id, qa.id
      `

      const qList = questions as any[]
      const aList = answersForAttempt as any[]
      const questionIds = new Set(qList.map((q: any) => String(q?.question_id ?? '')))
      const byQuestionId = new Map<string, any>()
      const orphaned: any[] = []
      for (const a of aList) {
        const qid = a.question_id != null ? String(a.question_id) : ''
        if (qid && questionIds.has(qid)) {
          byQuestionId.set(qid, a)
        } else {
          orphaned.push(a)
        }
      }
      orphaned.sort((x, y) => (Number(x?.question_order) ?? 999) - (Number(y?.question_order) ?? 999) || (Number(x?.question_id) ?? 0) - (Number(y?.question_id) ?? 0) || (Number(x?.answer_id) ?? 0) - (Number(y?.answer_id) ?? 0))
      let orphanIdx = 0

      let attemptEarnedPoints = 0
      let totalPoints = 0

      for (const q of qList) {
        if (!q) continue
        const qid = q.question_id != null ? String(q.question_id) : ''
        let a = qid ? byQuestionId.get(qid) : null
        if (!a && orphanIdx < orphaned.length) {
          a = orphaned[orphanIdx++]
        }

        totalPoints += Number(q.question_points) || 1

        if (!a) {
          skippedCount++
          studentsWithNullAnswers.add(attempt.student_name)
          issuesFound = true
          continue
        }

        // Extract student answer: selected_answer first, then answer_data.answer (same as results view)
        let studentAnswer: any = a.selected_answer != null && String(a.selected_answer).trim() !== '' ? a.selected_answer : null
        if (studentAnswer == null && a.answer_data) {
          try {
            const ad = typeof a.answer_data === 'string' ? JSON.parse(a.answer_data) : a.answer_data
            if (ad && typeof ad === 'object' && ad.answer != null) {
              studentAnswer = typeof ad.answer === 'string' ? ad.answer : JSON.stringify(ad.answer)
            }
          } catch {
            /* ignore */
          }
        }

        if (studentAnswer == null || (typeof studentAnswer === 'string' && !studentAnswer.trim())) {
          console.log(`[Instructor Mid-Semester Re-evaluate] Skipping question ${q.question_id} for student ${attempt.student_name} - no answer in selected_answer or answer_data`)
          skippedCount++
          studentsWithNullAnswers.add(attempt.student_name)
          issuesFound = true
          continue
        }

        const questionData = {
          correctAnswer: q.correct_answer,
          options: { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d, E: q.option_e }
        }
        const qt = (q.question_type || "").toLowerCase()
        let studentAns: any = studentAnswer
        if (qt === "select_all" || qt === "multi_output") {
          if (Array.isArray(studentAns)) {
            // already array
          } else if (typeof studentAns === "string") {
            try {
              studentAns = JSON.parse(studentAns)
              if (!Array.isArray(studentAns)) studentAns = [studentAnswer]
            } catch {
              studentAns = [studentAnswer]
            }
          } else {
            studentAns = [studentAnswer]
          }
        }
        const result = canVerifyLocally(qt)
          ? verifyAnswerLocally(q.question_type || "", studentAns, questionData)
          : { isCorrect: false, score: 0 }
        const newIsCorrect = result.isCorrect
        const questionPoints = Number(q.question_points) || 1
        const newPointsEarned = parseFloat(((result.score / 100) * questionPoints).toFixed(2))

        if (newIsCorrect) {
          correctCount++
        } else {
          incorrectCount++
        }

        attemptEarnedPoints += newPointsEarned

        const oldPointsEarned = Number(a.old_points_earned) || 0
        if (a.old_is_correct !== newIsCorrect || Math.abs(oldPointsEarned - newPointsEarned) > 0.01) {
          console.log(`[Instructor Mid-Semester Re-evaluate] Score changed for student ${attempt.student_name}, question ${q.question_id}: ${a.old_is_correct}/${oldPointsEarned} → ${newIsCorrect}/${newPointsEarned}`)
          changedCount++
          correctedAnswers.push({
            student: attempt.student_name,
            question: q.question_text,
            oldCorrect: a.old_is_correct,
            newCorrect: newIsCorrect,
            oldPoints: oldPointsEarned,
            newPoints: newPointsEarned,
            answer: studentAnswer
          })
          answerUpdates.push({
            id: a.answer_id,
            isCorrect: newIsCorrect,
            pointsEarned: newPointsEarned
          })
        }
      }

      let finalScore = attemptEarnedPoints
      let storedTotalQuestions = totalPoints
      if (totalPoints > 0) {
        const percentage = (attemptEarnedPoints / totalPoints) * 100
        finalScore = Math.round(percentage * 100) / 100
        storedTotalQuestions = 100
      }

      attemptScores.set(attemptId, {
        score: finalScore,
        totalQuestions: storedTotalQuestions,
        earnedPoints: attemptEarnedPoints,
        totalPoints,
        studentName: attempt.student_name,
        assessmentType: 'mid_semester'
      })
    }

    console.log("[Instructor Mid-Semester Re-evaluate] Processing updates...")
    console.log("[Instructor Mid-Semester Re-evaluate] Answer updates:", answerUpdates.length)
    console.log("[Instructor Mid-Semester Re-evaluate] Attempt scores:", attemptScores.size)

    if (answerUpdates.length > 0) {
      console.log("[Instructor Mid-Semester Re-evaluate] Sample updates:", answerUpdates.slice(0, 5))
      console.log("[Instructor Mid-Semester Re-evaluate] Sample corrections:", correctedAnswers.slice(0, 5))
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

    console.log("[Instructor Mid-Semester Re-evaluate] Re-evaluation complete successfully")

    return NextResponse.json({
      success: true,
      message: `Re-evaluated ${attemptScores.size} mid-semester attempts`,
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
    console.error("[Instructor Mid-Semester Re-evaluate] Error in re-evaluation:", error.message, error.stack)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
