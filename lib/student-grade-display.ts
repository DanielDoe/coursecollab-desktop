/**
 * Client-safe helpers for student-facing grade display (provisional vs official).
 */

export type StudentGradeApiProvisional = {
  totalScore: number
  letterGrade: string | null
  gradeIsProvisional: boolean
  pendingCategories: string[]
  categoriesUnderReview?: string[]
  includedWeight?: number
  contributions?: {
    quiz?: number
    homework?: number
    midterm?: number
    final?: number
    attendance?: number
    project?: number
    classroom?: number
    engagement?: number
  }
  scores?: {
    quiz?: number
    homework?: number
    midterm?: number
    final?: number
    attendance?: number
    project?: number
    classroom?: number
    engagement?: number
  }
  categoryStatus?: {
    quiz?: "scored" | "pending"
    homework?: "scored" | "pending"
    midterm?: "scored" | "pending"
    final?: "scored" | "pending"
    attendance?: "scored" | "pending"
    project?: "scored" | "pending"
    classroom?: "scored" | "pending"
    engagement?: "scored" | "pending"
  }
}

export type StudentGradeDisplay = {
  totalScore: number
  letterGrade: string | null
  letterLabel: string
  gradeIsProvisional: boolean
  pendingCategories: string[]
  categoryStatus: StudentGradeApiProvisional["categoryStatus"]
}

const CATEGORY_KEY_MAP: Record<string, keyof NonNullable<StudentGradeApiProvisional["categoryStatus"]>> = {
  Quizzes: "quiz",
  Quiz: "quiz",
  Homework: "homework",
  Midterm: "midterm",
  Final: "final",
  Finals: "final",
  Attendance: "attendance",
  Projects: "project",
  Project: "project",
  Classroom: "classroom",
  Engagement: "engagement",
}

const CATEGORY_META = [
  { name: "Quizzes", key: "quiz" as const, scoreField: "quiz_score", contribField: "quiz_contribution", weightField: "quiz_weight" },
  { name: "Homework", key: "homework" as const, scoreField: "homework_score", contribField: "homework_contribution", weightField: "homework_weight" },
  { name: "Midterm", key: "midterm" as const, scoreField: "midterm_score", contribField: "midterm_contribution", weightField: "midterm_weight" },
  { name: "Final", key: "final" as const, scoreField: "final_score", contribField: "final_contribution", weightField: "final_weight" },
  { name: "Projects", key: "project" as const, scoreField: "project_score", contribField: "project_contribution", weightField: "project_weight" },
  { name: "Attendance", key: "attendance" as const, scoreField: "attendance_score", contribField: "attendance_contribution", weightField: "attendance_weight" },
  { name: "Classroom", key: "classroom" as const, scoreField: "classroom_score", contribField: "classroom_contribution", weightField: "classroom_weight" },
  { name: "Engagement", key: "engagement" as const, scoreField: "engagement_credits", contribField: "engagement_contribution", weightField: "engagement_weight", isEngagement: true },
]

export type StudentGradeCategoryRow = {
  name: string
  score: number
  weight: number
  contribution: number
  pending: boolean
  underReview?: boolean
}

export function buildStudentGradeCategories(data: {
  grade?: Record<string, unknown> | null
  weights?: Record<string, unknown> | null
  provisional?: StudentGradeApiProvisional | null
}): StudentGradeCategoryRow[] {
  const g = data.grade ?? {}
  const w = data.weights ?? {}
  const p = data.provisional
  const status = p?.categoryStatus

  return CATEGORY_META.map((cat) => {
    const pending = status ? status[cat.key] === "pending" : false
    const provScore = p?.scores?.[cat.key]
    let score = pending ? 0 : Number(g[cat.scoreField]) || 0
    if (cat.isEngagement) score = Math.min(score, 100)
    if (provScore != null && !pending) score = Number(provScore) || score

    const weight = Number(w[cat.weightField]) || 0
    let contribution = Number(g[cat.contribField]) || 0
    if (p?.contributions && p.contributions[cat.key] != null && !pending) {
      contribution = Number(p.contributions[cat.key]) || 0
    } else if (p?.gradeIsProvisional && pending) {
      contribution = 0
    }

    return {
      name: cat.name,
      score,
      weight,
      contribution,
      pending,
      underReview: (p?.categoriesUnderReview ?? []).includes(cat.name),
    }
  })
}

export function resolveStudentGradeDisplay(data: {
  grade?: { total_score?: number | string; letter_grade?: string | null } | null
  provisional?: StudentGradeApiProvisional | null
}): StudentGradeDisplay {
  const p = data.provisional
  if (p) {
    return {
      totalScore: p.totalScore,
      letterGrade: p.letterGrade,
      letterLabel: p.gradeIsProvisional ? "In progress" : p.letterGrade ?? "—",
      gradeIsProvisional: p.gradeIsProvisional,
      pendingCategories: p.pendingCategories,
      categoryStatus: p.categoryStatus,
    }
  }

  const total =
    typeof data.grade?.total_score === "number"
      ? data.grade.total_score
      : parseFloat(String(data.grade?.total_score ?? "0")) || 0

  return {
    totalScore: total,
    letterGrade: data.grade?.letter_grade ?? null,
    letterLabel: data.grade?.letter_grade ?? "—",
    gradeIsProvisional: false,
    pendingCategories: [],
    categoryStatus: undefined,
  }
}

export function isCategoryPending(
  categoryStatus: StudentGradeApiProvisional["categoryStatus"] | undefined,
  categoryName: string,
): boolean {
  if (!categoryStatus) return false
  const key = CATEGORY_KEY_MAP[categoryName]
  return key ? categoryStatus[key] === "pending" : false
}

const CATEGORY_COLORS: Record<string, string> = {
  Quizzes: "#7C3AED",
  Homework: "#EAAA00",
  Midterm: "#06B6D4",
  Final: "#F43F5E",
  Projects: "#10B981",
  Attendance: "#F59E0B",
  Classroom: "#6366F1",
  Engagement: "#14B8A6",
}

export function studentGradeCategoryColor(name: string): string {
  return CATEGORY_COLORS[name] ?? "var(--cc-accent)"
}

export function formatStudentCategoryScore(
  score: number,
  categoryName: string,
  categoryStatus: StudentGradeApiProvisional["categoryStatus"] | undefined,
  underReview?: boolean,
): string {
  if (isCategoryPending(categoryStatus, categoryName)) {
    return underReview ? "Under review" : "Pending"
  }
  if (categoryName === "Engagement") return `${Math.min(100, score).toFixed(0)} cr`
  return `${score.toFixed(1)}%`
}
