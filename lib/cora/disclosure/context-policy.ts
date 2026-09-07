/**
 * CoraContextPolicy — least-context retrieval.
 * Agent knowledge ≠ user-disclosable information.
 */

import type { CoraToolIntent } from "@/lib/cora/agent/intent-tools"
import type { CoraAgentRole } from "@/lib/cora/roles"
import { CORA_DISCLOSURE_POLICY } from "@/lib/cora/disclosure/prompt-policy"

export { COURSECOLLAB_SECURITY_INTERNAL } from "@/lib/cora/disclosure/types"

const STUDENT_MODULES: Record<CoraToolIntent, string[]> = {
  flashcards: ["flashcards"],
  notes: ["notes"],
  calendar: ["calendar"],
  assessment: ["quizzes", "quiz-history"],
  assessment_review: ["quiz-history", "grades"],
  study_orchestration: [
    "notes",
    "flashcards",
    "calendar",
    "practice",
    "quizzes",
    "quiz-history",
    "grades",
    "lectures",
  ],
  announcement: ["announcements"],
  question_bank: ["practice"],
  results: ["grades", "quiz-history"],
  messages: ["messages"],
  syllabus: ["syllabus"],
  lectures: ["lectures"],
  course_notes: ["notes"],
  attendance: ["attendance"],
  groups: ["groups"],
  projects: ["projects", "groups"],
  discussions: ["forum"],
  classroom_points: ["classroom-points"],
  office_hours: ["office-hours", "calendar"],
  progress_reviews: ["grades", "progress-review"],
  recommendations: ["recommendations"],
  policies: ["syllabus"],
  general: ["grades", "lectures"],
}

const FACULTY_MODULES: Record<CoraToolIntent, string[]> = {
  announcement: ["announcements", "dashboard"],
  question_bank: ["question-bank", "dashboard"],
  assessment: ["quizzes", "question-bank", "dashboard"],
  results: ["results", "student-progress", "dashboard"],
  messages: ["messages", "dashboard"],
  syllabus: ["syllabus", "dashboard"],
  lectures: ["lectures", "dashboard"],
  flashcards: ["flashcards", "dashboard"],
  notes: ["course-notes", "dashboard"],
  course_notes: ["course-notes", "dashboard"],
  attendance: ["attendance", "dashboard"],
  groups: ["groups", "dashboard"],
  projects: ["projects", "groups", "dashboard"],
  discussions: ["discussions", "dashboard"],
  classroom_points: ["classroom-points", "dashboard"],
  office_hours: ["office-hours", "dashboard"],
  progress_reviews: ["progress-reviews", "student-progress", "dashboard"],
  recommendations: ["recommendations", "dashboard"],
  policies: ["course-settings", "grading-policies", "attendance-policies", "dashboard"],
  calendar: ["dashboard"],
  assessment_review: ["results", "quizzes", "dashboard"],
  study_orchestration: ["quizzes", "question-bank", "results", "dashboard"],
  general: ["dashboard", "announcements"],
}

const ADMIN_MODULES: Record<CoraToolIntent, string[]> = {
  announcement: ["global-announcements"],
  question_bank: ["assessment-oversight"],
  assessment: ["assessment-oversight"],
  results: ["student-success", "enrollment-analytics"],
  messages: ["global-announcements"],
  syllabus: ["course-catalog"],
  lectures: ["course-catalog"],
  flashcards: ["course-catalog"],
  notes: ["course-catalog"],
  course_notes: ["course-catalog"],
  attendance: ["course-catalog"],
  groups: ["course-catalog"],
  projects: ["course-catalog"],
  discussions: ["course-catalog"],
  classroom_points: ["course-catalog"],
  office_hours: ["course-catalog"],
  progress_reviews: ["student-success"],
  recommendations: ["course-catalog"],
  policies: ["course-catalog"],
  calendar: ["terms-sections"],
  assessment_review: ["assessment-oversight", "submission-diagnostics"],
  study_orchestration: ["student-success"],
  general: ["system-monitor", "faculty", "students"],
}

export function leastContextModulesForIntent(
  role: CoraAgentRole,
  intent: CoraToolIntent,
): string[] {
  if (role === "assistant") return STUDENT_MODULES[intent] ?? STUDENT_MODULES.general
  if (role === "copilot") return FACULTY_MODULES[intent] ?? FACULTY_MODULES.general
  return ADMIN_MODULES[intent] ?? ADMIN_MODULES.general
}

export function appendCoraDisclosurePolicy(systemPrompt: string): string {
  const base = String(systemPrompt ?? "").trim()
  if (base.includes("INTERNAL EXECUTION CONTEXT")) return base
  return `${CORA_DISCLOSURE_POLICY}\n\n${base}`
}
