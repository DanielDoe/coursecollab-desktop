export {
  requireAuthenticatedUser,
  requireStudent,
  requireFaculty,
  requireAdmin,
  requireCourseOwnership,
  requireAdminOrFaculty,
  requireRole,
} from "@/lib/security/principal"
export { sanitizeUserHtml, sanitizeStoredContent, looksLikeHtml } from "@/lib/security/sanitize-html"
export {
  allowedCorsOrigins,
  isAllowedCorsOrigin,
  corsAllowOriginValue,
  isBlockedCrossOriginMutation,
} from "@/lib/security/cors"
export { assertSafeServerFetchUrl, isBlockedServerFetchHost } from "@/lib/security/ssrf"
export {
  pickSafeStudentFields,
  pickSafeFacultyFields,
  pickSafeAdminFields,
  stripHiddenAssessmentFields,
} from "@/lib/security/dto"
export { logSecurityEvent } from "@/lib/security/audit"
