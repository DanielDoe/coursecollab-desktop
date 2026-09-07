import { inferCoraDomain } from "@/lib/cora/infer-domain"
import type { CoraDomain, CoraProblemContext } from "@/lib/cora/types"

export function normalizeCoraProblem(raw: CoraProblemContext): CoraProblemContext {
  const domain =
    raw.domain && raw.domain !== "generic"
      ? raw.domain
      : inferCoraDomain({
          questionType: raw.questionType,
          questionText: raw.questionText,
          source: raw.source,
          courseCode: raw.courseCode,
        })
  return { ...raw, domain }
}

/** Normalize quiz / bank / workspace records into CoraProblemContext. */
export function coraContextFromQuestion(input: {
  source: CoraProblemContext["source"]
  questionText: string
  title?: string
  questionType?: string
  expectedAnswer?: string | null
  hint?: string | null
  explanation?: string | null
  referenceSteps?: string[]
  mediaUrl?: string | null
  studentAnswer?: string | null
  courseCode?: string | null
  topic?: string | null
  questionId?: number | string
  bankQuestionId?: number
  lectureId?: number
  quizId?: number
  attemptId?: number
  studentDatabaseId?: number | null
  domain?: CoraDomain
}): CoraProblemContext {
  return normalizeCoraProblem({
    source: input.source,
    domain: input.domain ?? "generic",
    title: input.title,
    questionText: input.questionText,
    questionType: input.questionType,
    expectedAnswer: input.expectedAnswer,
    hint: input.hint,
    explanation: input.explanation,
    referenceSteps: input.referenceSteps,
    mediaUrl: input.mediaUrl,
    studentAnswer: input.studentAnswer,
    courseCode: input.courseCode,
    topic: input.topic,
    questionId: input.questionId,
    bankQuestionId: input.bankQuestionId,
    lectureId: input.lectureId,
    quizId: input.quizId,
    attemptId: input.attemptId,
    studentDatabaseId: input.studentDatabaseId,
  })
}
