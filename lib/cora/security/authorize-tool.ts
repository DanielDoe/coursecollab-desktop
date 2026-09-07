import { TOOL_REQUIRED_PERMISSIONS } from "@/lib/cora/security/capabilities"
import type { CoraSession, CoraToolAuthorization } from "@/lib/cora/security/types"
import type { CoraAgentToolName } from "@/lib/cora/tools/openai-tool-definitions"
import { roleMayCallTool } from "@/lib/cora/agent/clearances"
import { membershipAllowsCreateTool } from "@/lib/cora/security/membership-gates"

/**
 * Authorize a tool for the current Cora session.
 * Cora never exceeds the invoking user's role permissions / course scope.
 */
export function authorizeCoraTool(
  session: CoraSession,
  toolName: CoraAgentToolName,
  opts?: {
    targetCourseId?: number | null
    targetStudentId?: number | null
    targetSectionId?: number | null
  },
): CoraToolAuthorization {
  if (!roleMayCallTool(session.agentRole, toolName)) {
    return {
      ok: false,
      code: "role",
      reason: `${toolName} is not registered for ${session.productName}`,
    }
  }

  const required = TOOL_REQUIRED_PERMISSIONS[toolName] ?? []
  const hasClaim = required.some((claim) => session.permissions.has(claim))
  if (required.length > 0 && !hasClaim) {
    return {
      ok: false,
      code: "permission",
      reason: `${toolName} requires permissions not granted to ${session.role}`,
    }
  }

  const membership = membershipAllowsCreateTool(session, toolName)
  if (!membership.ok) {
    return { ok: false, code: "membership", reason: membership.reason }
  }

  if (session.role === "student") {
    if (opts?.targetStudentId != null && opts.targetStudentId !== session.userId) {
      return { ok: false, code: "scope", reason: "Students may only access their own data" }
    }
  }

  if (session.role === "faculty") {
    if (opts?.targetCourseId != null && !session.courseIds.includes(opts.targetCourseId)) {
      return { ok: false, code: "scope", reason: "Faculty may only access assigned courses" }
    }
    if (session.courseIds.length === 0) {
      return { ok: false, code: "scope", reason: "No course scope selected for Cora Faculty" }
    }
    // Faculty create tools require an explicit course claim (already above) and
    // section claim when the tool targets a section and sections are known.
    const isFacultyCreate =
      toolName === "generate_question_drafts" || toolName === "create_faculty_flashcard_deck"
    if (isFacultyCreate && session.sectionIds.length === 0 && opts?.targetSectionId != null) {
      return {
        ok: false,
        code: "scope",
        reason: "No section claims on this Cora Faculty session for the requested section",
      }
    }
    if (
      opts?.targetSectionId != null &&
      session.sectionIds.length > 0 &&
      !session.sectionIds.includes(opts.targetSectionId)
    ) {
      return { ok: false, code: "scope", reason: "Faculty may only access assigned sections" }
    }
  }

  if (session.role === "admin") {
    if (
      toolName.startsWith("get_student") ||
      toolName.startsWith("get_attendance") ||
      toolName.startsWith("get_classroom") ||
      (toolName.startsWith("create_") && !toolName.includes("admin"))
    ) {
      return {
        ok: false,
        code: "scope",
        reason: "Cora Admin cannot access student-private or faculty-private tools",
      }
    }
  }

  return { ok: true }
}
