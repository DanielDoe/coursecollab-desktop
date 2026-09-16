export type { CoraSession, CoraPrincipalRole, CoraPermissionClaim } from "@/lib/cora/security/types"
export {
  buildStudentCoraSession,
  buildFacultyCoraSession,
  buildAdminCoraSession,
  hashPrompt,
} from "@/lib/cora/security/cora-session"
export { authorizeCoraTool } from "@/lib/cora/security/authorize-tool"
export { logCoraAuditEvent } from "@/lib/cora/security/audit"
export { ROLE_PERMISSIONS, TOOL_REQUIRED_PERMISSIONS, permissionsForRole } from "@/lib/cora/security/capabilities"
export {
  detectActiveHighStakesExam,
  looksLikeExamAnswerRequest,
  ACTIVE_EXAM_REFUSAL,
  refuseIfIntegrityBlocksAnswers,
} from "@/lib/cora/security/exam-guard"
export {
  resolveAssessmentIntegrityContext,
  shouldRefuseAssessmentAnswers,
  assessmentIntegrityAllows,
  formatAssessmentIntegrityForPrompt,
  buildAssessmentIntegrityRefusal,
  buildAssessmentSocraticPromptAppendix,
  gateMessageAgainstIntegrity,
  looksLikeAnswerSeekingRequest,
  isLectureOrPracticeLearningContext,
  overlapTokens,
  tokenCoverageRatio,
  textMatchesAssessmentQuestions,
} from "@/lib/cora/security/assessment-integrity"
export type {
  AssessmentIntegrityContext,
  AssessmentIntegrityCapability,
  AssessmentCoraPolicy,
} from "@/lib/cora/security/assessment-integrity"
export {
  authorizeAsPrincipal,
  studentMutationModuleForTool,
  facultyMutationModuleForTool,
  STUDENT_CORA_AUTHORIZATION_PRINCIPLE,
  FACULTY_CORA_AUTHORIZATION_PRINCIPLE,
} from "@/lib/cora/security/principal-authorization"
export {
  authorizeOwnFlashcardDeck,
  authorizeOwnDigitalNote,
  authorizeOwnCalendarEvent,
  authorizeCreatePersonalCalendar,
} from "@/lib/cora/security/student-resource-auth"
export {
  resolveCoraCapabilities,
  membershipUpsellMessage,
  assertFacultyToolMembership,
} from "@/lib/cora/security/capability-resolver"
export { membershipAllowsCreateTool } from "@/lib/cora/security/membership-gates"
export {
  evaluateCoraDisclosureGate,
  sanitizeCoraToolResult,
  applyCoraOutputSecurityGate,
  authorizeCoraToolGateway,
} from "@/lib/cora/disclosure"
