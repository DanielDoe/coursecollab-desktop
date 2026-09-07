import "server-only"

import { sql } from "@/lib/db"
import { resolveStudentCourseContextByDbId, sqlQuizInStudentCourse } from "@/lib/student-course-scope"
import type { CoraProblemContext } from "@/lib/cora/types"

export type AssessmentImportAccessStatus = "unattempted" | "in_progress" | "completed"

export type AssessmentImportAccess = {
  allowed: boolean
  status: AssessmentImportAccessStatus
  message: string | null
  quizId?: number
  assessmentTitle?: string
}

export const ASSESSMENT_IMPORT_LOCK_UNATTEMPTED =
  "Attempt this assessment first. Cora can help with its questions only after you submit."

export const ASSESSMENT_IMPORT_LOCK_IN_PROGRESS =
  "Finish and submit this assessment before Cora can help with its questions."

export const ASSESSMENT_IMPORT_LOCK_PASTED =
  "This looks like a question from an assessment you haven't submitted yet. Open the assessment, complete and submit it, then Cora can help you review."

function normalizeFingerprint(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Shared prefix length used to match pasted / retyped assessment stems. */
function fingerprintsMatch(a: string, b: string): boolean {
  const fa = normalizeFingerprint(a)
  const fb = normalizeFingerprint(b)
  if (fa.length < 40 || fb.length < 40) return false
  const sliceLen = Math.min(120, fa.length, fb.length)
  if (fa.slice(0, sliceLen) === fb.slice(0, sliceLen)) return true
  if (fa.length >= 60 && fb.includes(fa.slice(0, 80))) return true
  if (fb.length >= 60 && fa.includes(fb.slice(0, 80))) return true
  return false
}

/**
 * Students may import graded assessment questions into Cora only after a completed attempt.
 * Pending / in-progress homework & quizzes stay locked so Cora cannot pre-solve them.
 */
export async function getAssessmentImportAccess(
  studentDatabaseId: number | null | undefined,
  quizId: number,
): Promise<AssessmentImportAccess> {
  if (!Number.isFinite(quizId) || quizId <= 0) {
    return {
      allowed: false,
      status: "unattempted",
      message: ASSESSMENT_IMPORT_LOCK_UNATTEMPTED,
      quizId,
    }
  }

  if (studentDatabaseId == null || !Number.isFinite(studentDatabaseId) || studentDatabaseId <= 0) {
    return {
      allowed: false,
      status: "unattempted",
      message: ASSESSMENT_IMPORT_LOCK_UNATTEMPTED,
      quizId,
    }
  }

  try {
    const rows = (await sql`
      SELECT
        BOOL_OR(qa.completed_at IS NOT NULL) AS has_completed,
        BOOL_OR(qa.completed_at IS NULL) AS has_in_progress
      FROM quiz_attempts qa
      WHERE qa.student_id = ${studentDatabaseId}
        AND qa.quiz_id = ${quizId}
        AND qa.deleted_at IS NULL
    `) as { has_completed: boolean | null; has_in_progress: boolean | null }[]

    const row = rows[0]
    if (row?.has_completed) {
      return { allowed: true, status: "completed", message: null, quizId }
    }
    if (row?.has_in_progress) {
      return {
        allowed: false,
        status: "in_progress",
        message: ASSESSMENT_IMPORT_LOCK_IN_PROGRESS,
        quizId,
      }
    }
    return {
      allowed: false,
      status: "unattempted",
      message: ASSESSMENT_IMPORT_LOCK_UNATTEMPTED,
      quizId,
    }
  } catch (err) {
    console.warn("[cora/assessment-import-gate] lookup failed:", err)
    return {
      allowed: false,
      status: "unattempted",
      message: ASSESSMENT_IMPORT_LOCK_UNATTEMPTED,
      quizId,
    }
  }
}

export async function assertAssessmentImportAllowed(
  studentDatabaseId: number | null | undefined,
  quizId: number,
): Promise<void> {
  const access = await getAssessmentImportAccess(studentDatabaseId, quizId)
  if (!access.allowed) {
    throw new Error(access.message ?? ASSESSMENT_IMPORT_LOCK_UNATTEMPTED)
  }
}

/**
 * Block Practice Hub / bank imports when the same bank question is used on a
 * homework/quiz the student has not submitted.
 */
export async function getBankQuestionImportAccess(
  studentDatabaseId: number | null | undefined,
  bankQuestionId: number,
): Promise<AssessmentImportAccess> {
  if (
    studentDatabaseId == null ||
    !Number.isFinite(studentDatabaseId) ||
    studentDatabaseId <= 0 ||
    !Number.isFinite(bankQuestionId) ||
    bankQuestionId <= 0
  ) {
    return { allowed: true, status: "completed", message: null }
  }

  try {
    const ctx = await resolveStudentCourseContextByDbId(studentDatabaseId)
    if (!ctx) return { allowed: true, status: "completed", message: null }

    const rows = (await sql`
      SELECT DISTINCT qq.quiz_id, q.title
      FROM quiz_questions qq
      JOIN quizzes q ON q.id = qq.quiz_id
      WHERE qq.bank_question_id = ${bankQuestionId}
        AND ${sqlQuizInStudentCourse("q", ctx.courseId)}
      LIMIT 20
    `) as { quiz_id: number; title: string | null }[]

    for (const row of rows) {
      const access = await getAssessmentImportAccess(studentDatabaseId, Number(row.quiz_id))
      if (!access.allowed) {
        return {
          ...access,
          assessmentTitle: row.title ?? undefined,
          message:
            access.status === "in_progress"
              ? `“${row.title ?? "This assessment"}” is in progress. Submit it before Cora can help with this question.`
              : `“${row.title ?? "This assessment"}” is still pending. Attempt and submit it before Cora can help with this question.`,
        }
      }
    }
    return { allowed: true, status: "completed", message: null }
  } catch (err) {
    console.warn("[cora/assessment-import-gate] bank lookup failed:", err)
    return { allowed: true, status: "completed", message: null }
  }
}

export async function assertBankQuestionImportAllowed(
  studentDatabaseId: number | null | undefined,
  bankQuestionId: number,
): Promise<void> {
  const access = await getBankQuestionImportAccess(studentDatabaseId, bankQuestionId)
  if (!access.allowed) {
    throw new Error(access.message ?? ASSESSMENT_IMPORT_LOCK_UNATTEMPTED)
  }
}

/**
 * Detect pasted / imported stems that match locked (unattempted / in-progress) assessments.
 */
export async function findLockedAssessmentMatchingText(
  studentDatabaseId: number,
  texts: string[],
): Promise<AssessmentImportAccess | null> {
  const candidates = texts.map((t) => String(t ?? "").trim()).filter((t) => t.length >= 40)
  if (!candidates.length) return null

  try {
    const ctx = await resolveStudentCourseContextByDbId(studentDatabaseId)
    if (!ctx) return null

    const rows = (await sql`
      SELECT q.id AS quiz_id, q.title, qq.question_text
      FROM quizzes q
      JOIN quiz_questions qq ON qq.quiz_id = q.id
      WHERE ${sqlQuizInStudentCourse("q", ctx.courseId)}
        AND NOT EXISTS (
          SELECT 1
          FROM quiz_attempts qa
          WHERE qa.quiz_id = q.id
            AND qa.student_id = ${studentDatabaseId}
            AND qa.completed_at IS NOT NULL
            AND qa.deleted_at IS NULL
        )
      LIMIT 400
    `) as { quiz_id: number; title: string | null; question_text: string | null }[]

    for (const row of rows) {
      const stem = row.question_text ?? ""
      if (!stem.trim()) continue
      for (const text of candidates) {
        if (fingerprintsMatch(text, stem)) {
          const access = await getAssessmentImportAccess(studentDatabaseId, Number(row.quiz_id))
          if (!access.allowed) {
            return {
              ...access,
              assessmentTitle: row.title ?? undefined,
              message:
                access.status === "in_progress"
                  ? `This matches “${row.title ?? "an assessment"}” which is still in progress. Submit it before asking Cora for help.`
                  : `This matches “${row.title ?? "an assessment"}” which you haven't submitted yet. Attempt and submit it first — then Cora can help you review.`,
            }
          }
        }
      }
    }
    return null
  } catch (err) {
    console.warn("[cora/assessment-import-gate] text match failed:", err)
    return null
  }
}

/**
 * Server-side guard for chat + import: quiz id, bank id, and pasted stem matching.
 */
export async function guardCoraAgainstUnattemptedAssessments(
  studentDatabaseId: number | null | undefined,
  input: {
    quizId?: number | null
    bankQuestionId?: number | null
    source?: string | null
    texts?: Array<string | null | undefined>
  },
): Promise<AssessmentImportAccess> {
  if (studentDatabaseId == null || !Number.isFinite(studentDatabaseId) || studentDatabaseId <= 0) {
    return { allowed: true, status: "completed", message: null }
  }

  if (input.quizId != null && Number.isFinite(Number(input.quizId))) {
    const access = await getAssessmentImportAccess(studentDatabaseId, Number(input.quizId))
    if (!access.allowed) return access
  }

  if (input.bankQuestionId != null && Number.isFinite(Number(input.bankQuestionId))) {
    const access = await getBankQuestionImportAccess(studentDatabaseId, Number(input.bankQuestionId))
    if (!access.allowed) return access
  }

  const texts = (input.texts ?? []).filter(
    (t): t is string => typeof t === "string" && t.trim().length >= 40,
  )
  if (texts.length) {
    const matched = await findLockedAssessmentMatchingText(studentDatabaseId, texts)
    if (matched && !matched.allowed) return matched
  }

  return { allowed: true, status: "completed", message: null }
}

/** Strip answer keys before returning imported problems to the browser. */
export function sanitizeProblemForClient(problem: CoraProblemContext): CoraProblemContext {
  const { expectedAnswer: _ea, explanation: _ex, referenceSteps: _rs, ...rest } = problem
  return rest
}

/** Messages discussion share — question body only (no tutoring hints either). */
export function sanitizeProblemForDiscussion(problem: CoraProblemContext): CoraProblemContext {
  const base = sanitizeProblemForClient(problem)
  const { hint: _hint, ...rest } = base
  return rest
}
