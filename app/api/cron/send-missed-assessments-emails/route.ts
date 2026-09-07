/**
 * Cron: Send missed assessments summary emails to students
 * One email per student with a detailed breakdown of ALL assessments they missed
 *
 * Send logic:
 * - Send only ONCE per assessment when deadline passes (not every day)
 * - Subsequent emails only when there are NEW assessments the student missed
 * - When sending, include all missed; label "Newly missed" for the most recent ones
 * - Include Available and Due dates for each
 *
 * Call via GET with Authorization: Bearer CRON_SECRET
 * Query params: ?session=ELEG1301P01 (optional), ?dryRun=true
 */

import { NextRequest, NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/compliance/cron-auth"
import { getBaseUrl } from "@/lib/get-base-url"
import { sql } from "@/lib/db"
import { getStudentForEmail } from "@/lib/email/send-notification-email"
import { sendEmail } from "@/lib/email/sendEmail"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const BASE_URL = getBaseUrl()

type MissedItem = {
  assessmentId: number
  assessmentType: string
  type: string
  title: string
  available: string
  due: string
  score: string
  isNewlyMissed: boolean
}

const fmtDate = (d: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { dateStyle: "medium" }) : "—"

function buildTableRow(item: MissedItem, isAlt: boolean): string {
  const bg = isAlt ? "#f8fafc" : "#fff"
  const newBadge = item.isNewlyMissed
    ? '<span style="background:#ef4444;color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;font-weight:600;margin-left:6px;">New</span>'
    : ""
  return `
    <tr style="background:${bg};border-bottom:1px solid #e2e8f0;">
      <td style="padding:12px 16px;color:#475569;font-weight:500;">${item.type}</td>
      <td style="padding:12px 16px;color:#1e293b;font-weight:600;">${item.title}${newBadge}</td>
      <td style="padding:12px 16px;color:#64748b;">${item.available}</td>
      <td style="padding:12px 16px;color:#64748b;">${item.due}</td>
      <td style="padding:12px 16px;color:#dc2626;font-weight:600;">${item.score}</td>
    </tr>
  `
}

export async function GET(request: NextRequest) {
  const cron = requireCronAuth(request)
  if (!cron.ok) return cron.response

  const { searchParams } = new URL(request.url)
  const sessionFilter = searchParams.get("session") // e.g. ELEG1301P01
  const dryRun = searchParams.get("dryRun") === "true"

  try {
    const now = new Date()

    // Resolve session filter to session_id
    let sessionIdFilter: number | null = null
    if (sessionFilter) {
      const sess = await sql`SELECT id FROM sessions WHERE code = ${sessionFilter} LIMIT 1`
      if (sess.length === 0) {
        return NextResponse.json({ error: `Session not found: ${sessionFilter}` }, { status: 400 })
      }
      sessionIdFilter = (sess[0] as { id: number }).id
    }

    // 1. Expired quizzes (quiz, homework, mid_semester, final)
    const expiredQuizzes = sessionIdFilter
      ? await sql`
          SELECT q.id, q.title, q.assessment_type, q.available_from, q.available_until, q.created_at, qsa.session_id
          FROM quizzes q
          JOIN quiz_session_access qsa ON q.id = qsa.quiz_id AND qsa.is_active
          WHERE q.available_until IS NOT NULL
            AND q.available_until < ${now}
            AND q.assessment_type IN ('quiz', 'homework', 'mid_semester', 'final')
            AND q.deleted_at IS NULL
            AND qsa.session_id = ${sessionIdFilter}
        `
      : await sql`
          SELECT q.id, q.title, q.assessment_type, q.available_from, q.available_until, q.created_at, qsa.session_id
          FROM quizzes q
          JOIN quiz_session_access qsa ON q.id = qsa.quiz_id AND qsa.is_active
          WHERE q.available_until IS NOT NULL
            AND q.available_until < ${now}
            AND q.assessment_type IN ('quiz', 'homework', 'mid_semester', 'final')
            AND q.deleted_at IS NULL
        `

    // 2. Expired classroom point submissions (due_at or created_at + duration_hours)
    let expiredSubmissions: { id: number; title: string; session: string | null; created_at: Date; due_at: Date | null; expires_at: Date }[] = []
    try {
      const subs = await sql`
        SELECT id, title, session, created_at, due_at, duration_hours
        FROM classroom_point_submissions
      `
      for (const s of subs as any[]) {
        let expiresAt: Date | null = null
        if (s.due_at) expiresAt = new Date(s.due_at)
        else if (s.duration_hours != null) {
          const created = new Date(s.created_at)
          expiresAt = new Date(created.getTime() + s.duration_hours * 60 * 60 * 1000)
        }
        if (expiresAt && expiresAt < now) {
          expiredSubmissions.push({
            id: s.id,
            title: s.title,
            session: s.session,
            created_at: s.created_at,
            due_at: s.due_at ? new Date(s.due_at) : null,
            expires_at: expiresAt,
          })
        }
      }
    } catch {
      // Table may not exist
    }

    // Build session_id lookup for classroom submissions (session code -> session id)
    const sessionRows = await sql`SELECT id, code FROM sessions`
    const codeToId = Object.fromEntries((sessionRows as { id: number; code: string }[]).map((r) => [r.code, r.id]))

    // 3. For each student, collect all missed assessments (with assessmentId/assessmentType for tracking)
    const studentMissed = new Map<
      number,
      { name: string; email: string; items: Omit<MissedItem, "isNewlyMissed">[] }
    >()

    const addMissed = (
      studentId: number,
      name: string,
      email: string,
      item: Omit<MissedItem, "isNewlyMissed">
    ) => {
      if (!studentMissed.has(studentId)) {
        studentMissed.set(studentId, { name, email, items: [] })
      }
      const entry = studentMissed.get(studentId)!
      if (!entry.items.some((i) => i.assessmentId === item.assessmentId && i.assessmentType === item.assessmentType)) {
        entry.items.push(item)
      }
    }

    // Process quizzes
    for (const q of expiredQuizzes as { id: number; title: string; assessment_type: string; available_from: Date | null; available_until: Date; created_at: Date; session_id: number }[]) {
      const typeLabel =
        q.assessment_type === "mid_semester"
          ? "Mid-Semester Exam"
          : q.assessment_type === "homework"
            ? "Homework"
            : q.assessment_type === "final"
              ? "Final Exam"
              : "Quiz"

      const studentsWithoutAttempt = await sql`
        SELECT s.id, s.full_name, s.email
        FROM students s
        WHERE s.session_id = ${q.session_id}
          AND NOT EXISTS (
            SELECT 1 FROM quiz_attempts qa
            WHERE qa.quiz_id = ${q.id} AND qa.student_id = s.id AND qa.completed_at IS NOT NULL
          )
      `

      for (const row of studentsWithoutAttempt as { id: number; full_name: string; email: string | null }[]) {
        const student = await getStudentForEmail(row.id)
        if (!student) continue

        addMissed(row.id, student.name, student.email, {
          assessmentId: q.id,
          assessmentType: q.assessment_type,
          type: typeLabel,
          title: q.title,
          available: fmtDate(q.available_from || q.created_at),
          due: fmtDate(q.available_until),
          score: "Not completed",
        })
      }
    }

    // Process classroom point submissions
    for (const sub of expiredSubmissions) {
      const sessionId = sub.session ? codeToId[sub.session] : null
      if (!sessionId) continue
      if (sessionFilter && sub.session !== sessionFilter) continue

      const studentsWithoutSubmission = await sql`
        SELECT s.id, s.full_name, s.email
        FROM students s
        WHERE s.session_id = ${sessionId}
          AND NOT EXISTS (
            SELECT 1 FROM classroom_points cp
            WHERE cp.submission_id = ${sub.id} AND cp.student_id = s.id
          )
      `

      for (const row of studentsWithoutSubmission as { id: number; full_name: string; email: string | null }[]) {
        const student = await getStudentForEmail(row.id)
        if (!student) continue

        addMissed(row.id, student.name, student.email, {
          assessmentId: sub.id,
          assessmentType: "classroom_points",
          type: "Classroom Points",
          title: sub.title,
          available: fmtDate(sub.created_at),
          due: fmtDate(sub.due_at || sub.expires_at),
          score: "Not completed",
        })
      }
    }

    // 4. Load already-sent reminders (table may not exist before migration)
    let alreadySent = new Map<number, Set<string>>()
    try {
      const sentRows = await sql`
        SELECT student_id, assessment_id, assessment_type
        FROM missed_deadline_reminders_sent
      `
      for (const r of sentRows as { student_id: number; assessment_id: number; assessment_type: string }[]) {
        if (!alreadySent.has(r.student_id)) alreadySent.set(r.student_id, new Set())
        alreadySent.get(r.student_id)!.add(`${r.assessment_id}:${r.assessment_type}`)
      }
    } catch {
      // Table doesn't exist yet - treat all as newly missed
    }

    // 5. For each student: mark newly missed, skip if none new
    const toSend = new Map<number, { name: string; email: string; items: MissedItem[]; newlyMissedKeys: string[] }>()
    for (const [studentId, { name, email, items }] of studentMissed) {
      const sent = alreadySent.get(studentId) ?? new Set<string>()
      const enriched: MissedItem[] = []
      const newlyMissedKeys: string[] = []
      for (const it of items) {
        const key = `${it.assessmentId}:${it.assessmentType}`
        const isNew = !sent.has(key)
        enriched.push({ ...it, isNewlyMissed: isNew })
        if (isNew) newlyMissedKeys.push(key)
      }
      if (newlyMissedKeys.length > 0) {
        toSend.set(studentId, { name, email, items: enriched, newlyMissedKeys })
      }
    }

    // 6. Send one email per student (only when there are NEW missed assessments)
    const results = { sent: 0, skipped: 0, errors: [] as string[] }
    const preview: { email: string; name: string; count: number; items: MissedItem[] }[] = []

    for (const [studentId, { name, email, items, newlyMissedKeys }] of toSend) {
      if (dryRun) {
        preview.push({ email, name, count: items.length, items })
        continue
      }

      const tableRowsHtml = items
        .map((item, i) => buildTableRow(item, i % 2 === 1))
        .join("")

      const result = await sendEmail("missed_assessments_summary", email, {
        name,
        assessmentCount: items.length,
        tableRowsHtml,
        dashboardLink: `${BASE_URL}/student/dashboard-v2`,
      })

      if (result.success) {
        results.sent++
        // Record that we sent for each newly missed assessment
        for (const key of newlyMissedKeys) {
          const [aid, atype] = key.split(":")
          try {
            await sql`
              INSERT INTO missed_deadline_reminders_sent (student_id, assessment_id, assessment_type)
              VALUES (${studentId}, ${parseInt(aid, 10)}, ${atype})
              ON CONFLICT (student_id, assessment_id, assessment_type) DO NOTHING
            `
          } catch (e) {
            console.warn("[SendMissedAssessments] Failed to record sent:", e)
          }
        }
      } else {
        results.skipped++
        if (result.error) results.errors.push(`${email}: ${result.error}`)
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      studentsWithNewMissed: toSend.size,
      studentsWithAnyMissed: studentMissed.size,
      sent: results.sent,
      skipped: results.skipped,
      errors: results.errors.slice(0, 20),
      ...(dryRun && { preview }),
    })
  } catch (error) {
    console.error("[SendMissedAssessments] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to send missed assessments emails",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
