import {
  normalizeCorrectAnswerToLetter,
  quizQuestionOptionsAsStrings,
} from "@/lib/question-bank-normalize"

export type LocalVerifyQuestionData = {
  correctAnswer: unknown
  circuitSpec?: unknown
  options: {
    A: string | null | undefined
    B: string | null | undefined
    C: string | null | undefined
    D: string | null | undefined
    E: string | null | undefined
  }
}

/** Normalize quiz question row fields for verifyAnswerLocally. */
export function buildLocalVerifyQuestionData(question: {
  question_type?: string | null
  correct_answer?: unknown
  circuit_spec?: unknown
  option_a?: string | null
  option_b?: string | null
  option_c?: string | null
  option_d?: string | null
  option_e?: string | null
}): LocalVerifyQuestionData {
  const qType = String(question.question_type || "mcq").toLowerCase()
  const options = {
    A: question.option_a,
    B: question.option_b,
    C: question.option_c,
    D: question.option_d,
    E: question.option_e,
  }
  const optionTexts = quizQuestionOptionsAsStrings(question)
  return {
    correctAnswer: normalizeCorrectAnswerToLetter(question.correct_answer, optionTexts, qType),
    circuitSpec: question.circuit_spec,
    options,
  }
}

function parseJsonArrayString(value: string): unknown[] | null {
  const trimmed = value.trim()
  if (!trimmed.startsWith("[")) return null
  try {
    const parsed = JSON.parse(trimmed)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Coerce stored / submitted answers into the shape verifyAnswerLocally expects. */
export function parseStudentAnswerForVerify(
  questionType: string | null | undefined,
  studentAnswer: unknown,
): unknown {
  const qt = String(questionType || "mcq")
    .toLowerCase()
    .replace(/[_-]/g, "")

  if (qt === "selectall" || qt === "multipleselect" || qt === "checkbox" || qt === "multioutput") {
    if (Array.isArray(studentAnswer)) return studentAnswer
    if (typeof studentAnswer === "string") {
      const trimmed = studentAnswer.trim()
      if (!trimmed) return []
      const fromJson = parseJsonArrayString(trimmed)
      if (fromJson) return fromJson
      if (trimmed.includes(",")) {
        return trimmed.split(",").map((part) => part.trim()).filter(Boolean)
      }
      return [trimmed]
    }
    return studentAnswer == null ? [] : [studentAnswer]
  }

  if (typeof studentAnswer === "string") {
    const trimmed = studentAnswer.trim()
    if (/^"[A-E]"$/i.test(trimmed)) {
      try {
        return JSON.parse(trimmed)
      } catch {
        return trimmed.replace(/"/g, "")
      }
    }
  }

  return studentAnswer
}
