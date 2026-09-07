/**
 * Contextual tool discovery — subset role-allowed tools by user intent.
 * Never expands beyond toolsForRole; only narrows.
 */

import type { CoraAgentRole } from "@/lib/cora/roles"
import type { CoraAgentToolName } from "@/lib/cora/tools/openai-tool-definitions"
import { toolsForRole } from "@/lib/cora/agent/clearances"

export type CoraToolIntent =
  | "announcement"
  | "question_bank"
  | "assessment"
  | "results"
  | "messages"
  | "syllabus"
  | "lectures"
  | "flashcards"
  | "notes"
  | "course_notes"
  | "attendance"
  | "groups"
  | "projects"
  | "discussions"
  | "classroom_points"
  | "office_hours"
  | "progress_reviews"
  | "recommendations"
  | "policies"
  | "calendar"
  | "assessment_review"
  | "study_orchestration"
  | "general"

/** Full student multi-module exam/study orchestration toolkit. */
const STUDENT_ORCHESTRATION_TOOLS = [
  "get_student_summary",
  "get_assessments",
  "get_lecture_progress",
  "get_flashcards_and_notes",
  "get_calendar_events",
  "get_assessment_integrity",
  "review_released_attempt",
  "search_lecture_materials",
  "search_platform",
  "get_notifications",
  "propose_study_plan",
  "propose_student_capability",
  "propose_personal_flashcards",
  "propose_personal_note",
  "propose_calendar_study_sessions",
  "propose_practice_quiz",
] as const

const INTENT_TOOL_HINTS: Record<CoraToolIntent, readonly string[]> = {
  announcement: [
    "list_course_announcements",
    "propose_announcement",
    "get_faculty_course_summary",
    "search_platform",
    "remember_fact",
  ],
  question_bank: [
    "propose_question_bank_create",
    "generate_question_drafts",
    "propose_assessment_from_bank",
    "get_faculty_course_summary",
    "search_platform",
  ],
  assessment: [
    "propose_assessment_from_bank",
    "propose_remediation_quiz_plan",
    "propose_question_bank_create",
    "generate_question_drafts",
    "analyze_assessment_results",
    "propose_faculty_capability",
    "get_faculty_course_summary",
    "search_platform",
  ],
  results: [
    "analyze_assessment_results",
    "propose_remediation_quiz_plan",
    "propose_assessment_from_bank",
    "propose_question_bank_create",
    "propose_announcement",
    "propose_message_send",
    "get_faculty_course_summary",
    "search_platform",
    // Student remediation path when "weak topics" is phrased as results analysis
    "get_student_summary",
    "get_assessments",
    "review_released_attempt",
    "propose_personal_flashcards",
    "propose_practice_quiz",
  ],
  messages: [
    "propose_message_send",
    "get_faculty_course_summary",
    "search_platform",
  ],
  syllabus: [
    "propose_syllabus_section",
    "get_faculty_course_summary",
    "search_platform",
  ],
  lectures: [
    "propose_lecture_shell",
    "get_faculty_course_summary",
    "search_platform",
  ],
  flashcards: [
    "create_faculty_flashcard_deck",
    "propose_faculty_capability",
    "propose_personal_flashcards",
    "get_faculty_course_summary",
    "get_flashcards_and_notes",
    "search_lecture_materials",
    "get_student_summary",
    "search_platform",
  ],
  notes: [
    "propose_personal_note",
    "get_flashcards_and_notes",
    "search_lecture_materials",
    "get_student_summary",
    "search_platform",
  ],
  course_notes: [
    "propose_faculty_capability",
    "propose_personal_note",
    "get_faculty_course_summary",
    "search_platform",
  ],
  attendance: [
    "propose_faculty_capability",
    "get_faculty_course_summary",
    "analyze_assessment_results",
    "search_platform",
  ],
  groups: [
    "propose_faculty_capability",
    "get_faculty_course_summary",
    "search_platform",
  ],
  projects: [
    "propose_faculty_capability",
    "get_faculty_course_summary",
    "search_platform",
  ],
  discussions: [
    "propose_faculty_capability",
    "propose_announcement",
    "get_faculty_course_summary",
    "search_platform",
  ],
  classroom_points: [
    "propose_faculty_capability",
    "get_classroom_points",
    "get_faculty_course_summary",
    "search_platform",
  ],
  office_hours: [
    "propose_faculty_capability",
    "get_faculty_course_summary",
    "search_platform",
  ],
  progress_reviews: [
    "propose_faculty_capability",
    "get_faculty_course_summary",
    "search_platform",
  ],
  recommendations: [
    "propose_faculty_capability",
    "get_faculty_course_summary",
    "search_platform",
  ],
  policies: [
    "propose_faculty_capability",
    "get_faculty_course_summary",
    "search_platform",
  ],
  calendar: [
    "propose_calendar_study_sessions",
    "get_calendar_events",
    "get_assessments",
    "get_student_summary",
    "get_lecture_progress",
    "get_flashcards_and_notes",
    "propose_study_plan",
    "propose_personal_flashcards",
    "propose_practice_quiz",
    "search_platform",
  ],
  assessment_review: [
    "get_assessment_integrity",
    "review_released_attempt",
    "get_assessments",
    "propose_personal_flashcards",
    "propose_practice_quiz",
    "get_student_summary",
  ],
  study_orchestration: STUDENT_ORCHESTRATION_TOOLS,
  general: [],
}

/** Multi-module exam prep / study plan orchestration (student). */
export function isStudyOrchestrationIntent(message: string): boolean {
  const t = message.toLowerCase()
  const wantsPlan =
    /\b(study plan|exam prep|prepare for .{0,24}exam|organize my study|study sessions?)\b/i.test(
      t,
    ) || /\b(next exam|upcoming exam|exam next)\b/i.test(t)
  const multiModule =
    [
      /\bflashcards?\b/i,
      /\bpractice\b/i,
      /\bcalendar\b/i,
      /\blectures?\b/i,
      /\bnotes?\b/i,
      /\bassessment/i,
      /\bquiz\b/i,
      /\bhomework\b/i,
      /\bweak(est)?\b/i,
    ].filter((re) => re.test(t)).length >= 2
  const explicitOrchestrate =
    /\b(before you (make|create|save|add) any|show me everything you plan|do not save|confirmation cards?)\b/i.test(
      t,
    )
  return wantsPlan && (multiModule || explicitOrchestrate)
}

export function detectCoraToolIntent(message: string): CoraToolIntent {
  const t = message.toLowerCase()

  // Multi-module student orchestration must win before calendar/results narrowing
  if (isStudyOrchestrationIntent(message)) {
    return "study_orchestration"
  }

  // Remediation / quiz analytics before announcement — packages often also mention an announcement.
  const isResultsOrRemediation =
    /\b(results|what happened|performed badly|struggled|remediation|weak topics?|at risk|weak areas?)\b/i.test(
      t,
    ) ||
    /\b(analyze|diagnose)\b.{0,40}\b(quiz|homework|exam|assessment|results|performance)\b/i.test(t) ||
    /\bmost recently completed quiz\b/i.test(t) ||
    (/\b(remediation package|practice activity)\b/i.test(t) &&
      /\b(quiz|question bank|weak)\b/i.test(t))

  if (isResultsOrRemediation) {
    return "results"
  }

  if (
    /\b(announce|announcement|tell (my |the )?students|running late|class (is )?cancel)\b/i.test(
      t,
    ) ||
    /\b(list|show|what|recent|published|history|past)\b.{0,48}\bannouncements?\b/i.test(t) ||
    /\bannouncements?\b.{0,32}\b(list|history|recent|published|did i)\b/i.test(t)
  ) {
    return "announcement"
  }
  if (
    /\b(message|dm|direct message|email student|write (to|a message)|notify student)\b/i.test(t) ||
    /\b(send|draft)\b.{0,20}\b(message|dm)\b/i.test(t)
  ) {
    return "messages"
  }
  if (/\b(create|make|build|draft)\b.{0,30}\b(quiz|homework|mid[- ]?semester|final|assessment)\b/i.test(
      t,
    ) ||
    /\b(quiz|homework)\b.{0,30}\b(from (the )?bank|from (these|those) questions)\b/i.test(t)
  ) {
    return "assessment"
  }
  if (/\b(publish|release|open)\b.{0,24}\b(quiz|homework|assessment|exam)\b/i.test(t)) {
    return "assessment"
  }
  if (
    /\b(question bank|create \d+ questions|generate .{0,40}questions|mcq|true\/false|select.all|quiz questions)\b/i.test(
      t,
    ) ||
    /\b(create|generate|make)\b.{0,30}\b(questions?|mcqs?)\b/i.test(t)
  ) {
    return "question_bank"
  }
  if (
    /\b(review (my |the )?(last |latest )?(quiz|homework|exam|midterm|attempt)|what did i miss|explain my (mistakes|score))\b/i.test(
      t,
    )
  ) {
    return "assessment_review"
  }
  if (
    /\b(study plan|study session|calendar|organize my study|exam next)\b/i.test(t) ||
    /\b(create|add|schedule)\b.{0,30}\b(study|calendar|reminder)\b/i.test(t)
  ) {
    return "calendar"
  }
  if (/\b(flashcards?|flash cards?|anki|spaced repetition)\b/i.test(t)) {
    return "flashcards"
  }
  if (
    /\b(course notes?|instructor notes?|publish notes? for (the )?class|shared notes?)\b/i.test(
      t,
    ) ||
    (/\b(course notes?|digital notes?)\b/i.test(t) && /\b(create|write|draft|publish)\b/i.test(t))
  ) {
    return "course_notes"
  }
  if (/\b(attendance|check.?in|roll call|present today)\b/i.test(t)) {
    return "attendance"
  }
  if (/\b(groups?|team assignment|auto.?balance groups?)\b/i.test(t) && /\b(create|assign|balance)\b/i.test(t)) {
    return "groups"
  }
  if (/\b(project|deliverable|deadline)\b/i.test(t) && /\b(create|configure|team)\b/i.test(t)) {
    return "projects"
  }
  if (/\b(discussion|forum|thread)\b/i.test(t) && /\b(create|start|open|moderate)\b/i.test(t)) {
    return "discussions"
  }
  if (
    /\b(classroom points?|code assignment|solution assignment|award points?|approve points?)\b/i.test(t) &&
    /\b(create|post|award|approve|assign)\b/i.test(t)
  ) {
    return "classroom_points"
  }
  if (
    /\b(office hours?|regular hours?|availability)\b/i.test(t) &&
    /\b(approve|decline|schedule|create|set|update|manage)\b/i.test(t)
  ) {
    return "office_hours"
  }
  if (
    /\b(progress review|midterm review|mid.?term progress)\b/i.test(t) &&
    /\b(draft|generate|save|publish|deliver|send)\b/i.test(t)
  ) {
    return "progress_reviews"
  }
  if (
    /\b(recommendation letter|letter of recommendation)\b/i.test(t) &&
    /\b(draft|write|save|update)\b/i.test(t)
  ) {
    return "recommendations"
  }
  if (
    /\b(grading policy|attendance policy|late grace|upload multiplier|perks grace)\b/i.test(t) &&
    /\b(update|change|set|configure)\b/i.test(t) &&
    // Explicit syllabus mentions mean editing the syllabus document, not course policy config
    !/\bsyllabus\b/i.test(t)
  ) {
    return "policies"
  }
  if (
    /\b(study notes?|digital notes?|save (as |to )?notes?|take notes?|create notes?)\b/i.test(
      t,
    ) ||
    /\b(turn|convert).{0,40}\b(into|to)\b.{0,20}\bnotes?\b/i.test(t)
  ) {
    return "notes"
  }
  if (/\bsyllabus\b/i.test(t)) {
    return "syllabus"
  }
  if (
    /\b(lecture|lectures)\b/i.test(t) &&
    /\b(create|add|new|shell|week)\b/i.test(t)
  ) {
    return "lectures"
  }
  return "general"
}

/** Intersect role tools with intent hints. Falls back to full role set when general. */
export function toolsForRoleAndIntent(
  role: CoraAgentRole,
  message: string,
): readonly CoraAgentToolName[] {
  const allowed = toolsForRole(role)
  const intent = detectCoraToolIntent(message)
  if (intent === "general") return allowed

  const hints = new Set(INTENT_TOOL_HINTS[intent])
  const narrowed = allowed.filter((name) => hints.has(name))
  // Always keep at least one read tool so the agent can still answer
  if (narrowed.length === 0) return allowed
  return narrowed
}
