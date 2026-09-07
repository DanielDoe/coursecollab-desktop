import type { CoraSession } from "@/lib/cora/security/types"
import type { CoraScopeProfile } from "@/lib/cora/scope/types"

type BuildArgs = {
  session: CoraSession
  /** Optional known program/major — only if authoritative */
  program?: string | null
  department?: string | null
  courseTopics?: string[]
  academicDomains?: string[]
}

/**
 * Compact scope profile from authenticated Cora session.
 * Does not invent majors/domains — only fields we know.
 */
export function buildCoraScopeProfile(args: BuildArgs): CoraScopeProfile {
  const { session } = args
  const academicPurposes =
    session.role === "student"
      ? ["learning", "study", "student_success", "course_work"]
      : session.role === "faculty"
        ? ["teaching", "course_design", "assessment", "research", "student_support"]
        : ["institutional_ops", "analytics", "platform_config", "academic_affairs"]

  return {
    role: session.role,
    institutionId: session.institutionId,
    program: args.program?.trim() || null,
    department: args.department?.trim() || null,
    activeCourses: (session.courseIds ?? []).map((id) => ({ id })),
    courseTopics: args.courseTopics ?? [],
    academicDomains: args.academicDomains ?? [],
    academicPurposes,
    resourceScopes: [...(session.permissions ?? [])].slice(0, 40),
    toolScopes: [],
    assessmentContext: {},
    membershipContext: {
      tiers: session.membershipTier ? [...session.membershipTier] : null,
    },
  }
}

export function emptyCoraScopeProfile(
  role: CoraScopeProfile["role"],
): CoraScopeProfile {
  return {
    role,
    institutionId: null,
    program: null,
    department: null,
    activeCourses: [],
    courseTopics: [],
    academicDomains: [],
    academicPurposes: [],
    resourceScopes: [],
    toolScopes: [],
    assessmentContext: {},
    membershipContext: {},
  }
}
