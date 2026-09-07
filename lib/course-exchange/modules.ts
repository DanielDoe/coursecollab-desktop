import type { CourseExchangeModule } from "@/lib/course-exchange/types"
import { COURSE_EXCHANGE_MODULES } from "@/lib/course-exchange/types"

export { COURSE_EXCHANGE_MODULES }

export const COURSE_EXCHANGE_MODULE_LABELS: Record<CourseExchangeModule, string> = {
  syllabus: "Syllabus",
  lectures: "Lectures",
  course_notes: "Course Notes",
  question_bank: "Question Bank",
  practice_hub: "Practice Hub",
  flashcards: "Flashcards",
  quizzes: "Quizzes",
  homework: "Homework",
  classroom_points: "Classroom Points",
  playground: "Playground",
  mid_semester_exams: "Mid-Semester Exams",
  final_exams: "Final Exams",
  projects: "Projects",
  groups: "Groups",
}

/** Sensitive categories default unselected at approval time. */
export const COURSE_EXCHANGE_DEFAULT_APPROVAL_MODULES: CourseExchangeModule[] = [
  "syllabus",
  "lectures",
  "course_notes",
  "question_bank",
  "practice_hub",
  "flashcards",
  "quizzes",
  "homework",
  "classroom_points",
  "playground",
  "mid_semester_exams",
]

export const COURSE_EXCHANGE_SENSITIVE_MODULES: CourseExchangeModule[] = [
  "final_exams",
  "projects",
  "groups",
]

export function isCourseExchangeModule(value: unknown): value is CourseExchangeModule {
  return typeof value === "string" && (COURSE_EXCHANGE_MODULES as readonly string[]).includes(value)
}

export function normalizeModuleList(raw: unknown): CourseExchangeModule[] {
  if (!Array.isArray(raw)) return []
  const out: CourseExchangeModule[] = []
  for (const item of raw) {
    if (isCourseExchangeModule(item) && !out.includes(item)) out.push(item)
  }
  return out
}

/** Requester hint only — creator decides approved_modules at review. */
export function defaultRequestedModules(): CourseExchangeModule[] {
  return [...COURSE_EXCHANGE_DEFAULT_APPROVAL_MODULES]
}

export function defaultApprovalModules(): CourseExchangeModule[] {
  return [...COURSE_EXCHANGE_DEFAULT_APPROVAL_MODULES]
}

export function modulesInclude(
  selected: CourseExchangeModule[],
  module: CourseExchangeModule,
): boolean {
  return selected.includes(module)
}

export function assessmentTypesForModules(modules: CourseExchangeModule[]): string[] {
  const types: string[] = []
  if (modulesInclude(modules, "quizzes")) types.push("quiz")
  if (modulesInclude(modules, "homework")) types.push("homework")
  if (modulesInclude(modules, "mid_semester_exams")) types.push("mid_semester")
  if (modulesInclude(modules, "final_exams")) types.push("final")
  return types
}

export function questionBankRequired(modules: CourseExchangeModule[]): boolean {
  return (
    modulesInclude(modules, "question_bank") ||
    modulesInclude(modules, "practice_hub") ||
    modulesInclude(modules, "quizzes") ||
    modulesInclude(modules, "homework") ||
    modulesInclude(modules, "mid_semester_exams") ||
    modulesInclude(modules, "final_exams") ||
    modulesInclude(modules, "playground") ||
    modulesInclude(modules, "classroom_points")
  )
}
