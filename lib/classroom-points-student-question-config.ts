const ANSWER_KEY_KEYS = [
  "expected_answer",
  "solution",
  "reference_answer",
  "answer_key",
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

function stripAnswerKeyFields(record: Record<string, unknown>): Record<string, unknown> {
  const next = { ...record }
  for (const key of ANSWER_KEY_KEYS) {
    delete next[key]
  }
  return next
}

/**
 * Student-facing `question_config` must keep prompt fields and drop answer keys.
 * Instructors keep the raw JSONB value.
 */
export function redactClassroomPointsStudentQuestionConfig(config: unknown): unknown {
  const record = asConfigRecord(config)
  if (!record) return config

  return stripAnswerKeyFields(record)
}

export function redactClassroomPointsStudentSubmission<T extends { question_config?: unknown }>(
  row: T,
): T {
  return {
    ...row,
    question_config: redactClassroomPointsStudentQuestionConfig(row.question_config),
  }
}
