import { sql } from "@/lib/db"
import { getAssessmentConfig, type AssessmentType } from "@/lib/assessment-core/db"

export class AttemptRequiredError extends Error {
  constructor() {
    super("NO_ACTIVE_ATTEMPT")
    this.name = "AttemptRequiredError"
  }
}

export class AttemptAlreadyCompletedError extends Error {
  constructor() {
    super("Attempt already completed")
    this.name = "AttemptAlreadyCompletedError"
  }
}

export class AttemptNotFoundError extends Error {
  constructor() {
    super("Attempt not found")
    this.name = "AttemptNotFoundError"
  }
}

/**
 * Resolve the active quiz attempt for GET take routes.
 * Attempts must be created by POST /api/student/start-quiz — never here.
 */
export async function resolveAttemptForTake(
  type: AssessmentType,
  assessmentId: number,
  studentId: number,
  attemptIdParam: string | null,
): Promise<{ id: number }> {
  const config = getAssessmentConfig(type)

  const validateAttemptRow = async (attemptId: number) => {
    const rows = await sql`
      SELECT id, completed_at
      FROM ${sql.unsafe(config.attemptsTable)}
      WHERE id = ${attemptId}
        AND ${sql.unsafe(config.idColumn)} = ${assessmentId}
        AND student_id = ${studentId}
        AND deleted_at IS NULL
      LIMIT 1
    `
    if (rows.length === 0 || !rows[0]?.id) {
      throw new AttemptNotFoundError()
    }
    if (rows[0].completed_at) {
      throw new AttemptAlreadyCompletedError()
    }
    return { id: Number(rows[0].id) }
  }

  if (attemptIdParam) {
    const parsed = Number.parseInt(attemptIdParam, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      return validateAttemptRow(parsed)
    }
  }

  const incomplete = await sql`
    SELECT id FROM ${sql.unsafe(config.attemptsTable)}
    WHERE ${sql.unsafe(config.idColumn)} = ${assessmentId}
      AND student_id = ${studentId}
      AND completed_at IS NULL
      AND deleted_at IS NULL
    ORDER BY attempt_number DESC
    LIMIT 1
  `
  if (incomplete.length > 0 && incomplete[0]?.id) {
    return { id: Number(incomplete[0].id) }
  }

  throw new AttemptRequiredError()
}

export function attemptResolveErrorResponse(error: unknown): NextResponseLike | null {
  const msg = error instanceof Error ? error.message : String(error)
  if (msg === "NO_ACTIVE_ATTEMPT") {
    return {
      status: 428,
      body: {
        error: "No active quiz session. Please start the assessment from the dashboard.",
        code: "attempt_required",
        studentMessage: "Your quiz session has not started yet. Go back and click Start Quiz again.",
      },
    }
  }
  if (msg === "Attempt already completed") {
    return {
      status: 409,
      body: { error: "This attempt is already completed.", code: "attempt_completed" },
    }
  }
  if (msg === "Attempt not found") {
    return {
      status: 404,
      body: {
        error: "Quiz session not found. Please start the assessment again.",
        code: "attempt_not_found",
      },
    }
  }
  return null
}

type NextResponseLike = {
  status: number
  body: Record<string, unknown>
}
