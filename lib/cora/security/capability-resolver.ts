/**
 * Shared Cora capability resolver.
 *
 * One runtime → Student | Faculty | Admin profiles.
 * Authenticated identity determines available tools; the model never expands them.
 *
 * Module capability IDs / risk / transaction plans:
 *   `@/lib/cora/capabilities/resolve-capabilities`
 */

import type { CoraSession } from "@/lib/cora/security/types"
import type { CoraAgentToolName } from "@/lib/cora/tools/openai-tool-definitions"
import { toolsForRole } from "@/lib/cora/agent/clearances"
import { toolsForRoleAndIntent } from "@/lib/cora/agent/intent-tools"
import {
  facultyTierAllows,
  getFacultyModuleCapability,
  type FacultyCoraModuleId,
  type FacultyMembershipTier,
  FACULTY_CORA_MODULE_REGISTRY,
} from "@/lib/cora/capabilities/faculty-module-registry"
import {
  getStudentModuleCapability,
  type StudentCoraModuleId,
} from "@/lib/cora/capabilities/student-module-registry"
import {
  getAdminModuleCapability,
  type AdminCoraModuleId,
} from "@/lib/cora/capabilities/admin-module-registry"
import {
  INSTRUCTOR_MEMBERSHIP_PLANS,
  normalizeInstructorMembershipTier,
  type InstructorMembershipFeatures,
} from "@/lib/instructor-membership-constants"

export type ResolvedCoraCapabilities = {
  tools: readonly CoraAgentToolName[]
  blockedTools: { tool: CoraAgentToolName; reason: string }[]
  membershipTier: FacultyMembershipTier | null
  principle: "student" | "faculty" | "admin"
}

/** Map faculty tools → module for membership gating. */
const FACULTY_TOOL_MODULE: Partial<Record<CoraAgentToolName, FacultyCoraModuleId>> = {
  propose_announcement: "announcements",
  list_course_announcements: "announcements",
  remember_fact: "dashboard",
  propose_question_bank_create: "question-bank",
  generate_question_drafts: "question-bank",
  propose_assessment_from_bank: "quizzes",
  propose_remediation_quiz_plan: "quizzes",
  propose_message_send: "messages",
  analyze_assessment_results: "results",
  propose_syllabus_section: "syllabus",
  propose_lecture_shell: "lectures",
  create_faculty_flashcard_deck: "flashcards",
  propose_faculty_capability: "dashboard",
  get_faculty_course_summary: "dashboard",
  list_faculty_access_requests: "students",
  propose_faculty_access_request_decision: "students",
  list_discoverable_courses: "course-exchange",
  propose_course_exchange_request: "course-exchange",
  propose_course_exchange_approval: "course-exchange",
  propose_course_exchange_import: "course-exchange",
  search_platform: "dashboard",
}

/**
 * AI-assisted tools gated by Instructor Membership features.
 * Announcement publish is NOT gated on aiAnnouncementGenerator — Free may operate CourseCollab.
 * Question Bank AI draft/create requires aiQuestionGenerator (Pro+).
 */
const FACULTY_TOOL_FEATURE: Partial<
  Record<CoraAgentToolName, keyof InstructorMembershipFeatures>
> = {
  propose_question_bank_create: "aiQuestionGenerator",
  generate_question_drafts: "aiQuestionGenerator",
}

/** Admin tools → module (only live modules may expose tools). */
const ADMIN_TOOL_MODULE: Partial<Record<CoraAgentToolName, AdminCoraModuleId>> = {
  get_admin_platform_snapshot: "system-monitor",
  get_admin_revenue_summary: "revenue",
  get_admin_security_overview: "security",
  get_admin_governance_hints: "security",
  search_platform: "system-monitor",
  search_admin_faculty: "faculty",
  search_admin_students: "students",
  search_admin_courses: "course-catalog",
  list_admin_academic_terms: "terms-sections",
  get_admin_student_success: "student-success",
  get_admin_enrollment_analytics: "enrollment-analytics",
  list_admin_password_resets: "account-management",
  propose_admin_password_reset_decision: "account-management",
  list_admin_access_requests: "account-management",
  propose_admin_access_request_decision: "account-management",
  search_admin_submission_issues: "submission-diagnostics",
  search_admin_system_logs: "logs",
  search_admin_audit_logs: "audit-logs",
}

/** Faculty teaching tools Admin must never receive. */
const ADMIN_NEVER_TOOLS = new Set<CoraAgentToolName>([
  "propose_announcement",
  "list_course_announcements",
  "remember_fact",
  "propose_question_bank_create",
  "generate_question_drafts",
  "propose_assessment_from_bank",
  "propose_remediation_quiz_plan",
  "propose_message_send",
  "propose_syllabus_section",
  "propose_lecture_shell",
  "analyze_assessment_results",
  "get_faculty_course_summary",
  "list_faculty_access_requests",
  "propose_faculty_access_request_decision",
  "propose_personal_flashcards",
  "propose_personal_note",
  "propose_calendar_study_sessions",
  "propose_practice_quiz",
  "propose_study_plan",
  "create_practice_quiz",
  "create_study_plan",
  "create_flashcards",
  "create_study_note",
  "create_faculty_flashcard_deck",
])

function facultyFeatureEnabled(
  tier: FacultyMembershipTier,
  feature: keyof InstructorMembershipFeatures,
): boolean {
  const plan =
    INSTRUCTOR_MEMBERSHIP_PLANS.find((p) => p.id === tier) ??
    INSTRUCTOR_MEMBERSHIP_PLANS.find((p) => p.id === "Free")
  const value = plan?.features[feature]
  return typeof value === "boolean" ? value : Boolean(value)
}

/**
 * Resolve OpenAI tools for the current session + user message.
 * Never expands beyond role clearances. Membership tiers gate faculty modules.
 */
export function resolveCoraCapabilities(input: {
  session: CoraSession
  userMessage: string
  instructorMembershipTier?: FacultyMembershipTier | string | null
}): ResolvedCoraCapabilities {
  const { session, userMessage } = input
  const roleTools = toolsForRoleAndIntent(session.agentRole, userMessage)
  const blockedTools: ResolvedCoraCapabilities["blockedTools"] = []

  if (session.role === "faculty") {
    const tier = (normalizeInstructorMembershipTier(
      input.instructorMembershipTier ??
        session.instructorMembershipTier ??
        session.membershipTier ??
        null,
    ) ?? "Free") as FacultyMembershipTier
    const allowed: CoraAgentToolName[] = []

    for (const tool of roleTools) {
      const feature = FACULTY_TOOL_FEATURE[tool]
      if (feature && !facultyFeatureEnabled(tier, feature)) {
        blockedTools.push({
          tool,
          reason: `${feature} is available with Instructor Pro (or higher).`,
        })
        continue
      }

      const moduleId = FACULTY_TOOL_MODULE[tool]
      if (!moduleId) {
        allowed.push(tool)
        continue
      }
      const mod = getFacultyModuleCapability(moduleId)
      if (!mod) {
        allowed.push(tool)
        continue
      }
      if (mod.minTier && !facultyTierAllows(tier, mod.minTier)) {
        blockedTools.push({
          tool,
          reason: `${mod.label} requires Instructor ${mod.minTier} (or higher).`,
        })
        continue
      }
      allowed.push(tool)
    }

    if (
      allowed.length === 0 &&
      (toolsForRole("copilot") as readonly string[]).includes("get_faculty_course_summary")
    ) {
      allowed.push("get_faculty_course_summary")
    }

    return {
      tools: allowed,
      blockedTools,
      membershipTier: tier,
      principle: "faculty",
    }
  }

  if (session.role === "admin") {
    const allowed: CoraAgentToolName[] = []
    for (const tool of roleTools) {
      if (ADMIN_NEVER_TOOLS.has(tool)) {
        blockedTools.push({
          tool,
          reason: "Admin Cora cannot use Faculty/Student teaching tools.",
        })
        continue
      }
      const moduleId = ADMIN_TOOL_MODULE[tool]
      if (!moduleId) {
        // Unknown mapping — deny rather than expand
        blockedTools.push({
          tool,
          reason: "Tool is not registered on an Admin module capability.",
        })
        continue
      }
      const mod = getAdminModuleCapability(moduleId)
      if (!mod || mod.status !== "live") {
        blockedTools.push({
          tool,
          reason: `${mod?.label ?? moduleId} is planned — no executable Admin Cora tools yet.`,
        })
        continue
      }
      if (!mod.toolHints.includes(tool) && tool !== "search_platform") {
        blockedTools.push({
          tool,
          reason: `${tool} is not listed on live module ${mod.label}.`,
        })
        continue
      }
      allowed.push(tool)
    }
    return {
      tools: allowed,
      blockedTools,
      membershipTier: null,
      principle: "admin",
    }
  }

  return {
    tools: roleTools,
    blockedTools: [],
    membershipTier: null,
    principle: "student",
  }
}

export function membershipUpsellMessage(blocked: {
  tool: CoraAgentToolName
  reason: string
}): string {
  return `${blocked.reason} Open Membership in the faculty portal to upgrade — I won't call Pro-only endpoints without authorization.`
}

/** Defense-in-depth: block faculty tool execution even if the model somehow received the tool. */
export function assertFacultyToolMembership(
  session: CoraSession,
  toolName: CoraAgentToolName,
): { ok: true } | { ok: false; reason: string } {
  if (session.role !== "faculty") return { ok: true }

  const tier = (normalizeInstructorMembershipTier(
    session.instructorMembershipTier ?? session.membershipTier ?? null,
  ) ?? "Free") as FacultyMembershipTier

  const feature = FACULTY_TOOL_FEATURE[toolName]
  if (feature && !facultyFeatureEnabled(tier, feature)) {
    return {
      ok: false,
      reason: `${feature} is available with Instructor Pro (or higher).`,
    }
  }

  const moduleId = FACULTY_TOOL_MODULE[toolName]
  if (moduleId) {
    const mod = getFacultyModuleCapability(moduleId)
    if (mod?.minTier && !facultyTierAllows(tier, mod.minTier)) {
      return {
        ok: false,
        reason: `${mod.label} requires Instructor ${mod.minTier} (or higher).`,
      }
    }
  }

  return { ok: true }
}

export function describeModuleForPrompt(
  moduleId: string,
  role: "student" | "faculty" | "admin",
): string {
  if (role === "faculty") {
    const cap = getFacultyModuleCapability(moduleId)
    if (!cap) return ""
    return `${cap.label}: capabilities [${cap.capabilities.slice(0, 8).join(", ")}]`
  }
  if (role === "admin") {
    const cap = getAdminModuleCapability(moduleId)
    if (!cap) return ""
    return `${cap.label} [${cap.status}]: ${
      cap.capabilities.slice(0, 8).join(", ") || "(no executable caps yet)"
    }`
  }
  const cap = getStudentModuleCapability(moduleId as StudentCoraModuleId)
  if (!cap) return ""
  return `${cap.label}: allow [${cap.allowed.join(", ")}]`
}

export function listFacultyModulesWithLiveTools(): FacultyCoraModuleId[] {
  return (Object.keys(FACULTY_CORA_MODULE_REGISTRY) as FacultyCoraModuleId[]).filter((id) => {
    const caps = FACULTY_CORA_MODULE_REGISTRY[id].capabilities
    return caps.some(
      (c) =>
        c.startsWith("announcement.") ||
        c.startsWith("question.") ||
        c.startsWith("dashboard."),
    )
  })
}
