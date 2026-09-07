import type { CoraDomain, CoraProblemContext, CoraProblemSource } from "@/lib/cora/types"
import type { CoraSolveAssessmentState, CoraSolveLearningMode } from "@/lib/cora/solve-workspace"

const HANDOFF_KEY = "coraSolveHandoff.v1"

/** Payload CourseCollab modules pass when opening Solve via Ask Cora. */
export type CoraSolveHandoff = {
  questionText: string
  title?: string
  courseCode?: string | null
  courseLabel?: string | null
  topic?: string | null
  sourceModule: CoraProblemSource | "custom"
  sourceLabel?: string
  questionId?: number | string
  bankQuestionId?: number
  lectureId?: number
  quizId?: number
  domain?: CoraDomain
  assessmentState?: CoraSolveAssessmentState
  /** When false, Worked Solution stays locked. */
  allowWorkedSolution?: boolean
  preferredMode?: CoraSolveLearningMode
  /** Optional CTA intent label shown in Solve header */
  intentLabel?: string
  studentDatabaseId?: number | null
  expectedAnswer?: string | null
  hint?: string | null
  explanation?: string | null
  referenceSteps?: string[]
  mediaUrl?: string | null
  createdAt: number
}

export function buildSolveHandoff(
  partial: Omit<CoraSolveHandoff, "createdAt"> & { createdAt?: number },
): CoraSolveHandoff {
  return {
    ...partial,
    createdAt: partial.createdAt ?? Date.now(),
  }
}

export function writeSolveHandoff(handoff: CoraSolveHandoff): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(handoff))
  } catch {
    /* ignore */
  }
}

export function peekSolveHandoff(): CoraSolveHandoff | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CoraSolveHandoff
    if (!parsed?.questionText || typeof parsed.questionText !== "string") return null
    // Expire after 30 minutes
    if (Date.now() - (parsed.createdAt || 0) > 30 * 60 * 1000) {
      sessionStorage.removeItem(HANDOFF_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function consumeSolveHandoff(): CoraSolveHandoff | null {
  const handoff = peekSolveHandoff()
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(HANDOFF_KEY)
    } catch {
      /* ignore */
    }
  }
  return handoff
}

export function handoffToProblemContext(
  handoff: CoraSolveHandoff,
  studentDatabaseId?: number | null,
): CoraProblemContext {
  return {
    source: handoff.sourceModule === "custom" ? "custom" : handoff.sourceModule,
    domain: handoff.domain ?? "generic",
    title: handoff.title,
    questionText: handoff.questionText,
    expectedAnswer: handoff.expectedAnswer,
    hint: handoff.hint,
    explanation: handoff.explanation,
    referenceSteps: handoff.referenceSteps,
    mediaUrl: handoff.mediaUrl,
    courseCode: handoff.courseCode,
    topic: handoff.topic,
    questionId: handoff.questionId,
    bankQuestionId: handoff.bankQuestionId,
    lectureId: handoff.lectureId,
    quizId: handoff.quizId,
    studentDatabaseId: handoff.studentDatabaseId ?? studentDatabaseId ?? null,
  }
}

/** Student portal path that lands on Cora → Solve. */
export const CORA_SOLVE_HREF = "/student/dashboard-v2/ai-tutor?tab=solve"

export function openSolveWithHandoff(handoff: CoraSolveHandoff, href = CORA_SOLVE_HREF): void {
  writeSolveHandoff(handoff)
  if (typeof window !== "undefined") {
    window.location.assign(href)
  }
}
