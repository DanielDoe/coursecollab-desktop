/** Module capability manifests — stable contracts Cora uses at runtime (not rediscovered each turn). */

export const AnnouncementsCapability = {
  module: "announcements",
  version: 1,
  entities: ["announcement"] as const,
  supportedOperations: ["read", "create", "publish", "update", "delete"] as const,
  tools: [
    "propose_announcement",
  ] as const,
  confirmation: {
    publish: "required" as const,
  },
  service: "createCourseAnnouncement",
  notes:
    "Create = publish immediately in CourseCollab. Notifications use notifyStudentsForAnnouncement.",
} as const

export const QuestionBankCapability = {
  module: "question-bank",
  version: 1,
  entities: ["question", "topic"] as const,
  supportedOperations: ["read", "create", "update", "archive", "restore"] as const,
  tools: [
    "generate_question_drafts",
    "propose_question_bank_create",
  ] as const,
  confirmation: {
    create: "required" as const,
  },
  service: "bulkCreateQuestionBankQuestions",
  questionTypes: [
    "mcq",
    "true_false",
    "select_all",
    "fill_blank",
    "code_problem",
    "code_write",
    "code_write_plot",
    "code_explain",
    "debug_code",
    "trace_output",
    "multi_part",
    "circuit_submission",
  ] as const,
} as const

export const PersonalFlashcardsCapability = {
  module: "flashcards",
  version: 1,
  entities: ["deck", "card"] as const,
  supportedOperations: ["read", "create", "update", "delete"] as const,
  tools: ["propose_personal_flashcards"] as const,
  confirmation: {
    create: "required" as const,
  },
  deckKind: "student" as const,
  service: "createStudentFlashcardDeck",
} as const

export const PersonalNotesCapability = {
  module: "notes",
  version: 1,
  entities: ["note"] as const,
  supportedOperations: ["read", "create", "update", "delete"] as const,
  tools: ["propose_personal_note"] as const,
  confirmation: {
    create: "required" as const,
  },
  service: "createStudentDigitalNote",
} as const

export const CORA_MODULE_CAPABILITIES = {
  announcements: AnnouncementsCapability,
  "question-bank": QuestionBankCapability,
  flashcards: PersonalFlashcardsCapability,
  notes: PersonalNotesCapability,
} as const

export type CoraModuleCapabilityId = keyof typeof CORA_MODULE_CAPABILITIES

export {
  STUDENT_CORA_MODULE_REGISTRY,
  STUDENT_CORA_AUTHORIZATION_PRINCIPLE,
  getStudentModuleCapability,
  studentModuleAllows,
  buildStudentCapabilityPacket,
} from "@/lib/cora/capabilities/student-module-registry"

export {
  FACULTY_CORA_MODULE_REGISTRY,
  FACULTY_CORA_AUTHORIZATION_PRINCIPLE,
  getFacultyModuleCapability,
  facultyModuleAllows,
  facultyRiskFor,
  buildFacultyCapabilityPacket,
} from "@/lib/cora/capabilities/faculty-module-registry"

export {
  ADMIN_CORA_MODULE_REGISTRY,
  ADMIN_CORA_AUTHORIZATION_PRINCIPLE,
  getAdminModuleCapability,
  adminModuleAllows,
  adminRiskFor,
  buildAdminCapabilityPacket,
  ADMIN_FORBIDDEN_FACULTY_CAPABILITIES,
} from "@/lib/cora/capabilities/admin-module-registry"

export {
  createActionReceipt,
  formatActionReceiptMarkdown,
  receiptToAuditEntry,
} from "@/lib/cora/capabilities/action-receipts"

export {
  buildCoraModuleManifest,
  buildManifestPacket,
} from "@/lib/cora/capabilities/module-manifest"

export {
  CORA_ACTION_RISK_META,
  requiresStrongConfirmation,
  legacyRiskToAction,
  actionRiskToLegacy,
  maxActionRisk,
} from "@/lib/cora/capabilities/risk-levels"
export type { CoraActionRisk, CoraSpecialRiskClass } from "@/lib/cora/capabilities/risk-levels"
