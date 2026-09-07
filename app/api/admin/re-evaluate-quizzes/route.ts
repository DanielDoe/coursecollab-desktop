import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

import { verifyAnswerLocally, canVerifyLocally } from "@/lib/local-answer-verification"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"


export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { searchParams } = new URL(request.url)
    const quizId = searchParams.get("quizId")
    const sessionCode = searchParams.get("sessionCode")

    if (!quizId && !sessionCode) {
      return NextResponse.json({ error: "Must specify quizId or sessionCode" }, { status: 400 })
    }

    let data
    const sessionVariants = sessionCode ? normalizedSectionVariantsForSql(sessionCode) : []

    if (quizId && sessionCode) {
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
          qans.id as answer_id,
          qans.selected_answer,
          qans.is_correct as old_is_correct,
          s.student_id,
          s.full_name
        FROM quiz_attempts qa
        JOIN students s ON s.id = qa.student_id
        JOIN sessions sess ON sess.id = s.session_id
        JOIN quiz_questions q ON q.quiz_id = qa.quiz_id
        LEFT JOIN quiz_answers qans ON qans.question_id = q.id AND qans.attempt_id = qa.id
        WHERE qa.completed_at IS NOT NULL 
          AND qa.quiz_id = ${Number.parseInt(quizId)} 
          AND TRIM(sess.code) = ANY(${sessionVariants}::text[])
        ORDER BY qa.id, q.question_order
      `
    } else if (quizId) {
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
          qans.id as answer_id,
          qans.selected_answer,
          qans.is_correct as old_is_correct,
          s.student_id,
          s.full_name
        FROM quiz_attempts qa
        JOIN students s ON s.id = qa.student_id
        JOIN sessions sess ON sess.id = s.session_id
        JOIN quiz_questions q ON q.quiz_id = qa.quiz_id
        LEFT JOIN quiz_answers qans ON qans.question_id = q.id AND qans.attempt_id = qa.id
        WHERE qa.completed_at IS NOT NULL 
          AND qa.quiz_id = ${Number.parseInt(quizId)}
        ORDER BY qa.id, q.question_order
      `
    } else {
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
          qans.id as answer_id,
          qans.selected_answer,
          qans.is_correct as old_is_correct,
          s.student_id,
          s.full_name
        FROM quiz_attempts qa
        JOIN students s ON s.id = qa.student_id
        JOIN sessions sess ON sess.id = s.session_id
        JOIN quiz_questions q ON q.quiz_id = qa.quiz_id
        LEFT JOIN quiz_answers qans ON qans.question_id = q.id AND qans.attempt_id = qa.id
        WHERE qa.completed_at IS NOT NULL 
          AND TRIM(sess.code) = ANY(${sessionVariants}::text[])
        ORDER BY qa.id, q.question_order
      `
    }

    const attemptScores = new Map<number, { correct: number; total: number; studentName: string }>()
    const answerUpdates: Array<{ id: number; isCorrect: boolean }> = []
    const issuesFound: any[] = []
    const studentsWithNullAnswers = new Map<string, { studentName: string; nullCount: number; attemptId: number }>()
    const correctedAnswers: any[] = []

    console.log("[v0] Re-evaluation started, processing", data.length, "rows")
    let correctCount = 0
    let incorrectCount = 0
    let skippedCount = 0
    let changedCount = 0

    for (const row of data) {
      const attemptId = row.attempt_id as number
      const questionText = (row.question_text as string).substring(0, 50)
      const questionType = row.question_type as string
      const correctAnswer = row.correct_answer as string
      const optionA = row.option_a as string
      const optionB = row.option_b as string
      const optionC = row.option_c as string
      const optionD = row.option_d as string
      const optionE = row.option_e as string
      const evaluationMode = row.evaluation_mode as string
      const answerId = row.answer_id as number | null
      const selectedAnswer = row.selected_answer as string | null
      const oldIsCorrect = row.old_is_correct as boolean | null
      const studentName = row.full_name as string
      const studentId = row.student_id as string

      if (!attemptScores.has(attemptId)) {
        attemptScores.set(attemptId, { correct: 0, total: 0, studentName })
      }
      const scoreData = attemptScores.get(attemptId)!
      scoreData.total++

      if (!answerId || !selectedAnswer) {
        skippedCount++

        const key = `${studentId}-${attemptId}`
        if (!studentsWithNullAnswers.has(key)) {
          studentsWithNullAnswers.set(key, { studentName, nullCount: 0, attemptId })
        }
        studentsWithNullAnswers.get(key)!.nullCount++

        console.log(`[v0] NULL ANSWER - Student: ${studentName}, Question: "${questionText}..."`)
        continue
      }

      const questionData = {
        correctAnswer,
        options: { A: optionA, B: optionB, C: optionC, D: optionD, E: optionE }
      }
      const qt = (questionType || "").toLowerCase()
      let studentAns: any = selectedAnswer
      if (qt === "select_all" || qt === "multi_output") {
        if (Array.isArray(selectedAnswer)) {
          studentAns = selectedAnswer
        } else if (typeof selectedAnswer === "string") {
          try {
            studentAns = JSON.parse(selectedAnswer)
            if (!Array.isArray(studentAns)) studentAns = [selectedAnswer]
          } catch {
            studentAns = [selectedAnswer]
          }
        } else {
          studentAns = [selectedAnswer]
        }
      }
      const result = canVerifyLocally(qt)
        ? verifyAnswerLocally(questionType || "", studentAns, questionData)
        : { isCorrect: false }
      const isCorrect = result.isCorrect

      if (oldIsCorrect !== isCorrect) {
        changedCount++
        correctedAnswers.push({
          studentName,
          attemptId,
          question: questionText,
          selected: selectedAnswer,
          wasCorrect: oldIsCorrect,
          nowCorrect: isCorrect,
        })
        console.log(
          `[v0] CORRECTED - ${studentName}: "${questionText}..." | Selected: "${selectedAnswer}" | Was: ${oldIsCorrect} → Now: ${isCorrect}`,
        )
      }

      if (isCorrect) {
        scoreData.correct++
        correctCount++
      } else {
        incorrectCount++
      }

      answerUpdates.push({ id: answerId, isCorrect })
    }

    console.log(
      "[v0] Evaluation complete:",
      correctCount,
      "correct,",
      incorrectCount,
      "incorrect,",
      skippedCount,
      "skipped,",
      changedCount,
      "changed",
    )

    if (studentsWithNullAnswers.size > 0) {
      console.log("[v0] ⚠️  STUDENTS WITH NULL ANSWERS:")
      studentsWithNullAnswers.forEach((data, key) => {
        console.log(`  - ${data.studentName}: ${data.nullCount} unanswered questions (Attempt #${data.attemptId})`)
        issuesFound.push({
          type: "null_answers",
          studentName: data.studentName,
          attemptId: data.attemptId,
          count: data.nullCount,
          message: `${data.nullCount} questions were not answered (timer expired or submission failed)`,
        })
      })
    }

    console.log("[v0] Updating", answerUpdates.length, "answers and", attemptScores.size, "attempts")

    if (answerUpdates.length > 0) {
      const answerIds = answerUpdates.map((u) => u.id)
      const answerCorrectness = answerUpdates.map((u) => u.isCorrect)

      await sql`
        UPDATE quiz_answers
        SET is_correct = updates.is_correct
        FROM (
          SELECT unnest(${answerIds}::int[]) as id, 
                 unnest(${answerCorrectness}::boolean[]) as is_correct
        ) as updates
        WHERE quiz_answers.id = updates.id
      `
    }

    if (attemptScores.size > 0) {
      const attemptIds = Array.from(attemptScores.keys())
      const scores = attemptIds.map((id) => attemptScores.get(id)!.correct)

      console.log("[v0] Final scores being set:", scores)
      console.log("[v0] Score breakdown by student:")
      attemptIds.forEach((id, idx) => {
        const data = attemptScores.get(id)!
        console.log(`  ${data.studentName}: ${scores[idx]}/${data.total}`)
      })

      await sql`
        UPDATE quiz_attempts
        SET score = updates.score
        FROM (
          SELECT unnest(${attemptIds}::int[]) as id, 
                 unnest(${scores}::int[]) as score
        ) as updates
        WHERE quiz_attempts.id = updates.id
      `
    }

    console.log("[v0] Re-evaluation complete successfully")

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
    console.error("[v0] Error in re-evaluation:", error.message, error.stack)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
