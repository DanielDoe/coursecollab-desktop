import { sql } from "@/lib/db"
import { createBulkNotifications } from "@/lib/create-notification"

type ReminderKind = "opened" | "deadline_24h"

type EligibleRow = {
  quiz_id: number
  student_id: number
  title: string
  assessment_type: string | null
  available_from: string | null
  available_until: string | null
}

export type AssessmentReminderDispatchResult = {
  openedQuizzes: number
  openedNotifications: number
  deadlineQuizzes: number
  deadlineNotifications: number
}

async function ensureAssessmentReminderSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS assessment_reminder_dispatches (
      id SERIAL PRIMARY KEY,
      quiz_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      kind VARCHAR(32) NOT NULL,
      dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (quiz_id, student_id, kind)
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_assessment_reminder_dispatches_quiz
      ON assessment_reminder_dispatches (quiz_id)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_assessment_reminder_dispatches_student
      ON assessment_reminder_dispatches (student_id)
  `
}

function assessmentNoun(assessmentType: string | null | undefined): string {
  const t = String(assessmentType ?? "quiz").toLowerCase()
  if (t === "homework") return "homework"
  if (t.includes("mid") || t === "exam" || t === "final") return "exam"
  return "quiz"
}

function notificationTypeForOpened(assessmentType: string | null | undefined): "quiz" | "homework" | "exam" {
  const t = String(assessmentType ?? "quiz").toLowerCase()
  if (t === "homework") return "homework"
  if (t.includes("mid") || t === "exam" || t === "final") return "exam"
  return "quiz"
}

function studentLinkForType(assessmentType: string | null | undefined): string {
  const t = String(assessmentType ?? "quiz").toLowerCase()
  if (t === "homework") return "/student/homework"
  if (t.includes("mid")) return "/student/mid-semester-exams"
  if (t === "final") return "/student/finals"
  return "/student/quizzes"
}

function groupByQuiz(rows: EligibleRow[]): Map<number, EligibleRow[]> {
  const map = new Map<number, EligibleRow[]>()
  for (const row of rows) {
    const list = map.get(row.quiz_id) ?? []
    list.push(row)
    map.set(row.quiz_id, list)
  }
  return map
}

async function markDispatched(quizId: number, studentIds: number[], kind: ReminderKind): Promise<void> {
  for (const studentId of studentIds) {
    await sql`
      INSERT INTO assessment_reminder_dispatches (quiz_id, student_id, kind)
      VALUES (${quizId}, ${studentId}, ${kind})
      ON CONFLICT (quiz_id, student_id, kind) DO NOTHING
    `
  }
}

/**
 * Students with active session access to the quiz, optional allow-list,
 * and no completed attempt yet. Skips already-dispatched (quiz, student, kind).
 */
async function eligibleStudentsForOpenedWindow(): Promise<EligibleRow[]> {
  // 45m lookback covers a missed 15m cron tick with margin.
  const rows = (await sql`
    SELECT DISTINCT
      q.id AS quiz_id,
      s.id AS student_id,
      q.title,
      q.assessment_type,
      q.available_from,
      q.available_until
    FROM quizzes q
    INNER JOIN quiz_session_access qsa
      ON qsa.quiz_id = q.id
     AND qsa.is_active = true
    INNER JOIN students s
      ON s.session_id = qsa.session_id
    WHERE q.deleted_at IS NULL
      AND COALESCE(q.is_public, false) = true
      AND q.available_from IS NOT NULL
      AND q.available_from <= NOW()
      AND q.available_from > NOW() - INTERVAL '45 minutes'
      AND (q.available_until IS NULL OR q.available_until > NOW())
      AND (
        NOT COALESCE(q.restrict_access_to_students, false)
        OR COALESCE(q.allowed_student_ids, '[]'::jsonb) @> to_jsonb(s.id)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM quiz_attempts qa
        WHERE qa.quiz_id = q.id
          AND qa.student_id = s.id
          AND qa.deleted_at IS NULL
          AND qa.completed_at IS NOT NULL
      )
      AND NOT EXISTS (
        SELECT 1
        FROM assessment_reminder_dispatches ard
        WHERE ard.quiz_id = q.id
          AND ard.student_id = s.id
          AND ard.kind = 'opened'
      )
  `) as EligibleRow[]

  return rows
}

async function eligibleStudentsForDeadlineWindow(): Promise<EligibleRow[]> {
  const rows = (await sql`
    SELECT DISTINCT
      q.id AS quiz_id,
      s.id AS student_id,
      q.title,
      q.assessment_type,
      q.available_from,
      q.available_until
    FROM quizzes q
    INNER JOIN quiz_session_access qsa
      ON qsa.quiz_id = q.id
     AND qsa.is_active = true
    INNER JOIN students s
      ON s.session_id = qsa.session_id
    WHERE q.deleted_at IS NULL
      AND COALESCE(q.is_public, false) = true
      AND q.available_until IS NOT NULL
      AND q.available_until > NOW()
      AND q.available_until <= NOW() + INTERVAL '24 hours'
      AND (q.available_from IS NULL OR q.available_from <= NOW())
      AND (
        NOT COALESCE(q.restrict_access_to_students, false)
        OR COALESCE(q.allowed_student_ids, '[]'::jsonb) @> to_jsonb(s.id)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM quiz_attempts qa
        WHERE qa.quiz_id = q.id
          AND qa.student_id = s.id
          AND qa.deleted_at IS NULL
          AND qa.completed_at IS NOT NULL
      )
      AND NOT EXISTS (
        SELECT 1
        FROM assessment_reminder_dispatches ard
        WHERE ard.quiz_id = q.id
          AND ard.student_id = s.id
          AND ard.kind = 'deadline_24h'
      )
  `) as EligibleRow[]

  return rows
}

async function dispatchOpened(rows: EligibleRow[]): Promise<{ quizzes: number; notifications: number }> {
  const byQuiz = groupByQuiz(rows)
  let notifications = 0

  for (const [quizId, quizRows] of byQuiz) {
    const sample = quizRows[0]
    const studentIds = [...new Set(quizRows.map((r) => Number(r.student_id)).filter((id) => id > 0))]
    if (studentIds.length === 0) continue

    const noun = assessmentNoun(sample.assessment_type)
    await createBulkNotifications(studentIds, {
      type: notificationTypeForOpened(sample.assessment_type),
      title: `${noun.charAt(0).toUpperCase() + noun.slice(1)} is open`,
      message: `"${sample.title}" is now available. You can start taking it.`,
      link: studentLinkForType(sample.assessment_type),
    })
    await markDispatched(quizId, studentIds, "opened")
    notifications += studentIds.length
  }

  return { quizzes: byQuiz.size, notifications }
}

async function dispatchDeadlines(rows: EligibleRow[]): Promise<{ quizzes: number; notifications: number }> {
  const byQuiz = groupByQuiz(rows)
  let notifications = 0

  for (const [quizId, quizRows] of byQuiz) {
    const sample = quizRows[0]
    const studentIds = [...new Set(quizRows.map((r) => Number(r.student_id)).filter((id) => id > 0))]
    if (studentIds.length === 0 || !sample.available_until) continue

    const msLeft = new Date(sample.available_until).getTime() - Date.now()
    const hoursLeft = Math.max(1, Math.round(msLeft / (1000 * 60 * 60)))
    const noun = assessmentNoun(sample.assessment_type)

    await createBulkNotifications(studentIds, {
      type: "deadline",
      title: "Deadline approaching",
      message: `"${sample.title}" (${noun}) is due in about ${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}.`,
      link: studentLinkForType(sample.assessment_type),
    })
    await markDispatched(quizId, studentIds, "deadline_24h")
    notifications += studentIds.length
  }

  return { quizzes: byQuiz.size, notifications }
}

/** Cron entry: open-window + due-soon reminders (in-app + Expo push). */
export async function dispatchAssessmentReminders(): Promise<AssessmentReminderDispatchResult> {
  await ensureAssessmentReminderSchema()

  const [openedRows, deadlineRows] = await Promise.all([
    eligibleStudentsForOpenedWindow(),
    eligibleStudentsForDeadlineWindow(),
  ])

  const opened = await dispatchOpened(openedRows)
  const deadline = await dispatchDeadlines(deadlineRows)

  return {
    openedQuizzes: opened.quizzes,
    openedNotifications: opened.notifications,
    deadlineQuizzes: deadline.quizzes,
    deadlineNotifications: deadline.notifications,
  }
}
