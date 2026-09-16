import type { MembershipTier } from "@/lib/membership-constants"
import { MEMBERSHIP_PLANS } from "@/lib/membership-constants"
import { formatCapabilitiesHelp } from "@/lib/cora/platform-catalog"
import {
  buildHardDenyRefusal,
  detectHardDeniedIntent,
  type CoraHardDenyCategory,
} from "@/lib/cora/agent/clearances"

/** @deprecated use agentPolicyForRole("assistant") from clearances */
export const CORA_READ_ONLY_AGENT_POLICY = `
You are **Cora Assistant**. Use tools for live CourseCollab data and allowed learning creates
(flashcards, notes, practice quizzes, study plans). Never change grades, membership, or submit assessments.
`

export type ForbiddenWriteCategory =
  | "grades"
  | "membership"
  | "submission"
  | "calendar_write"
  | "content_write"
  | "admin"
  | "generic_write"

function mapDenyToLegacy(category: CoraHardDenyCategory): ForbiddenWriteCategory {
  switch (category) {
    case "student_grade_write":
      return "grades"
    case "student_membership_write":
      return "membership"
    case "student_submission_write":
      return "submission"
    case "student_admin_impersonation":
      return "admin"
    default:
      return "generic_write"
  }
}

/** @deprecated use detectHardDeniedIntent("assistant", message) */
export function detectForbiddenWriteIntent(message: string): ForbiddenWriteCategory | null {
  const denied = detectHardDeniedIntent("assistant", message)
  return denied ? mapDenyToLegacy(denied) : null
}

/** @deprecated use buildHardDenyRefusal */
export function buildReadOnlyRefusal(category: ForbiddenWriteCategory): string {
  const map: Record<ForbiddenWriteCategory, CoraHardDenyCategory | null> = {
    grades: "student_grade_write",
    membership: "student_membership_write",
    submission: "student_submission_write",
    admin: "student_admin_impersonation",
    calendar_write: null,
    content_write: null,
    generic_write: null,
  }
  const mapped = map[category]
  if (mapped) return buildHardDenyRefusal(mapped)
  return "That action is outside Cora Assistant clearance. I can help with learning data and allowed creates instead."
}

export type CoraWorkspaceWriteAction =
  | "export_note"
  | "create_flashcards"
  | "create_note"
  | "create_practice_quiz"
  | "automate_study_plan"

const WRITE_ACTIONS = new Set<CoraWorkspaceWriteAction>([
  "export_note",
  "create_flashcards",
  "create_note",
  "create_practice_quiz",
  "automate_study_plan",
])

export function isCoraWriteWorkspaceAction(action: string): action is CoraWorkspaceWriteAction {
  return WRITE_ACTIONS.has(action as CoraWorkspaceWriteAction)
}

export function formatMembershipAccessForPrompt(tier: MembershipTier, credits?: number): string {
  const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier)
  if (!plan) return `- Membership: ${tier}`
  const ai = plan.features.aiTutor
  const aiLine =
    typeof ai === "number" && ai > 0
      ? `${credits ?? "?"} Cora Credits remaining (${ai}/month included; Cora Lite after exhaustion)`
      : "No Cora Credits on this tier"
  return `- Membership: **${plan.displayName}**\n- Cora access: ${aiLine}\n- Quiz retakes: ${plan.features.quizAttempts}\n- CodeBench: ${plan.features.codeBench ? "yes" : "no"}\n- Cora in CodeBench: ${plan.features.codeBenchCora ? "yes" : "no"}\n- Playground weekly credits: ${plan.features.playgroundCredits}`
}

export function formatReadOnlyCapabilitiesForPrompt(): string {
  return `${formatCapabilitiesHelp()}

**Cora Assistant:** can search platform data and create flashcards, notes, practice quizzes, and study plans. Cannot change grades, membership, or submit assessments.`
}
