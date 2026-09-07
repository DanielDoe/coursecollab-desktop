/**
 * Map Cora agent intent + tools → specific usage feature/module/operation.
 * Avoid collapsing everything to CHAT / cora-agent for admin visualizations.
 */

import type { CoraAiFeature, CoraRoutingClass } from "@/lib/cora/ai/types"
import type { CoraToolIntent } from "@/lib/cora/agent/intent-tools"
import type { CoraTaskDomain, CoraTaskComplexity } from "@/lib/cora/ai/dynamic-router"

export type CoraUsageClassification = {
  feature: CoraAiFeature
  module: string
  operation: string
  routingClass: CoraRoutingClass
}

const TOOL_FEATURE: Record<string, CoraAiFeature> = {
  list_course_announcements: "ANALYTICS",
  propose_announcement: "OTHER",
  remember_fact: "OTHER",
  generate_question_drafts: "QUESTION_GENERATION",
  propose_question_bank_create: "QUESTION_GENERATION",
  propose_assessment_from_bank: "QUIZ_GENERATION",
  propose_remediation_quiz_plan: "QUIZ_GENERATION",
  analyze_assessment_results: "ANALYTICS",
  propose_message_send: "OTHER",
  propose_syllabus_section: "OTHER",
  propose_lecture_shell: "LECTURE_GENERATION",
  create_faculty_flashcard_deck: "FLASHCARDS",
  propose_faculty_capability: "OTHER",
  propose_student_capability: "OTHER",
  get_faculty_course_summary: "ANALYTICS",
  propose_personal_flashcards: "FLASHCARDS",
  propose_personal_note: "NOTETAKER",
  propose_calendar_study_sessions: "STUDY_PLAN",
  propose_study_plan: "STUDY_PLAN",
  propose_practice_quiz: "QUIZ_GENERATION",
  create_study_plan: "STUDY_PLAN",
  create_practice_quiz: "QUIZ_GENERATION",
  create_flashcards: "FLASHCARDS",
  create_study_note: "NOTETAKER",
  get_student_summary: "ANALYTICS",
  get_assessments: "ANALYTICS",
  get_calendar_events: "ANALYTICS",
  get_lecture_progress: "ANALYTICS",
  get_flashcards_and_notes: "ANALYTICS",
  get_notifications: "ANALYTICS",
  get_attendance: "ANALYTICS",
  get_classroom_points: "ANALYTICS",
  search_platform: "RAG",
  search_lecture_materials: "RAG",
  get_assessment_integrity: "ANALYTICS",
  review_released_attempt: "ANALYTICS",
  get_admin_platform_snapshot: "ANALYTICS",
  get_admin_revenue_summary: "ANALYTICS",
  get_admin_security_overview: "ANALYTICS",
  search_admin_faculty: "ANALYTICS",
  search_admin_students: "ANALYTICS",
  search_admin_courses: "ANALYTICS",
}

const TOOL_MODULE: Record<string, string> = {
  list_course_announcements: "announcements",
  propose_announcement: "announcements",
  remember_fact: "memory",
  generate_question_drafts: "question-bank",
  propose_question_bank_create: "question-bank",
  propose_assessment_from_bank: "quizzes",
  propose_remediation_quiz_plan: "quizzes",
  analyze_assessment_results: "results",
  propose_message_send: "messages",
  propose_syllabus_section: "syllabus",
  propose_lecture_shell: "lectures",
  create_faculty_flashcard_deck: "flashcards",
  get_faculty_course_summary: "dashboard",
  propose_personal_flashcards: "flashcards",
  propose_personal_note: "notes",
  propose_calendar_study_sessions: "calendar",
  propose_study_plan: "calendar",
  propose_practice_quiz: "practice",
  create_study_plan: "calendar",
  create_practice_quiz: "practice",
  search_platform: "search",
  search_lecture_materials: "lectures",
  review_released_attempt: "quiz-history",
  get_assessment_integrity: "quizzes",
}

const INTENT_FEATURE: Record<CoraToolIntent, CoraAiFeature> = {
  announcement: "OTHER",
  question_bank: "QUESTION_GENERATION",
  assessment: "QUIZ_GENERATION",
  results: "ANALYTICS",
  messages: "OTHER",
  syllabus: "OTHER",
  lectures: "LECTURE_GENERATION",
  flashcards: "FLASHCARDS",
  notes: "NOTETAKER",
  course_notes: "NOTETAKER",
  attendance: "OTHER",
  groups: "OTHER",
  projects: "OTHER",
  discussions: "OTHER",
  classroom_points: "OTHER",
  office_hours: "OTHER",
  progress_reviews: "ANALYTICS",
  recommendations: "OTHER",
  policies: "OTHER",
  calendar: "STUDY_PLAN",
  assessment_review: "ANALYTICS",
  study_orchestration: "STUDY_PLAN",
  general: "AGENT_TOOL_CALL",
}

const INTENT_MODULE: Record<CoraToolIntent, string> = {
  announcement: "announcements",
  question_bank: "question-bank",
  assessment: "quizzes",
  results: "results",
  messages: "messages",
  syllabus: "syllabus",
  lectures: "lectures",
  flashcards: "flashcards",
  notes: "notes",
  course_notes: "course-notes",
  attendance: "attendance",
  groups: "groups",
  projects: "projects",
  discussions: "discussions",
  classroom_points: "classroom-points",
  office_hours: "office-hours",
  progress_reviews: "progress-reviews",
  recommendations: "recommendations",
  policies: "course-settings",
  calendar: "calendar",
  assessment_review: "quiz-history",
  study_orchestration: "study-plan",
  general: "cora-agent",
}

const INTENT_OPERATION: Record<CoraToolIntent, string> = {
  announcement: "announcement_assist",
  question_bank: "question_bank_assist",
  assessment: "assessment_assist",
  results: "results_analysis",
  messages: "message_assist",
  syllabus: "syllabus_assist",
  lectures: "lecture_assist",
  flashcards: "flashcard_assist",
  notes: "notes_assist",
  course_notes: "course_notes_assist",
  attendance: "attendance_assist",
  groups: "groups_assist",
  projects: "projects_assist",
  discussions: "discussions_assist",
  classroom_points: "classroom_points_assist",
  office_hours: "office_hours_assist",
  progress_reviews: "progress_review_assist",
  recommendations: "recommendation_assist",
  policies: "policy_assist",
  calendar: "calendar_assist",
  assessment_review: "attempt_review",
  study_orchestration: "study_orchestration",
  general: "agent_turn",
}

export function routingClassForDomain(
  domain: CoraTaskDomain,
  complexity: CoraTaskComplexity,
): CoraRoutingClass {
  if (domain === "code") return "CODE"
  if (domain === "lightweight" || complexity === "simple") return "FAST"
  if (complexity === "complex" || domain === "reasoning") return "ADVANCED_REASONING"
  return "STANDARD"
}

export function routingClassForProfile(profile: string | null | undefined): CoraRoutingClass | null {
  switch (profile) {
    case "lite":
      return "LITE"
    case "fast":
      return "FAST"
    case "standard":
      return "STANDARD"
    case "tutor":
      return "TUTOR"
    case "coding":
      return "CODE"
    case "vision":
      return "VISION"
    case "agent":
      return "AGENT"
    case "long_context":
      return "DOCUMENT"
    case "reasoning":
      return "REASONING"
    case "advanced_reasoning":
      return "ADVANCED_REASONING"
    case "verifier":
      return "VERIFIER"
    case "embedding":
      return "EMBEDDING"
    default:
      return null
  }
}

/** Classify a turn before tools run (intent + domain). */
export function classifyCoraAgentTurn(input: {
  intent: CoraToolIntent
  domain: CoraTaskDomain
  complexity: CoraTaskComplexity
  role: "assistant" | "copilot" | "admin"
  profile?: string | null
}): CoraUsageClassification {
  const feature =
    input.domain === "code"
      ? ("CODE_HELP" as const)
      : INTENT_FEATURE[input.intent] ?? "AGENT_TOOL_CALL"

  return {
    feature,
    module: INTENT_MODULE[input.intent] ?? "cora-agent",
    operation: INTENT_OPERATION[input.intent] ?? "agent_turn",
    routingClass:
      routingClassForProfile(input.profile) ?? routingClassForDomain(input.domain, input.complexity),
  }
}

/** Refine classification after tools execute (prefer primary tool). */
export function classifyAfterTools(
  base: CoraUsageClassification,
  toolNames: string[],
): CoraUsageClassification {
  if (!toolNames.length) return base
  const primary = toolNames[0]!
  return {
    feature: TOOL_FEATURE[primary] ?? base.feature,
    module: TOOL_MODULE[primary] ?? base.module,
    operation: primary,
    routingClass: base.routingClass,
  }
}

export function creditDescriptionForUsage(input: {
  feature: CoraAiFeature
  module?: string | null
  operation?: string | null
  toolName?: string | null
  model: string
}): string {
  const op = input.toolName || input.operation || "agent_turn"
  const mod = input.module || "cora"
  return `${input.feature} · ${mod}/${op} · ${input.model}`
}
