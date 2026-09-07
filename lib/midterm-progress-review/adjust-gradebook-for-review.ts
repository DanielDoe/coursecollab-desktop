import { calculateLetterGrade } from "@/lib/grade-utils"
import { getGradeWeights, type GradeWeights } from "@/lib/grades"
import type {
  AssessmentAttemptSummary,
  AttendanceSummary,
  ClassroomPointSummary,
  PracticeHubSummary,
} from "./types"

export type GradeCategoryKey =
  | "quiz"
  | "homework"
  | "midterm"
  | "final"
  | "attendance"
  | "project"
  | "classroom"
  | "engagement"

export type GradeCategoryStatus = "scored" | "pending"

export type RawGradebookScores = {
  quizScore: number
  homeworkScore: number
  midtermScore: number
  finalScore: number
  attendanceScore: number
  projectScore: number
  classroomScore: number
  engagementCredits: number
  totalScore: number
  letterGrade: string | null
}

export type ProgressReviewGradebook = RawGradebookScores & {
  officialTotalScore: number
  officialLetterGrade: string | null
  gradeIsProvisional: boolean
  pendingCategories: string[]
  categoryStatus: Record<GradeCategoryKey, GradeCategoryStatus>
  provisionalContributions: Partial<Record<GradeCategoryKey, number>>
  includedWeight: number
}

const CATEGORY_LABELS: Record<GradeCategoryKey, string> = {
  quiz: "Quizzes",
  homework: "Homework",
  midterm: "Midterm",
  final: "Final",
  attendance: "Attendance",
  project: "Project",
  classroom: "Classroom",
  engagement: "Engagement",
}

const DEFAULT_WEIGHTS: Pick<
  GradeWeights,
  | "quiz_weight"
  | "homework_weight"
  | "midterm_weight"
  | "final_weight"
  | "attendance_weight"
  | "project_weight"
  | "classroom_weight"
  | "engagement_weight"
> = {
  quiz_weight: 15,
  homework_weight: 15,
  midterm_weight: 20,
  final_weight: 25,
  attendance_weight: 10,
  project_weight: 10,
  classroom_weight: 5,
  engagement_weight: 0,
}

function normAssessmentType(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .trim()
}

function hasAttemptType(assessments: AssessmentAttemptSummary[], matchers: string[]): boolean {
  const set = new Set(matchers.map(normAssessmentType))
  return assessments.some((a) => set.has(normAssessmentType(a.assessmentType)))
}

export function detectCategoryStatuses(input: {
  assessments: AssessmentAttemptSummary[]
  attendance: AttendanceSummary
  classroomPoints: ClassroomPointSummary[]
  practiceHub: PracticeHubSummary
  raw: RawGradebookScores | null
}): Record<GradeCategoryKey, GradeCategoryStatus> {
  const raw = input.raw
  return {
    quiz: hasAttemptType(input.assessments, ["quiz"]) ? "scored" : "pending",
    homework: hasAttemptType(input.assessments, ["homework"]) ? "scored" : "pending",
    midterm: hasAttemptType(input.assessments, ["mid_semester", "midsem", "midterm"])
      ? "scored"
      : "pending",
    final: hasAttemptType(input.assessments, ["final", "finals", "final_exam"]) ? "scored" : "pending",
    project:
      hasAttemptType(input.assessments, ["project"]) || (raw?.projectScore ?? 0) > 0
        ? "scored"
        : "pending",
    attendance: input.attendance.totalSessions > 0 ? "scored" : "pending",
    classroom:
      input.classroomPoints.length > 0 || (raw?.classroomScore ?? 0) > 0 ? "scored" : "pending",
    engagement:
      (raw?.engagementCredits ?? 0) > 0 || input.practiceHub.totalAttempts > 0 ? "scored" : "pending",
  }
}

function engagementPercent(credits: number): number {
  return Math.min(100, Math.max(0, credits))
}

export function formatProgressReviewCategoryScore(
  status: GradeCategoryStatus,
  score: number,
): string {
  return status === "pending" ? "Pending" : `${score.toFixed(1)}%`
}

export function computeProvisionalGrade(
  raw: RawGradebookScores,
  categoryStatus: Record<GradeCategoryKey, GradeCategoryStatus>,
  weights: Pick<
    GradeWeights,
    | "quiz_weight"
    | "homework_weight"
    | "midterm_weight"
    | "final_weight"
    | "attendance_weight"
    | "project_weight"
    | "classroom_weight"
    | "engagement_weight"
  >,
): {
  totalScore: number
  letterGrade: string | null
  pendingCategories: string[]
  gradeIsProvisional: boolean
  contributions: Partial<Record<GradeCategoryKey, number>>
  includedWeight: number
} {
  const pendingCategories: string[] = []
  const entries: Array<{ key: GradeCategoryKey; score: number; weight: number }> = []

  const push = (key: GradeCategoryKey, score: number, weight: number) => {
    if (weight <= 0) return
    if (categoryStatus[key] === "pending") {
      pendingCategories.push(CATEGORY_LABELS[key])
      return
    }
    entries.push({ key, score, weight })
  }

  push("quiz", raw.quizScore, weights.quiz_weight)
  push("homework", raw.homeworkScore, weights.homework_weight)
  push("midterm", raw.midtermScore, weights.midterm_weight)
  push("final", raw.finalScore, weights.final_weight)
  push("attendance", raw.attendanceScore, weights.attendance_weight)
  push("project", raw.projectScore, weights.project_weight)
  push("classroom", raw.classroomScore, weights.classroom_weight)
  push("engagement", engagementPercent(raw.engagementCredits), weights.engagement_weight)

  const includedWeight = entries.reduce((sum, e) => sum + e.weight, 0)
  if (includedWeight <= 0) {
    return {
      totalScore: raw.totalScore,
      letterGrade: null,
      pendingCategories,
      gradeIsProvisional: pendingCategories.length > 0,
      contributions: {},
      includedWeight: 0,
    }
  }

  const weightedSum = entries.reduce((sum, e) => sum + e.score * e.weight, 0)
  const provisionalTotal = Math.round((weightedSum / includedWeight) * 100) / 100
  const gradeIsProvisional = pendingCategories.length > 0
  const contributions: Partial<Record<GradeCategoryKey, number>> = {}
  for (const e of entries) {
    contributions[e.key] = Math.round(((e.score * e.weight) / includedWeight) * 100) / 100
  }

  return {
    totalScore: provisionalTotal,
    letterGrade: gradeIsProvisional ? null : calculateLetterGrade(provisionalTotal),
    pendingCategories,
    gradeIsProvisional,
    contributions,
    includedWeight,
  }
}

export async function buildProgressReviewGradebook(input: {
  raw: RawGradebookScores | null
  assessments: AssessmentAttemptSummary[]
  attendance: AttendanceSummary
  classroomPoints: ClassroomPointSummary[]
  practiceHub: PracticeHubSummary
  sessionKey: string | null
}): Promise<ProgressReviewGradebook | null> {
  if (!input.raw) return null

  const weights = (input.sessionKey ? await getGradeWeights(input.sessionKey) : null) ?? DEFAULT_WEIGHTS
  const categoryStatus = detectCategoryStatuses(input)
  const provisional = computeProvisionalGrade(input.raw, categoryStatus, weights)

  return {
    ...input.raw,
    officialTotalScore: input.raw.totalScore,
    officialLetterGrade: input.raw.letterGrade,
    totalScore: provisional.totalScore,
    letterGrade: provisional.letterGrade,
    gradeIsProvisional: provisional.gradeIsProvisional,
    pendingCategories: provisional.pendingCategories,
    categoryStatus,
    provisionalContributions: provisional.contributions,
    includedWeight: provisional.includedWeight,
  }
}

export function reapplyProgressReviewGradebook(
  data: {
    gradebook: ProgressReviewGradebook | RawGradebookScores | null
    assessments: AssessmentAttemptSummary[]
    attendance: AttendanceSummary
    classroomPoints: ClassroomPointSummary[]
    practiceHub: PracticeHubSummary
  },
  weights?: Pick<
    GradeWeights,
    | "quiz_weight"
    | "homework_weight"
    | "midterm_weight"
    | "final_weight"
    | "attendance_weight"
    | "project_weight"
    | "classroom_weight"
    | "engagement_weight"
  >,
): ProgressReviewGradebook | null {
  if (!data.gradebook) return null

  const raw: RawGradebookScores = {
    quizScore: data.gradebook.quizScore,
    homeworkScore: data.gradebook.homeworkScore,
    midtermScore: data.gradebook.midtermScore,
    finalScore: data.gradebook.finalScore,
    attendanceScore: data.gradebook.attendanceScore,
    projectScore: data.gradebook.projectScore,
    classroomScore: data.gradebook.classroomScore,
    engagementCredits: data.gradebook.engagementCredits,
    totalScore:
      "officialTotalScore" in data.gradebook
        ? data.gradebook.officialTotalScore
        : data.gradebook.totalScore,
    letterGrade:
      "officialLetterGrade" in data.gradebook
        ? data.gradebook.officialLetterGrade
        : data.gradebook.letterGrade,
  }

  const w = weights ?? DEFAULT_WEIGHTS
  const categoryStatus = detectCategoryStatuses({ ...data, raw })
  const provisional = computeProvisionalGrade(raw, categoryStatus, w)

  return {
    ...raw,
    officialTotalScore: raw.totalScore,
    officialLetterGrade: raw.letterGrade,
    totalScore: provisional.totalScore,
    letterGrade: provisional.letterGrade,
    gradeIsProvisional: provisional.gradeIsProvisional,
    pendingCategories: provisional.pendingCategories,
    categoryStatus,
    provisionalContributions: provisional.contributions,
    includedWeight: provisional.includedWeight,
  }
}

export function buildGradeContextForAi(gradebook: ProgressReviewGradebook | null): string {
  if (!gradebook) return "Gradebook: not available."

  const status = gradebook.categoryStatus ?? ({} as ProgressReviewGradebook["categoryStatus"])

  const lines = [
    `- Quiz: ${formatProgressReviewCategoryScore(status.quiz, gradebook.quizScore)}`,
    `- Homework: ${formatProgressReviewCategoryScore(status.homework, gradebook.homeworkScore)}`,
    `- Midterm: ${formatProgressReviewCategoryScore(status.midterm, gradebook.midtermScore)}`,
    `- Final: ${formatProgressReviewCategoryScore(status.final, gradebook.finalScore)}`,
    `- Attendance: ${formatProgressReviewCategoryScore(status.attendance, gradebook.attendanceScore)}${
      status.attendance === "scored"
        ? " (scored sessions only — future classes not counted)"
        : ""
    }`,
    `- Classroom: ${formatProgressReviewCategoryScore(status.classroom, gradebook.classroomScore)}`,
    `- Project: ${formatProgressReviewCategoryScore(status.project, gradebook.projectScore)}`,
    `- Engagement credits: ${gradebook.engagementCredits ?? 0}`,
  ]

  if (gradebook.gradeIsProvisional) {
    lines.push(
      `- Overall (completed work only): ${gradebook.totalScore.toFixed(1)}% — NOT a final course grade`,
      `- Pending categories (not yet graded): ${gradebook.pendingCategories.join(", ") || "none"}`,
      `- IMPORTANT: Do NOT call the student failing or assign letter grades like F. Major exams may not have scores yet.`,
    )
  } else {
    lines.push(
      `- Overall: ${gradebook.totalScore.toFixed(1)}%${gradebook.letterGrade ? ` (${gradebook.letterGrade})` : ""}`,
    )
  }

  return `Gradebook:\n${lines.join("\n")}`
}
