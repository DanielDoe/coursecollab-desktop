/**
 * Cron: Send missed deadline emails to students
 * Call via GET with Authorization: Bearer CRON_SECRET
 * Schedule: Daily (e.g. 8am) via Vercel Cron
 */

import { NextRequest, NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/compliance/cron-auth"
import { getBaseUrl } from "@/lib/get-base-url"
import { sql } from "@/lib/db"
import { getStudentForEmail } from "@/lib/email/send-notification-email"
import { sendEmail } from "@/lib/email/sendEmail"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const BASE_URL = getBaseUrl()

export async function GET(request: NextRequest) {
  const cron = requireCronAuth(request)
  if (!cron.ok) return cron.response

  try {
    const now = new Date()
    const sent: string[] = []
    const skipped: string[] = []

    // Quizzes - students who haven't completed and deadline passed
    const expiredQuizzes = await sql`
      SELECT q.id, q.title, q.available_until, qsa.session_id
      FROM quizzes q
      JOIN quiz_session_access qsa ON q.id = qsa.quiz_id AND qsa.is_active
      WHERE q.available_until IS NOT NULL
        AND q.available_until < ${now}
        AND q.assessment_type = 'quiz'
        AND q.deleted_at IS NULL
    `
    for (const q of expiredQuizzes) {
      const studentsWithoutAttempt = await sql`
        SELECT s.id FROM students s
        WHERE s.session_id = ${q.session_id}
          AND NOT EXISTS (
            SELECT 1 FROM quiz_attempts qa
            WHERE qa.quiz_id = ${q.id} AND qa.student_id = s.id
          )
      `
      for (const row of studentsWithoutAttempt) {
        const student = await getStudentForEmail(row.id)
        if (!student?.email) {
          skipped.push(`quiz-${q.id}-${row.id}`)
          continue
        }
        const result = await sendEmail("missed_deadline", student.email, {
          name: student.name,
          assessmentType: "Quiz",
          assessmentTitle: q.title,
          deadline: new Date(q.available_until).toLocaleDateString("en-US", { dateStyle: "medium" }),
          link: `${BASE_URL}/student/dashboard-v2/quizzes`,
        })
        if (result.success) sent.push(`quiz-${q.id}-${row.id}`)
        else skipped.push(`quiz-${q.id}-${row.id}`)
      }
    }

    // Homework - same pattern
    const expiredHomework = await sql`
      SELECT q.id, q.title, q.available_until, qsa.session_id
      FROM quizzes q
      JOIN quiz_session_access qsa ON q.id = qsa.quiz_id AND qsa.is_active
      WHERE q.available_until IS NOT NULL
        AND q.available_until < ${now}
        AND q.assessment_type = 'homework'
        AND q.deleted_at IS NULL
    `
    for (const h of expiredHomework) {
      const studentsWithoutAttempt = await sql`
        SELECT s.id FROM students s
        WHERE s.session_id = ${h.session_id}
          AND NOT EXISTS (
            SELECT 1 FROM quiz_attempts qa
            WHERE qa.quiz_id = ${h.id} AND qa.student_id = s.id
          )
      `
      for (const row of studentsWithoutAttempt) {
        const student = await getStudentForEmail(row.id)
        if (!student?.email) { skipped.push(`hw-${h.id}-${row.id}`); continue }
        const result = await sendEmail("missed_deadline", student.email, {
          name: student.name,
          assessmentType: "Homework",
          assessmentTitle: h.title,
          deadline: new Date(h.available_until).toLocaleDateString("en-US", { dateStyle: "medium" }),
          link: `${BASE_URL}/student/dashboard-v2/homework`,
        })
        if (result.success) sent.push(`hw-${h.id}-${row.id}`)
        else skipped.push(`hw-${h.id}-${row.id}`)
      }
    }

    return NextResponse.json({
      success: true,
      sent: sent.length,
      skipped: skipped.length,
      details: { sent, skipped },
    })
  } catch (error) {
    console.error("[MissedDeadline] Error:", error)
    return NextResponse.json(
      { error: "Failed to process missed deadlines", details: String(error) },
      { status: 500 }
    )
  }
}
