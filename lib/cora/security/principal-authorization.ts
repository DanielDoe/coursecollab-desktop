/**
 * Principal authorization — Cora has no independent privileges.
 *
 * Cora acts *on behalf of* the authenticated CourseCollab user.
 * Tool clearance filters which tools are *offered*; object-level checks
 * in module services remain the final security boundary.
 */

import type { CoraSession } from "@/lib/cora/security/types"
import type { CoraAgentToolName } from "@/lib/cora/tools/openai-tool-definitions"
import { authorizeCoraTool } from "@/lib/cora/security/authorize-tool"
import {
  getStudentModuleCapability,
  studentModuleAllows,
  type StudentCoraModuleId,
  type StudentCoraOperation,
  STUDENT_CORA_AUTHORIZATION_PRINCIPLE,
} from "@/lib/cora/capabilities/student-module-registry"
import {
  getFacultyModuleCapability,
  facultyModuleAllows,
  type FacultyCoraModuleId,
  type FacultyCoraOperation,
  FACULTY_CORA_AUTHORIZATION_PRINCIPLE,
} from "@/lib/cora/capabilities/faculty-module-registry"
import {
  isFacultyRegistryCapabilityId,
  resolveFacultyModuleForCapability,
} from "@/lib/cora/capabilities/faculty-tool-registry"
import { resolveCapabilityWriteOperation } from "@/lib/cora/capabilities/capability-write-ops"
import {
  isStudentRegistryCapabilityId,
  resolveStudentModuleForCapability,
} from "@/lib/cora/capabilities/student-tool-registry"
import { parseStudentCapabilityId } from "@/lib/cora/capabilities/student-write-ops"
import {
  getAdminModuleCapability,
  adminModuleAllows,
  type AdminCoraModuleId,
  type AdminCoraOperation,
} from "@/lib/cora/capabilities/admin-module-registry"
import { assertFacultyToolMembership } from "@/lib/cora/security/capability-resolver"

export { STUDENT_CORA_AUTHORIZATION_PRINCIPLE, FACULTY_CORA_AUTHORIZATION_PRINCIPLE }

export type PrincipalAuthDecision =
  | { ok: true; principalUserId: number; role: CoraSession["role"] }
  | { ok: false; code: "role" | "permission" | "scope" | "module" | "membership"; reason: string }

/**
 * Authorize a Cora tool as the session principal (never as a privileged AI user).
 */
export function authorizeAsPrincipal(
  session: CoraSession,
  toolName: CoraAgentToolName,
  opts?: {
    targetCourseId?: number | null
    targetStudentId?: number | null
    targetSectionId?: number | null
    moduleId?: string
    operation?: string
  },
): PrincipalAuthDecision {
  const toolAuth = authorizeCoraTool(session, toolName, opts)
  if (!toolAuth.ok) {
    return { ok: false, code: toolAuth.code, reason: toolAuth.reason }
  }

  if (session.role === "student") {
    const mutationMap = studentMutationModuleForTool(toolName)
    const moduleId = (opts?.moduleId as StudentCoraModuleId | undefined) ?? mutationMap?.moduleId
    const operation = (opts?.operation as StudentCoraOperation | undefined) ?? mutationMap?.operation
    if (moduleId && operation) {
      const cap = getStudentModuleCapability(moduleId)
      if (!cap) {
        return { ok: false, code: "module", reason: `Unknown student module: ${moduleId}` }
      }
      if (!studentModuleAllows(moduleId, operation)) {
        return {
          ok: false,
          code: "module",
          reason: `${operation} is not allowed on ${cap.label} for Student Cora`,
        }
      }
      if (cap.resourceClass === "faculty_hidden" || cap.resourceClass === "admin") {
        return { ok: false, code: "module", reason: `${cap.label} is outside student scope` }
      }
    }
    if (opts?.targetStudentId != null && opts.targetStudentId !== session.userId) {
      return { ok: false, code: "scope", reason: "Students may only access their own data" }
    }
  }

  if (session.role === "faculty") {
    const membership = assertFacultyToolMembership(session, toolName)
    if (!membership.ok) {
      return { ok: false, code: "membership", reason: membership.reason }
    }

    const mutationMap = facultyMutationModuleForTool(toolName)
    const moduleId = (opts?.moduleId as FacultyCoraModuleId | undefined) ?? mutationMap?.moduleId
    const operation = (opts?.operation as FacultyCoraOperation | undefined) ?? mutationMap?.operation
    if (moduleId && operation) {
      const cap = getFacultyModuleCapability(moduleId)
      if (!cap) {
        return { ok: false, code: "module", reason: `Unknown faculty module: ${moduleId}` }
      }
      if (!facultyModuleAllows(moduleId, operation)) {
        return {
          ok: false,
          code: "module",
          reason: `${operation} is not allowed on ${cap.label} for Faculty Cora`,
        }
      }
    }
    // Course scope: target course must be in session courseIds
    if (
      opts?.targetCourseId != null &&
      session.courseIds.length > 0 &&
      !session.courseIds.includes(Number(opts.targetCourseId))
    ) {
      return { ok: false, code: "scope", reason: "Course is outside this instructor's assignment" }
    }
  }

  if (session.role === "admin") {
    // Never allow faculty teaching tools through Admin principal
    if (
      toolName === "propose_question_bank_create" ||
      toolName === "generate_question_drafts" ||
      toolName === "propose_announcement" ||
      toolName === "get_faculty_course_summary"
    ) {
      return {
        ok: false,
        code: "module",
        reason: "Admin Cora cannot use Faculty teaching tools",
      }
    }
    const mutationMap = adminMutationModuleForTool(toolName)
    const moduleId = (opts?.moduleId as AdminCoraModuleId | undefined) ?? mutationMap?.moduleId
    const operation = (opts?.operation as AdminCoraOperation | undefined) ?? mutationMap?.operation
    if (moduleId && operation) {
      const cap = getAdminModuleCapability(moduleId)
      if (!cap) {
        return { ok: false, code: "module", reason: `Unknown admin module: ${moduleId}` }
      }
      if (cap.status !== "live") {
        return {
          ok: false,
          code: "module",
          reason: `${cap.label} is planned — no executable Admin Cora tools yet`,
        }
      }
      if (!adminModuleAllows(moduleId, operation)) {
        return {
          ok: false,
          code: "module",
          reason: `${operation} is not allowed on ${cap.label} for Admin Cora`,
        }
      }
    }
  }

  return { ok: true, principalUserId: session.userId, role: session.role }
}

/** Map proposal / mutation tools to student module + operation for registry checks. */
export function studentMutationModuleForTool(
  toolName: string,
): { moduleId: StudentCoraModuleId; operation: StudentCoraOperation } | null {
  switch (toolName) {
    case "propose_personal_note":
    case "create_study_note":
    case "personalNotes.create":
      return { moduleId: "notes", operation: "create" }
    case "propose_personal_flashcards":
    case "create_flashcards":
    case "personalFlashcards.createDeck":
      return { moduleId: "flashcards", operation: "create" }
    case "propose_practice_quiz":
    case "create_practice_quiz":
    case "personalPracticeQuiz.create":
      return { moduleId: "practice", operation: "start" }
    case "propose_study_plan":
    case "personalStudyPlan.create":
    case "create_study_plan":
    case "propose_calendar_study_sessions":
    case "personalCalendar.createEvents":
    case "calendar.createStudySessions":
      return { moduleId: "calendar", operation: "create" }
    case "propose_student_capability":
      return null
    case "get_assessment_integrity":
      return { moduleId: "quizzes", operation: "read" }
    case "review_released_attempt":
      return { moduleId: "quiz-history", operation: "read" }
    case "remember_fact":
      return { moduleId: "notes", operation: "read" }
    default: {
      if (isStudentRegistryCapabilityId(toolName)) {
        const moduleId = resolveStudentModuleForCapability(toolName)
        const parsed = parseStudentCapabilityId(toolName)
        if (moduleId && parsed) {
          return { moduleId, operation: parsed.operation as StudentCoraOperation }
        }
      }
      return null
    }
  }
}

export function facultyMutationModuleForTool(
  toolName: string,
): { moduleId: FacultyCoraModuleId; operation: FacultyCoraOperation } | null {
  if (isFacultyRegistryCapabilityId(toolName)) {
    const moduleId = resolveFacultyModuleForCapability(toolName)
    const operation = resolveCapabilityWriteOperation(toolName)
    if (moduleId && operation) {
      return { moduleId, operation }
    }
  }

  switch (toolName) {
    case "propose_announcement":
    case "announcement.publish":
      return { moduleId: "announcements", operation: "publish" }
    case "list_course_announcements":
    case "announcement.list":
      return { moduleId: "announcements", operation: "list" }
    case "remember_fact":
      return { moduleId: "dashboard", operation: "read" }
    case "propose_question_bank_create":
    case "generate_question_drafts":
    case "questionBank.createQuestions":
      return { moduleId: "question-bank", operation: "create" }
    case "propose_assessment_from_bank":
    case "propose_remediation_quiz_plan":
    case "assessment.createFromBank":
      return { moduleId: "quizzes", operation: "create" }
    case "propose_message_send":
    case "message.send":
      return { moduleId: "messages", operation: "send" }
    case "analyze_assessment_results":
      return { moduleId: "results", operation: "analyze" }
    case "propose_syllabus_section":
    case "syllabus.saveSection":
    case "syllabus.publishSection":
      return { moduleId: "syllabus", operation: "update" }
    case "propose_lecture_shell":
    case "lecture.createShell":
      return { moduleId: "lectures", operation: "create" }
    case "create_faculty_flashcard_deck":
    case "flashcard.generateFromBank":
      return { moduleId: "flashcards", operation: "create" }
    case "propose_faculty_capability":
      return null
    case "courseNote.create":
      return { moduleId: "course-notes", operation: "create" }
    case "group.create":
      return { moduleId: "groups", operation: "create" }
    case "project.create":
      return { moduleId: "projects", operation: "create" }
    case "attendance.createSession":
      return { moduleId: "attendance", operation: "create" }
    case "discussion.create":
    case "discussion.moderate":
    case "discussion.pin":
    case "discussion.update":
      return { moduleId: "discussions", operation: "create" }
    case "playground.createSession":
      return { moduleId: "playground", operation: "create" }
    case "assessment.publish":
      return { moduleId: "quizzes", operation: "publish" }
    case "points.createAssignment":
      return { moduleId: "classroom-points", operation: "create" }
    case "points.approve":
      return { moduleId: "classroom-points", operation: "approve" }
    case "points.award":
      return { moduleId: "classroom-points", operation: "award" }
    case "officeHours.createMeeting":
      return { moduleId: "office-hours", operation: "create" }
    case "officeHours.approve":
      return { moduleId: "office-hours", operation: "approve" }
    case "officeHours.decline":
      return { moduleId: "office-hours", operation: "update" }
    case "officeHours.manageAvailability":
      return { moduleId: "office-hours", operation: "configure" }
    case "progressReview.draft":
    case "progressReview.save":
    case "progressReview.edit":
      return { moduleId: "progress-reviews", operation: "create" }
    case "progressReview.publish":
      return { moduleId: "progress-reviews", operation: "publish" }
    case "recommendation.draft":
      return { moduleId: "recommendations", operation: "create" }
    case "gradingPolicy.update":
      return { moduleId: "grading-policies", operation: "update" }
    case "attendancePolicy.update":
      return { moduleId: "attendance-policies", operation: "update" }
    case "get_faculty_course_summary":
      return { moduleId: "dashboard", operation: "read" }
    default:
      return null
  }
}

export function adminMutationModuleForTool(
  toolName: string,
): { moduleId: AdminCoraModuleId; operation: AdminCoraOperation } | null {
  switch (toolName) {
    case "get_admin_platform_snapshot":
      return { moduleId: "system-monitor", operation: "read" }
    case "get_admin_revenue_summary":
      return { moduleId: "revenue", operation: "read" }
    case "get_admin_security_overview":
    case "get_admin_governance_hints":
      return { moduleId: "security", operation: "read" }
    case "search_platform":
      return { moduleId: "system-monitor", operation: "search" }
    case "search_admin_faculty":
      return { moduleId: "faculty", operation: "search" }
    case "search_admin_students":
      return { moduleId: "students", operation: "search" }
    case "search_admin_courses":
      return { moduleId: "course-catalog", operation: "search" }
    case "list_admin_academic_terms":
      return { moduleId: "terms-sections", operation: "list" }
    case "get_admin_student_success":
      return { moduleId: "student-success", operation: "read" }
    case "get_admin_enrollment_analytics":
      return { moduleId: "enrollment-analytics", operation: "analyze" }
    case "list_admin_password_resets":
      return { moduleId: "account-management", operation: "list" }
    case "propose_admin_password_reset_decision":
    case "account.passwordReset.approve":
      return { moduleId: "account-management", operation: "approve" }
    case "account.passwordReset.reject":
      return { moduleId: "account-management", operation: "reject" }
    case "search_admin_submission_issues":
      return { moduleId: "submission-diagnostics", operation: "search" }
    case "search_admin_system_logs":
      return { moduleId: "logs", operation: "search" }
    case "search_admin_audit_logs":
      return { moduleId: "audit-logs", operation: "search" }
    default:
      return null
  }
}
