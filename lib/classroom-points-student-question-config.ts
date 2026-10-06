const ANSWER_KEY_KEYS = [
  "expected_answer",
  "solution",
  "reference_answer",
  "answer_key",
  "sample_solution",
] as const

function asConfigRecord(config: unknown): Record<string, unknown> | null {
  if (config == null || config === "") return null
  if (typeof config === "string") {
    try {
      const parsed = JSON.parse(config) as unknown
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { ...(parsed as Record<string, unknown>) }
      }
      return null
    } catch {
      return null
    }
  }
  if (typeof config === "object" && !Array.isArray(config)) {
    return { ...(config as Record<string, unknown>) }
  }
  return null
}

export function readClassroomCodeSolution(config: unknown): {
  available: boolean
  unlocked: boolean
  code: string | null
} {
  const record = asConfigRecord(config)
  const sample =
    typeof record?.sample_solution === "string" ? record.sample_solution.trim() : ""
  const stored =
    typeof record?.reference_answer === "string" ? record.reference_answer.trim() : ""
  const code = sample || stored
  return {
    available: code.length > 0,
    unlocked: record?.solution_unlocked === true,
    code: code || null,
  }
}

function stripAnswerKeyFields(record: Record<string, unknown>): Record<string, unknown> {
  const next = { ...record }
  for (const key of ANSWER_KEY_KEYS) {
    delete next[key]
  }
  return next
}

/**
 * Student-facing `question_config` must keep prompt fields and drop answer keys.
 * A worked code solution is included only after the instructor unlocks it.
 * Instructors keep the raw JSONB value.
 */
export function redactClassroomPointsStudentQuestionConfig(config: unknown): unknown {
  const record = asConfigRecord(config)
  if (!record) return config

  const solution = readClassroomCodeSolution(record)
  const next = stripAnswerKeyFields(record)
  next.solution_available = solution.available
  next.solution_unlocked = solution.unlocked
  if (solution.unlocked && solution.code) {
    next.sample_solution = solution.code
  }
  return next
}

export function redactClassroomPointsStudentSubmission<T extends { question_config?: unknown }>(
  row: T,
): T {
  return {
    ...row,
    question_config: redactClassroomPointsStudentQuestionConfig(row.question_config),
  }
}
