import type { MembershipTier } from "@/lib/membership-constants"
import type { CoraAgentToolName } from "@/lib/cora/tools/openai-tool-definitions"
import type { CoraSession } from "@/lib/cora/security/types"

const CREATE_TOOLS = new Set<CoraAgentToolName>([
  "create_flashcards",
  "create_study_note",
  "propose_personal_flashcards",
  "propose_personal_note",
  "propose_calendar_study_sessions",
  "propose_practice_quiz",
  "propose_study_plan",
  "create_practice_quiz",
  "create_study_plan",
])

/** Membership feature gate for student create tools. */
export function membershipAllowsCreateTool(
  session: CoraSession,
  toolName: CoraAgentToolName,
): { ok: true } | { ok: false; reason: string } {
  if (!CREATE_TOOLS.has(toolName)) return { ok: true }
  if (session.role !== "student") return { ok: true }

  const tier = session.membershipTier
  if (tier === "Scholar" || !tier) {
    return {
      ok: false,
      reason:
        "Cora create tools require Explorer or Trailblazer. You can still use Cora for explanations with your Scholar credits.",
    }
  }

  return { ok: true }
}

export function assertMembershipTier(tier: MembershipTier | null | undefined): MembershipTier | null {
  return tier ?? null
}
