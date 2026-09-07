/** Build client-safe answer review payload after practice evaluate (MCQ / select-all). */

import { TRUE_FALSE_OPTIONS } from "@/lib/question-bank-normalize"

export type PracticeAnswerReviewOption = {
  letter: string
  text: string
  isSelected: boolean
  isCorrect: boolean
}

export type PracticeAnswerReview = {
  isCorrect: boolean
  /** True when score/points are between 0 and full credit (select-all partial). */
  isPartialCredit?: boolean
  score?: number
  pointsEarned?: number
  maxPoints?: number
  correctLetters: string[]
  correctTexts: string[]
  options: PracticeAnswerReviewOption[]
  summary: string
}

export function isPracticePartialCredit(review: PracticeAnswerReview): boolean {
  if (review.isCorrect) return false
  if (review.isPartialCredit === true) return true
  if (typeof review.score === "number" && review.score > 0 && review.score < 100) return true
  if (
    typeof review.pointsEarned === "number" &&
    review.pointsEarned > 0 &&
    (review.maxPoints ?? 1) > review.pointsEarned
  ) {
    return true
  }
  return false
}

type OptionMap = Record<string, string>

function letterOptions(
  question: {
    option_a?: string
    option_b?: string
    option_c?: string
    option_d?: string
    option_e?: string
  },
  qType?: string,
): OptionMap {
  const normalized = normalizeReviewQuestionType(String(qType ?? ""))
  const options: OptionMap = {
    A: question.option_a ?? "",
    B: question.option_b ?? "",
    C: question.option_c ?? "",
    D: question.option_d ?? "",
    E: question.option_e ?? "",
  }
  if (normalized === "true_false") {
    if (!options.A?.trim()) options.A = TRUE_FALSE_OPTIONS[0]
    if (!options.B?.trim()) options.B = TRUE_FALSE_OPTIONS[1]
  }
  return options
}

function normalizeReviewQuestionType(qType: string): string {
  const t = qType.toLowerCase()
  if (t === "multiple_choice" || t === "multiplechoice") return "mcq"
  return t
}

function correctLettersFromOptionText(correctAnswer: unknown, options: OptionMap): string[] {
  if (correctAnswer == null || correctAnswer === "") return []
  const parsed = Array.isArray(correctAnswer)
    ? correctAnswer
    : (() => {
        if (typeof correctAnswer !== "string") return [String(correctAnswer)]
        try {
          const json = JSON.parse(correctAnswer)
          return Array.isArray(json) ? json : [json]
        } catch {
          return correctAnswer.includes(",")
            ? correctAnswer.split(",").map((s) => s.trim())
            : [correctAnswer.trim()]
        }
      })()

  const letters: string[] = []
  for (const item of parsed) {
    const s = String(item).trim()
    if (/^[A-E]$/i.test(s)) {
      letters.push(s.toUpperCase())
      continue
    }
    for (const [letter, text] of Object.entries(options)) {
      if (text?.trim() && text.trim().toLowerCase() === s.toLowerCase()) {
        letters.push(letter)
        break
      }
    }
  }
  return [...new Set(letters)]
}

function parseCorrectLetters(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map(String).filter((v) => ["A", "B", "C", "D", "E"].includes(v.toUpperCase()))
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.map(String).filter((v) => ["A", "B", "C", "D", "E"].includes(v.toUpperCase()))
      }
    } catch {
      /* fall through */
    }
    if (["A", "B", "C", "D", "E"].includes(raw.trim().toUpperCase())) {
      return [raw.trim().toUpperCase()]
    }
    return raw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((v) => ["A", "B", "C", "D", "E"].includes(v))
  }
  return []
}

/** Letters that count as correct for a select_all / multi_output question (drops stale keys like F). */
export function resolveSelectAllCorrectLetters(question: {
  option_a?: string | null
  option_b?: string | null
  option_c?: string | null
  option_d?: string | null
  option_e?: string | null
  correct_answer?: unknown
}): string[] {
  const options = letterOptions(question)
  let correctLetters = parseCorrectLetters(question.correct_answer)
  if (correctLetters.length === 0) {
    correctLetters = correctLettersFromOptionText(question.correct_answer, options)
  }
  return correctLetters.filter((letter) => Boolean(options[letter]?.trim()))
}

function lettersFromTexts(texts: string[], options: OptionMap): string[] {
  const letters: string[] = []
  for (const [letter, text] of Object.entries(options)) {
    if (!text?.trim()) continue
    if (texts.some((t) => t.trim().toLowerCase() === text.trim().toLowerCase())) {
      letters.push(letter)
    }
  }
  return letters
}

export function buildPracticeAnswerReview(input: {
  question: {
    option_a?: string
    option_b?: string
    option_c?: string
    option_d?: string
    option_e?: string
    correct_answer?: unknown
    question_type?: string
  }
  selectedLetters?: string[]
  selectedTexts?: string[]
  isCorrect: boolean
  correctLetters?: string[]
  correctTexts?: string[]
  score?: number
  pointsEarned?: number
  maxPoints?: number
}): PracticeAnswerReview | null {
  const qType = normalizeReviewQuestionType(String(input.question.question_type ?? ""))
  if (qType !== "mcq" && qType !== "true_false" && qType !== "select_all" && qType !== "multi_output") {
    return null
  }

  const options = letterOptions(input.question, qType)
  let correctLetters = input.correctLetters ?? []
  if (correctLetters.length === 0) {
    correctLetters = parseCorrectLetters(input.question.correct_answer)
  }
  if (correctLetters.length === 0) {
    correctLetters = correctLettersFromOptionText(input.question.correct_answer, options)
  }
  if (correctLetters.length === 0 && input.correctTexts?.length) {
    correctLetters = lettersFromTexts(input.correctTexts, options)
  }

  const correctTexts =
    input.correctTexts ??
    correctLetters.map((l) => options[l] ?? l).filter(Boolean)

  const selectedLetters = new Set((input.selectedLetters ?? []).map((l) => l.toUpperCase()))
  const optionRows: PracticeAnswerReviewOption[] = ["A", "B", "C", "D", "E"]
    .filter((letter) => options[letter]?.trim())
    .map((letter) => ({
      letter,
      text: options[letter],
      isSelected: selectedLetters.has(letter),
      isCorrect: correctLetters.includes(letter),
    }))

  const isPartialCredit =
    !input.isCorrect &&
    ((typeof input.score === "number" && input.score > 0 && input.score < 100) ||
      (typeof input.pointsEarned === "number" &&
        input.pointsEarned > 0 &&
        (input.maxPoints ?? 1) > input.pointsEarned))

  const summary = input.isCorrect
    ? "Correct!"
    : isPartialCredit
      ? typeof input.score === "number"
        ? `Partial credit (${Math.round(input.score)}%).`
        : "Partial credit — some selections were correct."
      : correctTexts.length > 0
        ? `Correct answer${correctTexts.length > 1 ? "s" : ""}: ${correctTexts.join("; ")}`
        : correctLetters.length > 0
          ? `Correct: ${correctLetters.join(", ")}`
          : "Incorrect — review the highlighted options."

  return {
    isCorrect: input.isCorrect,
    isPartialCredit,
    score: input.score,
    pointsEarned: input.pointsEarned,
    maxPoints: input.maxPoints,
    correctLetters,
    correctTexts,
    options: optionRows,
    summary,
  }
}

/** Server-side payload for practice evaluate API responses. */
export function practiceAnswerReviewForEvaluateResponse(input: {
  question: {
    option_a?: string | null
    option_b?: string | null
    option_c?: string | null
    option_d?: string | null
    option_e?: string | null
    correct_answer?: unknown
    question_type?: string
  }
  studentAnswer: string | string[]
  isCorrect: boolean
  correctLetters?: string[]
  correctTexts?: string[]
  score?: number
  pointsEarned?: number
  maxPoints?: number
}): PracticeAnswerReview | null {
  const qType = String(input.question.question_type ?? "").toLowerCase()
  const options = letterOptions(input.question, qType)
  let selectedLetters: string[] = []
  let selectedTexts: string[] = []

  if (Array.isArray(input.studentAnswer)) {
    selectedTexts = input.studentAnswer.map(String)
    selectedLetters = lettersFromTexts(selectedTexts, options)
    if (selectedLetters.length === 0) {
      selectedLetters = input.studentAnswer
        .map(String)
        .filter((v) => ["A", "B", "C", "D", "E"].includes(v.toUpperCase()))
    }
  } else if (typeof input.studentAnswer === "string") {
    const raw = input.studentAnswer.trim()
    if (["A", "B", "C", "D", "E"].includes(raw.toUpperCase())) {
      selectedLetters = [raw.toUpperCase()]
    } else {
      selectedTexts = [raw]
      selectedLetters = lettersFromTexts(selectedTexts, options)
    }
  }

  if (qType === "true_false") {
    const tfLetters = parseCorrectLetters(input.question.correct_answer)
    if (tfLetters.length === 0) {
      const ca = String(input.question.correct_answer ?? "").toLowerCase()
      if (ca === "a" || ca === "true") input.correctLetters = ["A"]
      if (ca === "b" || ca === "false") input.correctLetters = ["B"]
    }
  }

  return buildPracticeAnswerReview({
    question: input.question,
    selectedLetters,
    selectedTexts,
    isCorrect: input.isCorrect,
    correctLetters: input.correctLetters,
    correctTexts: input.correctTexts,
    score: input.score,
    pointsEarned: input.pointsEarned,
    maxPoints: input.maxPoints,
  })
}
