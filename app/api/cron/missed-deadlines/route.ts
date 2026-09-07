/**
 * Cron: Send missed deadline emails to students
 * Call daily via Vercel Cron or external scheduler
 * GET /api/cron/missed-deadlines (protect with CRON_SECRET)
 */

import { NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/compliance/cron-auth"
import { getBaseUrl } from "@/lib/get-base-url"
import { sql } from "@/lib/db"
import { getStudentForEmail } from "@/lib/email/send-notification-email"
import { sendEmail } from "@/lib/email/sendEmail"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: Request) {
  const cron = requireCronAuth(request)
  if (!cron.ok) return cron.response

  const baseUrl = getBaseUrl()
  const now = new Date()
  let sent = 0
  const errors: string[] = []

  try {
    // 1. Quizzes - students who haven't completed and deadline passed
    const expiredQuizzes = await sql`
      SELECT q.id, q.title, q.available_until, qsa.session_id
      FROM quizzes q
      JOIN quiz_session_access qsa ON q.id = qsa.quiz_id AND qsa.is_active
      WHERE q.available_until IS NOT NULL AND q.available_until < ${now}
        AND q.assessment_type = 'quiz'
        AND q.deleted_at IS NULL
    `
    for (const q of expiredQuizzes) {
      const students = await sql`
        SELECT s.id FROM students s
        WHERE s.session_id = ${q.session_id}
          AND NOT EXISTS (
            SELECT 1 FROM quiz_attempts qa
            WHERE qa.quiz_id = ${q.id} AND qa.student_id = s.id AND qa.completed_at IS NOT NULL
          )
      `
      const deadline = new Date(q.available_until).toLocaleDateString("en-US", { dateStyle: "medium" })
      for (const s of students) {
        const r = await sendNotificationEmail(s.id, "missed_deadline", {
          name: "", // filled by service
          assessmentType: "Quiz",
          assessmentTitle: q.title,
          deadline,
          link: `${baseUrl}/student/dashboard-v2/quizzes`,
        })
        if (r.sent) sent++
        else if (r.reason) errors.push(r.reason)
      }
    }

    // 2. Homework - similar logic
    const expiredHomework = await sql`
      SELECT q.id, q.title, q.available_until, qsa.session_id
      FROM quizzes q
      JOIN quiz_session_access qsa ON q.id = qsa.quiz_id AND qsa.is_active
      WHERE q.available_until IS NOT NULL AND q.available_until < ${now}
        AND q.assessment_type = 'homework'
        AND q.deleted_at IS NULL
    `
    for (const h of expiredHomework) {
      const students = await sql`
        SELECT s.id FROM students s
        WHERE s.session_id = ${h.session_id}
          AND NOT EXISTS (
            SELECT 1 FROM quiz_attempts qa
            WHERE qa.quiz_id = ${h.id} AND qa.student_id = s.id AND qa.completed_at IS NOT NULL
          )
      `
      const deadline = new Date(h.available_until).toLocaleDateString("en-US", { dateStyle: "medium" })
      for (const s of students) {
        const student = await getStudentForEmail(s.id)
        if (!student) continue
        const r = await sendEmail("missed_deadline", student.email, {
          name: student.name,
          assessmentType: "Homework",
          assessmentTitle: h.title,
          deadline,
          link: `${baseUrl}/student/dashboard-v2/homework`,
        })
        if (r.success) sent++
        else if (r.error) errors.push(r.error)
      }
    }

    // 3. Classroom point submissions - expired
    try {
      const expiredSubmissions = await sql`
        SELECT id, title, session,
          (created_at + ((COALESCE(duration_hours, 0) + 72) * INTERVAL '1 hour'))::timestamp as expires_at
        FROM classroom_point_submissions
        WHERE duration_hours IS NOT NULL
          AND (created_at + ((duration_hours + 72) * INTERVAL '1 hour')) < ${now}
      `
      for (const sub of expiredSubmissions) {
        const sessionRow = sub.session
          ? await sql`SELECT id FROM sessions WHERE code = ${sub.session} LIMIT 1`
          : null
        const sessionId = sessionRow?.[0]?.id
        if (!sessionId) continue
        const students = await sql`
          SELECT s.id FROM students s
          WHERE s.session_id = ${sessionId}
            AND NOT EXISTS (
              SELECT 1 FROM classroom_points cp
              WHERE cp.submission_id = ${sub.id} AND cp.student_id = s.id
            )
        `
        const deadline = new Date(sub.expires_at).toLocaleDateString("en-US", { dateStyle: "medium" })
        for (const s of students) {
          const student = await getStudentForEmail(s.id)
          if (!student) continue
          const r = await sendEmail("missed_deadline", student.email, {
            name: student.name,
            assessmentType: "Code Submission",
            assessmentTitle: sub.title,
            deadline,
            link: `${baseUrl}/student/dashboard-v2/classroom-points`,
          })
          if (r.success) sent++
          else if (r.error) errors.push(r.error)
        }
      }
    } catch (e) {
      // classroom_point_submissions may not exist
    }

    return NextResponse.json({
      success: true,
      emailsSent: sent,
      errors: errors.slice(0, 10),
    })
  } catch (error) {
    console.error("[Missed deadlines cron] Error:", error)
    return NextResponse.json(
      { error: "Cron failed", details: (error as Error).message },
      { status: 500 }
    )
  }
}
