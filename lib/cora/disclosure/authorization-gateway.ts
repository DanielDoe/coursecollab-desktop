/**
 * CoraAuthorizationGateway — bind model-generated IDs to the authenticated scope.
 * Changing IDs in tool arguments cannot expand access.
 */

import type { CoraSession } from "@/lib/cora/security/types"
import { authorizeAsPrincipal, type PrincipalAuthDecision } from "@/lib/cora/security/principal-authorization"
import type { CoraAgentToolName } from "@/lib/cora/tools/openai-tool-definitions"

const ID_KEYS = [
  "student_id",
  "studentId",
  "studentDbId",
  "user_id",
  "userId",
  "course_id",
  "courseId",
  "section_id",
  "sectionId",
  "instructor_id",
  "instructorId",
  "admin_id",
  "adminId",
] as const

function asId(value: unknown): number | null {
  if (value == null || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

function firstArgId(args: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const key of keys) {
    const n = asId(args[key])
    if (n != null) return n
  }
  return null
}

export type CoraBoundResourceScope = {
  targetCourseId?: number | null
  targetStudentId?: number | null
  targetSectionId?: number | null
}

export type CoraBindDecision =
  | { ok: true; scope: CoraBoundResourceScope }
  | { ok: false; code: "scope"; reason: string }

/**
 * Extract IDs from tool args and refuse any expansion beyond the session.
 */
export function bindCoraToolResourceScope(
  session: CoraSession,
  args: Record<string, unknown>,
  actorHints?: {
    courseId?: number | null
    studentDbId?: number | null
    sectionId?: number | null
  },
): CoraBindDecision {
  const argStudent = firstArgId(args, ["student_id", "studentId", "studentDbId", "user_id", "userId"])
  const argCourse = firstArgId(args, [
    "course_id",
    "courseId",
    "destination_course_id",
    "destinationCourseId",
  ])
  const argSection = firstArgId(args, ["section_id", "sectionId"])
  const argInstructor = firstArgId(args, ["instructor_id", "instructorId"])
  const argAdmin = firstArgId(args, ["admin_id", "adminId"])

  if (session.role === "student") {
    if (argStudent != null && argStudent !== session.userId) {
      return { ok: false, code: "scope", reason: "Students may only access their own data" }
    }
    if (argInstructor != null || argAdmin != null) {
      return { ok: false, code: "scope", reason: "Students cannot target faculty or admin identities" }
    }
    if (argCourse != null && session.courseIds.length > 0 && !session.courseIds.includes(argCourse)) {
      return { ok: false, code: "scope", reason: "Course is outside this student's enrollment" }
    }
    if (argSection != null && session.sectionIds.length > 0 && !session.sectionIds.includes(argSection)) {
      return { ok: false, code: "scope", reason: "Section is outside this student's enrollment" }
    }
    return {
      ok: true,
      scope: {
        targetStudentId: session.userId,
        targetCourseId: actorHints?.courseId ?? session.courseIds[0] ?? argCourse,
        targetSectionId: actorHints?.sectionId ?? argSection,
      },
    }
  }

  if (session.role === "faculty") {
    const courseId = argCourse ?? actorHints?.courseId ?? session.courseIds[0] ?? null
    if (courseId != null && session.courseIds.length > 0 && !session.courseIds.includes(courseId)) {
      return { ok: false, code: "scope", reason: "Faculty may only access assigned courses" }
    }
    if (argSection != null && session.sectionIds.length > 0 && !session.sectionIds.includes(argSection)) {
      return { ok: false, code: "scope", reason: "Faculty may only access assigned sections" }
    }
    if (argAdmin != null) {
      return { ok: false, code: "scope", reason: "Faculty cannot target admin identities" }
    }
    return {
      ok: true,
      scope: {
        targetCourseId: courseId,
        targetStudentId: argStudent,
        targetSectionId: argSection ?? actorHints?.sectionId ?? null,
      },
    }
  }

  // Admin: product administration only — still no identity spoof via args
  if (argAdmin != null && argAdmin !== session.userId) {
    return { ok: false, code: "scope", reason: "Admin Cora cannot assume another admin identity" }
  }
  return {
    ok: true,
    scope: {
      targetCourseId: argCourse ?? actorHints?.courseId ?? null,
      targetStudentId: argStudent,
      targetSectionId: argSection,
    },
  }
}

export function authorizeCoraToolGateway(
  session: CoraSession,
  toolName: CoraAgentToolName,
  args: Record<string, unknown>,
  actorHints?: {
    courseId?: number | null
    studentDbId?: number | null
    sectionId?: number | null
    moduleId?: string
    operation?: string
  },
): PrincipalAuthDecision {
  const bound = bindCoraToolResourceScope(session, args, actorHints)
  if (!bound.ok) {
    return { ok: false, code: "scope", reason: bound.reason }
  }
  return authorizeAsPrincipal(session, toolName, {
    targetCourseId: bound.scope.targetCourseId,
    targetStudentId: bound.scope.targetStudentId ?? actorHints?.studentDbId ?? null,
    targetSectionId: bound.scope.targetSectionId,
    moduleId: actorHints?.moduleId,
    operation: actorHints?.operation,
  })
}

export function extractCoraResourceArgKeys(): readonly string[] {
  return ID_KEYS
}
