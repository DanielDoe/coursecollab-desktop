/**
 * Email students who missed a specific assessment
 * POST body: { quizId: number, assessmentType: 'quiz' | 'homework' | 'mid_semester' | 'final' }
 */

import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getStudentForEmail } from "@/lib/email/send-notification-email"
import { sendEmail } from "@/lib/email/sendEmail"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://course-collab.com"

const TYPE_LABELS: Record<string, string> = {
  quiz: "Quiz",
  homework: "Homework",
  mid_semester: "Mid-Semester Exam",
  final: "Final Exam",
}

const DASHBOARD_LINKS: Record<string, string> = {
  quiz: "/student/dashboard-v2/quizzes",
  homework: "/student/dashboard-v2/homework",
  mid_semester: "/student/dashboard-v2/mid-semester-exams",
  final: "/student/dashboard-v2/final-exams",
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { quizId, assessmentType } = body as { quizId?: number; assessmentType?: string }

    if (!quizId || !assessmentType) {
      return NextResponse.json(
        { error: "quizId and assessmentType are required" },
        { status: 400 }
      )
    }

    const validTypes = ["quiz", "homework", "mid_semester", "final"]
    if (!validTypes.includes(assessmentType)) {
      return NextResponse.json(
        { error: "assessmentType must be quiz, homework, mid_semester, or final" },
        { status: 400 }
      )
    }

    // Fetch assessment details
    const quizRows = await sql`
      SELECT id, title, available_until
      FROM quizzes
      WHERE id = ${quizId}
        AND assessment_type = ${assessmentType}
        AND deleted_at IS NULL
    `

    if (quizRows.length === 0) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 })
    }

    const quiz = quizRows[0] as { id: number; title: string; available_until: string | null }
    const deadline = quiz.available_until
      ? new Date(quiz.available_until).toLocaleDateString("en-US", { dateStyle: "medium" })
      : "N/A"

    // Get session IDs that have access to this assessment
    const sessionAccess = await sql`
      SELECT session_id FROM quiz_session_access
      WHERE quiz_id = ${quizId} AND is_active = true
    `

    const sessionIds = (sessionAccess as { session_id: number }[]).map((r) => r.session_id)
    if (sessionIds.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        skipped: 0,
        message: "No sessions have access to this assessment",
      })
    }

    // Find students in those sessions who have NO completed attempt
    const studentsWithoutAttempt = await sql`
      SELECT s.id
      FROM students s
      WHERE s.session_id = ANY(${sessionIds})
        AND NOT EXISTS (
          SELECT 1 FROM quiz_attempts qa
          WHERE qa.quiz_id = ${quizId}
            AND qa.student_id = s.id
            AND qa.completed_at IS NOT NULL
        )
    `

    const typeLabel = TYPE_LABELS[assessmentType] || assessmentType
    const link = `${BASE_URL}${DASHBOARD_LINKS[assessmentType] || "/student/dashboard-v2"}`

    let sent = 0
    let skipped = 0
    const errors: string[] = []

    for (const row of studentsWithoutAttempt as { id: number }[]) {
      const student = await getStudentForEmail(row.id)
      if (!student) {
        skipped++
        continue
      }

      const result = await sendEmail("missed_deadline", student.email, {
        name: student.name,
        assessmentType: typeLabel,
        assessmentTitle: quiz.title,
        deadline,
        link,
      })

      if (result.success) sent++
      else {
        skipped++
        if (result.error) errors.push(`${student.email}: ${result.error}`)
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      skipped,
      totalMissed: studentsWithoutAttempt.length,
      errors: errors.slice(0, 10),
    })
  } catch (error) {
    console.error("[EmailMissedAssessment] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to send emails",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
