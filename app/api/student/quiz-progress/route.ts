import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { ensureSectionTimerSchema } from "@/lib/ensure-section-timer-schema"
import { ensureSectionQuestionSelectionSchema } from "@/lib/ensure-section-question-selection-schema"
import {
  parseSectionQuestionSelections,
  serializeSectionQuestionSelections,
  type SectionQuestionSelections,
} from "@/lib/section-pick-scoring"
import { parseAssessmentSectionConfig } from "@/lib/assessment-sections"
import { sanitizeAttemptTimerState } from "@/lib/sanitize-attempt-timer-state"
import { requireAttemptOwnership, requireCallerStudentDbId } from "@/lib/student-api-auth"
import { ensureAttemptIntegritySchema } from "@/lib/ensure-attempt-integrity-schema"
import { isAttemptDeadlineExpired } from "@/lib/attempt-deadline"

export const dynamic = "force-dynamic"

async function loadAttemptTimerContext(attemptId: number) {
  const rows = await sql`
    SELECT q.section_config, q.assessment_type, qq.id, qq.question_type, qq.question_order,
           qa.question_time_remaining AS stored_question_time,
           qa.section_time_remaining AS stored_section_time
    FROM quiz_attempts qa
    INNER JOIN quizzes q ON q.id = qa.quiz_id
    INNER JOIN quiz_questions qq ON qq.quiz_id = q.id
    WHERE qa.id = ${attemptId} AND qa.completed_at IS NULL
    ORDER BY qq.question_order ASC
  `
  if (rows.length === 0) return null
  const sectionConfig = parseAssessmentSectionConfig(rows[0].section_config)
  const questions = rows.map((r) => ({
    id: Number(r.id),
    question_type: r.question_type as string | null,
    question_order: r.question_order as number | null,
  }))
  return {
    sectionConfig,
    questions,
    assessmentType: rows[0].assessment_type as string | null,
    storedQuestionTime: parseStoredTimerMap(rows[0].stored_question_time),
    storedSectionTime: parseStoredTimerMap(rows[0].stored_section_time),
  }
}

function parseStoredTimerMap(raw: unknown): Record<string, number> {
  if (!raw) return {}
  const obj = typeof raw === "string" ? safeJsonParse(raw) : raw
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {}
  const out: Record<string, number> = {}
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    const num = Number(val)
    if (Number.isFinite(num) && num > 0) out[key] = num
  }
  return out
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * SECURITY: Remaining time is monotonically non-increasing. A student could otherwise POST
 * inflated questionTimeRemaining/sectionTimeRemaining, refresh, and resume with extra time.
 * New keys (first save for a question/section) pass through; existing keys are clamped to
 * min(new, stored).
 */
function clampTimerMapToStored(
  next: Record<string, number> | undefined,
  stored: Record<string, number>,
): Record<string, number> | undefined {
  if (!next) return next
  const out: Record<string, number> = {}
  for (const [key, val] of Object.entries(next)) {
    const storedVal = stored[key]
    out[key] = storedVal !== undefined ? Math.min(val, storedVal) : val
  }
  return out
}

export async function POST(request: NextRequest) {
  try {
    const caller = await requireCallerStudentDbId(request)
    if (!caller.ok) return caller.response

    await ensureSectionTimerSchema()
    await ensureSectionQuestionSelectionSchema()

    const text = await request.text()
    let body: {
      attemptId?: number
      currentQuestionIndex?: number
      questionTimeRemaining?: Record<string, number>
      sectionTimeRemaining?: Record<string, number>
      sectionQuestionSelections?: SectionQuestionSelections | Record<string, number[]>
    } = {}
    if (text?.trim()) {
      try {
        body = JSON.parse(text) as typeof body
      } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
      }
    }
    const { attemptId, currentQuestionIndex, questionTimeRemaining, sectionTimeRemaining, sectionQuestionSelections } = body

    if (!attemptId || typeof attemptId !== "number") {
      return NextResponse.json({ error: "Invalid attemptId" }, { status: 400 })
    }

    const ownership = await requireAttemptOwnership(request, Number(attemptId))
    if (!ownership.ok) return ownership.response

    // SECURITY: attempt integrity — reject progress writes after the hard deadline and from
    // superseded sessions (another window/device resumed the attempt). See save-answer route.
    await ensureAttemptIntegritySchema()
    const integrityRows = await sql`
      SELECT deadline_at, session_token FROM quiz_attempts WHERE id = ${attemptId} LIMIT 1
    `
    const integrity = integrityRows[0]
    if (integrity && isAttemptDeadlineExpired(integrity.deadline_at)) {
      return NextResponse.json(
        {
          error: "The assessment time limit has been reached.",
          code: "deadline_expired",
        },
        { status: 423 }
      )
    }
    const clientSessionToken = request.headers.get("x-attempt-session")
    if (
      clientSessionToken &&
      integrity?.session_token &&
      clientSessionToken !== integrity.session_token
    ) {
      return NextResponse.json(
        {
          error: "This attempt was resumed in another window or device.",
          code: "session_superseded",
        },
        { status: 409 }
      )
    }

    const hasIndex = typeof currentQuestionIndex === "number" && currentQuestionIndex >= 0
    const hasQuestionTime =
      questionTimeRemaining &&
      typeof questionTimeRemaining === "object" &&
      !Array.isArray(questionTimeRemaining)
    const hasSectionTime =
      sectionTimeRemaining &&
      typeof sectionTimeRemaining === "object" &&
      !Array.isArray(sectionTimeRemaining)

    const hasSelections =
      sectionQuestionSelections &&
      typeof sectionQuestionSelections === "object" &&
      !Array.isArray(sectionQuestionSelections)

    if (hasSelections) {
      const parsed = parseSectionQuestionSelections(sectionQuestionSelections)
      const serialized = parsed ? serializeSectionQuestionSelections(parsed) : {}
      await sql`
        UPDATE quiz_attempts
        SET section_question_selections = ${JSON.stringify(serialized)}::jsonb, last_saved_at = NOW()
        WHERE id = ${attemptId} AND completed_at IS NULL
      `
      if (!hasIndex && !hasQuestionTime && !hasSectionTime) {
        return NextResponse.json({ ok: true })
      }
    }

    if (!hasIndex && !hasQuestionTime && !hasSectionTime) {
      return NextResponse.json({ ok: true })
    }

    const ctx = await loadAttemptTimerContext(attemptId)
    let sanitizedQuestionTime = questionTimeRemaining
    let sanitizedSectionTime = sectionTimeRemaining
    if (ctx && (hasQuestionTime || hasSectionTime)) {
      const sanitized = sanitizeAttemptTimerState(
        ctx.questions,
        ctx.sectionConfig,
        hasQuestionTime ? questionTimeRemaining : undefined,
        hasSectionTime ? sectionTimeRemaining : undefined,
        undefined,
        ctx.assessmentType,
      )
      if (hasQuestionTime) sanitizedQuestionTime = sanitized.questionTimeRemaining
      if (hasSectionTime) sanitizedSectionTime = sanitized.sectionTimeRemaining

      // SECURITY: never allow remaining time to increase vs. what the server already has.
      if (hasQuestionTime) {
        sanitizedQuestionTime = clampTimerMapToStored(sanitizedQuestionTime, ctx.storedQuestionTime)
      }
      if (hasSectionTime) {
        sanitizedSectionTime = clampTimerMapToStored(sanitizedSectionTime, ctx.storedSectionTime)
      }
    }

    if (hasIndex && hasQuestionTime && hasSectionTime) {
      await sql`
        UPDATE quiz_attempts
        SET
          current_question_index = ${currentQuestionIndex},
          question_time_remaining = ${JSON.stringify(sanitizedQuestionTime)}::jsonb,
          section_time_remaining = ${JSON.stringify(sanitizedSectionTime)}::jsonb,
          last_saved_at = NOW()
        WHERE id = ${attemptId} AND completed_at IS NULL
      `
    } else if (hasIndex && hasQuestionTime) {
      await sql`
        UPDATE quiz_attempts
        SET
          current_question_index = ${currentQuestionIndex},
          question_time_remaining = ${JSON.stringify(sanitizedQuestionTime)}::jsonb,
          last_saved_at = NOW()
        WHERE id = ${attemptId} AND completed_at IS NULL
      `
    } else if (hasIndex && hasSectionTime) {
      await sql`
        UPDATE quiz_attempts
        SET
          current_question_index = ${currentQuestionIndex},
          section_time_remaining = ${JSON.stringify(sanitizedSectionTime)}::jsonb,
          last_saved_at = NOW()
        WHERE id = ${attemptId} AND completed_at IS NULL
      `
    } else if (hasQuestionTime && hasSectionTime) {
      await sql`
        UPDATE quiz_attempts
        SET
          question_time_remaining = ${JSON.stringify(sanitizedQuestionTime)}::jsonb,
          section_time_remaining = ${JSON.stringify(sanitizedSectionTime)}::jsonb,
          last_saved_at = NOW()
        WHERE id = ${attemptId} AND completed_at IS NULL
      `
    } else if (hasIndex) {
      await sql`
        UPDATE quiz_attempts
        SET current_question_index = ${currentQuestionIndex}, last_saved_at = NOW()
        WHERE id = ${attemptId} AND completed_at IS NULL
      `
    } else if (hasQuestionTime) {
      await sql`
        UPDATE quiz_attempts
        SET question_time_remaining = ${JSON.stringify(sanitizedQuestionTime)}::jsonb, last_saved_at = NOW()
        WHERE id = ${attemptId} AND completed_at IS NULL
      `
    } else if (hasSectionTime) {
      await sql`
        UPDATE quiz_attempts
        SET section_time_remaining = ${JSON.stringify(sanitizedSectionTime)}::jsonb, last_saved_at = NOW()
        WHERE id = ${attemptId} AND completed_at IS NULL
      `
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[quiz-progress] Save failed:", error)
    return NextResponse.json(
      { error: "Failed to save progress" },
      { status: 500 }
    )
  }
}
