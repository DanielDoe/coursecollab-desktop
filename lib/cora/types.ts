import type { QuestionMedia } from "@/lib/question-media"

export type CoraDomain = "circuit" | "coding" | "math" | "generic"

export type CoraProblemSource =
  | "lecture_workspace"
  | "lecture_practice"
  | "quiz"
  | "practice_hub"
  | "classroom_points"
  | "question_bank"
  | "codebench"
  | "custom"

export type CoraStepKind = "setup" | "concept" | "compute" | "check" | "code" | "hint" | "summary"

export type CoraWalkthroughStep = {
  id: string
  index: number
  title: string
  body: string
  kind: CoraStepKind
  hint?: string
}

export type CoraProblemContext = {
  source: CoraProblemSource
  domain: CoraDomain
  title?: string
  questionText: string
  questionType?: string
  expectedAnswer?: string | null
  hint?: string | null
  explanation?: string | null
  referenceSteps?: string[]
  mediaUrl?: string | null
  questionMedia?: QuestionMedia | null
  studentAnswer?: string | null
  courseCode?: string | null
  topic?: string | null
  questionId?: number | string
  bankQuestionId?: number
  lectureId?: number
  quizId?: number
  studentDatabaseId?: number | null
}

export type CoraWalkthroughResponse = {
  domain: CoraDomain
  steps: CoraWalkthroughStep[]
  finalAnswer?: string | null
  source: "reference" | "ai"
  problemTitle?: string
}
