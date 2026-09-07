import type { CoraAgentToolName } from "@/lib/cora/tools/openai-tool-definitions"

export type CoraCapabilityRole = "faculty" | "student"

/**
 * When a registry capability has a first-class propose_* tool, route proposals there automatically.
 * Keeps one registry id while preserving specialized tool schemas / UX.
 */
export const FACULTY_CAPABILITY_DEDICATED_TOOLS: Record<string, CoraAgentToolName> = {
  "announcement.publish": "propose_announcement",
  "announcement.create": "propose_announcement",
  "question.bulkCreate": "propose_question_bank_create",
  "question.create": "propose_question_bank_create",
  "assessment.create": "propose_assessment_from_bank",
  "message.send": "propose_message_send",
  "syllabus.update": "propose_syllabus_section",
  "syllabus.publish": "propose_syllabus_section",
  "syllabus.draft": "propose_syllabus_section",
  "lecture.create": "propose_lecture_shell",
  "flashcard.generateFromBank": "create_faculty_flashcard_deck",
  "courseExchange.request": "propose_course_exchange_request",
  "courseExchange.approve": "propose_course_exchange_approval",
  "courseExchange.reject": "propose_course_exchange_approval",
  "courseExchange.importCopy": "propose_course_exchange_import",
}

export const STUDENT_CAPABILITY_DEDICATED_TOOLS: Record<string, CoraAgentToolName> = {
  "flashcards.create": "propose_personal_flashcards",
  "flashcards.generate": "propose_personal_flashcards",
  "notes.create": "propose_personal_note",
  "notes.generate": "propose_personal_note",
  "calendar.create": "propose_calendar_study_sessions",
  "practice.start": "propose_practice_quiz",
  "practice.generate": "propose_practice_quiz",
  "ai-notetaker.generate": "propose_study_plan",
  "progress-review.generate": "propose_study_plan",
}

export function getDedicatedProposeTool(
  role: CoraCapabilityRole,
  capabilityId: string,
): CoraAgentToolName | null {
  const map = role === "faculty" ? FACULTY_CAPABILITY_DEDICATED_TOOLS : STUDENT_CAPABILITY_DEDICATED_TOOLS
  return map[capabilityId] ?? null
}

/** Legacy confirm-action tool names for capabilities executed through dedicated confirm paths. */
export const STUDENT_CAPABILITY_LEGACY_CONFIRM_TOOLS: Record<string, string> = {
  "flashcards.create": "personalFlashcards.createDeck",
  "flashcards.generate": "personalFlashcards.createDeck",
  "notes.create": "personalNotes.create",
  "notes.generate": "personalNotes.create",
  "calendar.create": "personalCalendar.createEvents",
  "practice.start": "personalPracticeQuiz.create",
  "practice.generate": "personalPracticeQuiz.create",
  "ai-notetaker.generate": "personalStudyPlan.create",
  "progress-review.generate": "personalStudyPlan.create",
}

export const FACULTY_CAPABILITY_LEGACY_CONFIRM_TOOLS: Record<string, string> = {
  "announcement.publish": "announcement.publish",
  "question.bulkCreate": "questionBank.createQuestions",
  "assessment.create": "assessment.createFromBank",
  "message.send": "message.send",
  "syllabus.update": "syllabus.saveSection",
  "syllabus.publish": "syllabus.publishSection",
  "lecture.create": "lecture.createShell",
  "flashcard.generateFromBank": "flashcard.generateFromBank",
}

export function getLegacyConfirmTool(role: CoraCapabilityRole, capabilityId: string): string | null {
  const map =
    role === "faculty" ? FACULTY_CAPABILITY_LEGACY_CONFIRM_TOOLS : STUDENT_CAPABILITY_LEGACY_CONFIRM_TOOLS
  return map[capabilityId] ?? null
}
