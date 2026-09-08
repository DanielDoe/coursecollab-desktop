import { type NextRequest, NextResponse } from "next/server"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { sql } from "@/lib/db"

import { createNotification } from "@/lib/create-notification"
import { verifyAnswerLocally, canVerifyLocally } from "@/lib/local-answer-verification"


export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    const { quizId, answers, score, totalQuestions } = await request.json()
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response
    const studentId = auth.studentDbId

    const quizResult = await sql`
      SELECT title FROM user_quizzes WHERE id = ${quizId}
    `
    const quizTitle = quizResult[0]?.title || "Quiz"

    // Create attempt record
    const attemptResult = await sql`
      INSERT INTO user_quiz_attempts (user_quiz_id, student_id, score, total_questions, completed_at)
      VALUES (${quizId}, ${studentId}, ${score}, ${totalQuestions}, CURRENT_TIMESTAMP)
      RETURNING id
    `

    const attemptId = attemptResult[0].id

    // Save individual answers
    for (const [questionId, selectedAnswer] of Object.entries(answers)) {
      // Get correct answer and question details
      const questionResult = await sql`
        SELECT correct_answer, question_type, option_a, option_b, option_c, option_d, option_e
        FROM user_quiz_questions
        WHERE id = ${questionId}
      `

      const question = questionResult[0]
      if (!question) continue

      let isCorrect = false
      
      // Use local verification if possible
      if (canVerifyLocally(question.question_type)) {
        const questionData = {
          correctAnswer: question.correct_answer,
          options: {
            A: question.option_a,
            B: question.option_b,
            C: question.option_c,
            D: question.option_d,
            E: question.option_e
          }
        }
        
        const result = verifyAnswerLocally(question.question_type, selectedAnswer, questionData)
        isCorrect = result.isCorrect
      } else {
        // Fallback to simple comparison
        isCorrect = question.correct_answer === selectedAnswer
      }

      await sql`
        INSERT INTO user_quiz_answers (attempt_id, question_id, selected_answer, is_correct)
        VALUES (${attemptId}, ${questionId}, ${selectedAnswer}, ${isCorrect})
      `
    }

    const percentage = Math.round((score / totalQuestions) * 100)

    let congratsMessage = ""
    if (percentage >= 90) {
      congratsMessage = "🎉 Outstanding performance!"
    } else if (percentage >= 80) {
      congratsMessage = "🌟 Great job!"
    } else if (percentage >= 70) {
      congratsMessage = "👍 Good work!"
    } else {
      congratsMessage = "Keep practicing!"
    }

    await createNotification({
      studentId,
      type: "quiz",
      title: `Quiz Completed: ${quizTitle}`,
      message: `${congratsMessage} You scored ${score}/${totalQuestions} (${percentage}%)`,
      link: `/student/results/${attemptId}`,
    })

    const { createAdminNotification } = await import("@/lib/create-admin-notification")
    const studentInfo = await sql`
      SELECT full_name, student_id FROM students WHERE id = ${studentId}
    `

    await createAdminNotification({
      type: "quiz_submission",
      title: "Student Completed Quiz",
      message: `${studentInfo[0]?.full_name || "Student"} completed "${quizTitle}" with ${percentage}% (${score}/${totalQuestions})`,
      link: `/admin/results/${attemptId}`,
    })

    return NextResponse.json({ success: true, attemptId })
  } catch (error) {
    console.error("[v0] Failed to submit quiz:", error)
    return NextResponse.json({ error: "Failed to submit quiz" }, { status: 500 })
  }
}
