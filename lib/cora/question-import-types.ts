import type { CoraProblemContext, CoraProblemSource } from "@/lib/cora/types"

export type ImportSourceKey =
  | "quizzes"
  | "homework"
  | "mid_semester"
  | "final_exam"
  | "practice_hub"
  | "lecture_workspace"
  | "classroom_points"

export type ImportSourceOption = {
  key: ImportSourceKey
  label: string
  description: string
  count?: number
}

export type ImportContainerOption = {
  id: string
  label: string
  subtitle?: string
  count?: number
  /** Graded assessments: locked until the student submits an attempt. */
  locked?: boolean
  lockReason?: string | null
  accessStatus?: "unattempted" | "in_progress" | "completed"
}

/** Client-safe source labels (no DB imports). */
export const IMPORT_SOURCE_META: Record<
  ImportSourceKey,
  { label: string; description: string; assessmentTypes?: string[] }
> = {
  quizzes: { label: "Quizzes", description: "In-class and weekly quizzes", assessmentTypes: ["quiz"] },
  homework: { label: "Homework", description: "Take-home assignments", assessmentTypes: ["homework"] },
  mid_semester: {
    label: "Mid-Semester",
    description: "Mid-semester exams",
    assessmentTypes: ["mid_semester", "midsem"],
  },
  final_exam: { label: "Final Exam", description: "Final assessments", assessmentTypes: ["final", "finals"] },
  practice_hub: { label: "Practice Hub", description: "Topic-based practice questions" },
  lecture_workspace: { label: "Lecture Workspace", description: "In-lecture sample problems" },
  classroom_points: { label: "Classroom Points", description: "In-class coding & circuit assignments" },
}

export type CoraImportableItem = {
  /** Stable picker id */
  ref: string
  source: CoraProblemSource
  label: string
  group: string
  preview: string
  questionId?: number | string
  quizId?: number
  bankQuestionId?: number
  lectureId?: number
  classroomSubmissionId?: number
}

export type CoraQuestionImportResolveInput = {
  source: CoraProblemSource
  questionId?: number | string
  quizId?: number
  bankQuestionId?: number
  lectureId?: number
  classroomSubmissionId?: number
  studentDatabaseId?: number | null
  /** `messages` = share for discussion (unlocks browse); `cora` keeps assessment gates. */
  purpose?: "cora" | "messages"
}

export function importRef(item: Pick<CoraImportableItem, "source" | "questionId" | "quizId" | "bankQuestionId" | "lectureId" | "classroomSubmissionId">): string {
  const parts = [item.source]
  if (item.quizId != null) parts.push(`q${item.quizId}`)
  if (item.lectureId != null) parts.push(`l${item.lectureId}`)
  if (item.classroomSubmissionId != null) parts.push(`c${item.classroomSubmissionId}`)
  if (item.bankQuestionId != null) parts.push(`b${item.bankQuestionId}`)
  if (item.questionId != null) parts.push(`i${item.questionId}`)
  return parts.join(":")
}

export function previewText(text: string, max = 120): string {
  const t = text.replace(/\s+/g, " ").trim()
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`
}

export type CoraQuestionImportResolveResult = {
  problem: CoraProblemContext
  item: CoraImportableItem
}
