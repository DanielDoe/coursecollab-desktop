/**
 * Deterministic module context packages. Runtime Cora must not scan the codebase.
 */

export type CoraModuleContext = {
  module: string
  version: string
  capabilities: string[]
  requiredContext: string[]
  excludedContext: string[]
  confirmationPolicy: "none" | "preview" | "strong"
  serviceHint: string
}

export const CORA_MODULE_CONTEXTS: Record<string, CoraModuleContext> = {
  ANNOUNCEMENTS: {
    module: "announcements",
    version: "1",
    capabilities: ["list", "draft", "publish"],
    requiredContext: ["courseId", "courseName", "section", "audienceCount"],
    excludedContext: ["questionBank", "gradebook", "lectures", "studentAnalytics"],
    confirmationPolicy: "preview",
    serviceHint: "lib/cora/services/create-announcement.ts",
  },
  QUESTION_BANK: {
    module: "question-bank",
    version: "1",
    capabilities: ["draft", "validate", "batchCreate"],
    requiredContext: ["courseId", "topic", "canonicalQuestionSchema", "learningMaterials"],
    excludedContext: ["studentRecords", "gradebook"],
    confirmationPolicy: "preview",
    serviceHint: "lib/cora/services/bulk-create-questions.ts",
  },
  QUIZZES: {
    module: "quizzes",
    version: "1",
    capabilities: ["draftFromBank", "preview"],
    requiredContext: ["courseId", "topic", "assessmentDefaults", "questionSchema"],
    excludedContext: ["allStudentRecords"],
    confirmationPolicy: "preview",
    serviceHint: "lib/cora/services/create-assessment-from-bank.ts",
  },
  NOTES: {
    module: "notes",
    version: "1",
    capabilities: ["createPersonalNote"],
    requiredContext: ["studentId", "title", "body"],
    excludedContext: ["facultyTools", "gradebook"],
    confirmationPolicy: "none",
    serviceHint: "lib/cora/services/create-student-digital-note.ts",
  },
  FLASHCARDS: {
    module: "flashcards",
    version: "1",
    capabilities: ["createPersonalDeck"],
    requiredContext: ["studentId", "topic", "cards"],
    excludedContext: ["facultyQuestionBank"],
    confirmationPolicy: "none",
    serviceHint: "lib/cora/services/create-student-flashcard-deck.ts",
  },
  CAREER_RESUME: {
    module: "career-resume",
    version: "1",
    capabilities: ["parse", "match", "rewrite"],
    requiredContext: ["careerProfile", "jobProfile"],
    excludedContext: ["fullResumeTextEveryTurn", "fullJobDescriptionEveryTurn"],
    confirmationPolicy: "none",
    serviceHint: "lib/cora/agent/run-guest-cora-agent.ts",
  },
}

export function getCoraModuleContext(module: string): CoraModuleContext | null {
  const key = module.trim().toUpperCase().replace(/-/g, "_")
  return CORA_MODULE_CONTEXTS[key] ?? null
}
