import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { autoFinalizeQuizAttemptsForQuiz } from "@/lib/auto-finalize-quiz-attempts"
import {
  normalizeQuizRetakePolicyForAutoFinalize,
  pickSingleFinalAttemptId,
} from "@/lib/retake-auto-finalize"
import type { AutoFinalizeGrading } from "@/lib/retake-auto-finalize"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function POST(request: NextRequest) {
  try {
    console.log("[API Auto-Finalize] Starting auto-finalize request")
    const instructorSession = request.headers.get("authorization") || request.headers.get("x-instructor-id")
    if (!instructorSession) {
      console.error("[API Auto-Finalize] No authentication")
      return NextResponse.json({ error: "Instructor authentication required" }, { status: 401 })
    }

    const body = await request.json()
    const quizId = Number(body.quizId)
    const gradingPolicy = String(body.gradingPolicy ?? "highest").trim() as AutoFinalizeGrading
    console.log("[API Auto-Finalize] Request params:", { quizId, gradingPolicy })

    if (!quizId || Number.isNaN(quizId)) {
      return NextResponse.json({ error: "Quiz ID is required" }, { status: 400 })
    }

    const { finalizedCount, skippedCount } = await autoFinalizeQuizAttemptsForQuiz({
      quizId,
      gradingPolicy,
      skipNotifications: false,
    })

    console.log("[API Auto-Finalize] Complete! Finalized:", finalizedCount, "Skipped:", skippedCount)

    return NextResponse.json({
      success: true,
      message: `Successfully finalized attempts for ${finalizedCount} students using ${gradingPolicy} grading policy`,
      finalizedCount,
      skippedCount,
      gradingPolicy,
    })
  } catch (error) {
    console.error("[API Auto-Finalize] Error:", error)
    return NextResponse.json({ error: "Failed to auto-finalize attempts" }, { status: 500 })
  }
}

// Auto-finalize attempts when quiz expires
export async function PUT(request: NextRequest) {
  try {
    const { quizId } = await request.json()

    if (!quizId) {
      return NextResponse.json({ error: "Quiz ID is required" }, { status: 400 })
    }

    // Get quiz expiry settings
    const quiz = await sql`
      SELECT available_until, retake_policy
      FROM quizzes
      WHERE id = ${quizId} AND deleted_at IS NULL
    `

    if (quiz.length === 0) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    const quizData = quiz[0]
    const now = new Date()
    const expiryDate = new Date(quizData.available_until)

    // Only auto-finalize if quiz has expired
    if (now <= expiryDate) {
      return NextResponse.json({
        success: false,
        message: "Quiz has not expired yet",
      })
    }

    const gradingPolicy = normalizeQuizRetakePolicyForAutoFinalize(
      quizData.retake_policy as string | null,
    )

    // Auto-finalize using the same logic as POST
    const studentsWithAttempts = await sql`
      SELECT DISTINCT qa.student_id
      FROM quiz_attempts qa
      WHERE qa.quiz_id = ${quizId}
        AND qa.is_final_grade = false
        AND qa.completed_at IS NOT NULL
    `

    let finalizedCount = 0

    for (const student of studentsWithAttempts) {
      const attempts = await sql`
        SELECT 
          qa.id,
          qa.score,
          qa.completed_at,
          qa.started_at,
          EXTRACT(EPOCH FROM (qa.completed_at - qa.started_at))::integer as time_taken_seconds
        FROM quiz_attempts qa
        WHERE qa.student_id = ${student.student_id}
          AND qa.quiz_id = ${quizId}
          AND qa.completed_at IS NOT NULL
        ORDER BY qa.completed_at DESC
      `

      if (attempts.length === 0) continue

      if (gradingPolicy === "average") {
        await sql`
          UPDATE quiz_attempts
          SET is_final_grade = true
          WHERE student_id = ${student.student_id}
            AND quiz_id = ${quizId}
            AND completed_at IS NOT NULL
        `
        finalizedCount++
        continue
      }

      const selectedAttemptId = pickSingleFinalAttemptId(attempts, gradingPolicy)
      if (selectedAttemptId == null) continue

      await sql`
        UPDATE quiz_attempts
        SET is_final_grade = false
        WHERE student_id = ${student.student_id} AND quiz_id = ${quizId}
      `

      await sql`
        UPDATE quiz_attempts
        SET is_final_grade = true
        WHERE id = ${selectedAttemptId}
      `

      finalizedCount++
    }

    return NextResponse.json({
      success: true,
      message: `Auto-finalized attempts for ${finalizedCount} students after quiz expiry`,
      finalizedCount,
      gradingPolicy,
    })
  } catch (error) {
    console.error("Error auto-finalizing attempts on expiry:", error)
    return NextResponse.json(
      { error: "Failed to auto-finalize attempts on expiry" },
      { status: 500 },
    )
  }
}
