/**
 * POST /api/instructor/results/[id]/email-grades-updated
 * Sends an email to the student notifying them their grade has been updated.
 * Instructor-only. Used from the results view "Email Student" button.
 * Uses getAttemptDisplayGrade to match instructor/student view (section-weighted, override_points).
 */
import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sendNotificationEmail } from "@/lib/email"
import { getAttemptDisplayGrade } from "@/lib/attempt-grade-display"
import {
  resolveInstructorDisplayName,
  setResultsFinalized,
} from "@/lib/results-finalized"

export const dynamic = "force-dynamic"

const ASSESSMENT_TYPE_LABELS: Record<string, string> = {
  quiz: "Quiz",
  homework: "Homework",
  mid_semester: "Mid-Semester Exam",
  midsem: "Mid-Semester Exam",
  final: "Final Exam",
  finals: "Final Exam",
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { requireInstructorAttemptAccess } = await import("@/lib/instructor-results-auth")
    const { id } = await params
    const access = await requireInstructorAttemptAccess(request, id)
    if (!access.ok) return access.response
    const attemptId = String(access.attemptId)

    const attemptResult = await sql`
      SELECT
        qa.id,
        qa.student_id,
        q.title as quiz_title,
        q.assessment_type,
        s.full_name as student_name
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      JOIN students s ON qa.student_id = s.id
      WHERE qa.id = ${attemptId} AND qa.deleted_at IS NULL
      LIMIT 1
    `

    if (attemptResult.length === 0) {
      return NextResponse.json(
        { error: "Attempt not found." },
        { status: 404 }
      )
    }

    const attempt = attemptResult[0] as {
      student_id: number
      quiz_title: string
      assessment_type: string
      student_name: string
    }

    // Use shared grade calculation - matches instructor/student view
    // Handles section-weighted scoring (I, II, III), override_points, manual grading
    const displayGrade = await getAttemptDisplayGrade(attemptId)
    if (!displayGrade) {
      return NextResponse.json(
        { error: "Could not compute grade for attempt." },
        { status: 400 }
      )
    }

    const assessmentTypeLabel =
      ASSESSMENT_TYPE_LABELS[displayGrade.assessmentType?.toLowerCase()] ||
      attempt.assessment_type ||
      "Assessment"

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "https://course-collab.com"
    const reportLink = `${baseUrl}/student/results/${attemptId}`

    const result = await sendNotificationEmail(
      attempt.student_id,
      "grades_updated",
      {
        name: attempt.student_name || "Student",
        assessmentTitle: attempt.quiz_title || "Assessment",
        assessmentTypeLabel,
        score: displayGrade.score.toFixed(2),
        totalPoints: String(Math.round(displayGrade.totalPoints)),
        percentage: String(displayGrade.percentage),
        reportLink,
      }
    )

    if (result.sent) {
      let finalizedBy = "Instructor"
      const instructorIdRaw = request.headers.get("x-instructor-id")
      const instructorId = instructorIdRaw ? Number(instructorIdRaw) : NaN
      if (Number.isFinite(instructorId)) {
        finalizedBy = (await resolveInstructorDisplayName(instructorId)) || finalizedBy
      }

      const finalizedFields = await setResultsFinalized(attemptId, true, finalizedBy)

      return NextResponse.json({
        success: true,
        message: "Email sent successfully to student.",
        ...finalizedFields,
      })
    }

    return NextResponse.json(
      {
        success: false,
        error: result.reason || "Failed to send email",
      },
      { status: 400 }
    )
  } catch (error) {
    console.error("[Email Grades Updated] Error:", error)
    return NextResponse.json(
      { error: "Failed to send email. Please try again." },
      { status: 500 }
    )
  }
}
