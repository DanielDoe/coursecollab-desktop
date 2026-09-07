import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { normalizePracticeStudentAnswer } from "@/lib/save-practice-answer"
import { requirePracticeAttemptOwnership } from "@/lib/require-student-practice-auth"
import { finalizePracticeAttemptFromSavedAnswers } from "@/lib/practice-finalize-from-answers"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  console.log("🔥 [PRACTICE SUBMIT] ===== STARTING SUBMISSION =====")
  
  try {
    const body = await request.json()
    const { attemptId } = body

    if (!attemptId) {
      console.log("🔥 [PRACTICE SUBMIT] ERROR: Missing attemptId")
      return NextResponse.json({ error: "Missing attemptId" }, { status: 400 })
    }

    const auth = await requirePracticeAttemptOwnership(request, Number(attemptId))
    if (!auth.ok) return auth.response
    const studentDbId = auth.studentDbId

    console.log("🔥 [PRACTICE SUBMIT] Request received:", {
      attemptId,
      studentId: studentDbId
    })

    console.log("🔥 [PRACTICE SUBMIT] Reading already-saved answers from database...")

    const finalizeResult = await finalizePracticeAttemptFromSavedAnswers(Number(attemptId), studentDbId)
    if (!finalizeResult.success) {
      console.log("🔥 [PRACTICE SUBMIT] ERROR:", finalizeResult.error)
      return NextResponse.json({ error: finalizeResult.error }, { status: finalizeResult.status })
    }

    const { score, correctCount, totalQuestions } = finalizeResult
    console.log(`🔥 [PRACTICE SUBMIT] Final score: ${correctCount}/${totalQuestions} = ${score}%`)

    const savedAnswers = await sql`
      SELECT 
        pa.*,
        qb.question_text,
        qb.difficulty,
        qb.topic,
        qb.correct_answer
      FROM practice_answers pa
      JOIN question_bank qb ON pa.bank_question_id = qb.id
      WHERE pa.attempt_id = ${attemptId}
    `

    const submittedAnswers = savedAnswers.map((answer) => ({
      question_id: answer.bank_question_id,
      question_text: answer.question_text,
      selected_answer: normalizePracticeStudentAnswer(answer.student_answer),
      correct_answer: answer.correct_answer,
      is_correct: answer.is_correct,
      difficulty: answer.difficulty,
      topic: answer.topic,
    }))

    console.log("🔥 [PRACTICE SUBMIT] Updated attempt")

    // Sync activity points to Trade Center (background, non-blocking)
    try {
      const courseRows = await sql`SELECT course_id FROM students WHERE id = ${studentDbId} LIMIT 1`
      const { getPracticeHubPolicyForCourse } = await import("@/lib/practice-hub-policy-settings.server")
      const hubPolicy = await getPracticeHubPolicyForCourse(
        courseRows[0]?.course_id != null ? Number(courseRows[0].course_id) : null,
      )
      if (hubPolicy.sync_engagement_points) {
        const { syncActivityPointsAfterAction } = await import("@/lib/trade-center-sync")
        const studentSession = request.headers.get("x-student-session") || "ALL"
        await syncActivityPointsAfterAction(studentDbId, studentSession, "practice")
        console.log("🔥 [PRACTICE SUBMIT] Synced practice points to Trade Center")
      }
    } catch (syncError) {
      console.log("🔥 [PRACTICE SUBMIT] Trade Center sync failed (non-critical):", syncError)
    }

    // Generate and save learning report (background, non-blocking)
    try {
      const reportData = await sql`SELECT generate_practice_report(${attemptId}) as report`
      if (reportData[0]?.report) {
        await sql`
          SELECT save_learning_report(
            ${studentDbId}::INTEGER,
            'practice'::VARCHAR,
            ${attemptId}::INTEGER,
            ${reportData[0].report}::JSONB
          )
        `
        console.log("🔥 [PRACTICE SUBMIT] Generated and saved learning report")
      }
    } catch (reportError) {
      console.log("🔥 [PRACTICE SUBMIT] Report generation failed (non-critical):", reportError)
    }

    console.log("🔥 [PRACTICE SUBMIT] ===== SUBMISSION SUCCESSFUL =====")

    void (async () => {
      try {
        const { recordPracticeAnalytics } = await import("@/lib/institutions/learning-analytics")
        const { engageInterventionsAfterPractice } = await import("@/lib/institutions/interventions")
        const courseRows = await sql`SELECT course_id FROM students WHERE id = ${studentDbId} LIMIT 1`
        const courseId = courseRows[0]?.course_id != null ? Number(courseRows[0].course_id) : null
        await recordPracticeAnalytics({
          studentId: studentDbId,
          attemptId: Number(attemptId),
          courseId,
          score,
          correctCount,
          totalQuestions,
          completed: true,
        })
        await engageInterventionsAfterPractice(studentDbId)
      } catch {
        /* analytics must not block submit */
      }
    })()

    return NextResponse.json({
      success: true,
      attemptId,
      score,
      correctCount,
      totalQuestions,
      submittedAnswers,
      topics: [...new Set(submittedAnswers.map(a => a.topic))].join(", ")
    })

  } catch (error) {
    console.log("🔥 [PRACTICE SUBMIT] ===== SUBMISSION FAILED =====")
    console.log("🔥 [PRACTICE SUBMIT] ERROR:", error)
    return NextResponse.json({ error: "Failed to submit practice" }, { status: 500 })
  }
}