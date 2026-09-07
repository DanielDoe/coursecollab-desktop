/**
 * Cora Guest — tool registry with discovery + career mutations.
 */

import type { GuestCoraToolName } from "@/lib/cora/tools/guest-tool-definitions"
import type { GuestCapability } from "@/lib/guest/types"

/** Discovery/read tools — available to any guest who can use Cora. */
export const GUEST_DISCOVERY_CORA_TOOLS: readonly GuestCoraToolName[] = [
  "get_guest_profile",
  "get_guest_career_context",
  "refresh_guest_career_context",
  "update_guest_career_profile",
  "list_guest_recommendations",
  "get_guest_recommendation_detail",
  "list_guest_recommendation_attachments",
  "get_guest_recommendation_brief",
  "list_guest_applications",
  "get_guest_application_detail",
  "get_guest_master_resume",
  "get_guest_cover_letter",
  "run_guest_resume_match",
  "generate_guest_cover_letter",
] as const

/** Read + brief tools available on Guest Free. */
export const GUEST_FREE_CORA_TOOLS: readonly GuestCoraToolName[] = [
  ...GUEST_DISCOVERY_CORA_TOOLS,
  "save_guest_recommendation_brief_fields",
  "generate_guest_recommendation_brief",
] as const

/** Cora Career add-on tools. */
export const GUEST_CAREER_CORA_TOOLS: readonly GuestCoraToolName[] = [
  "review_guest_resume",
  "prepare_guest_interview",
  "draft_guest_statement",
  "propose_guest_application_plan",
] as const

export const GUEST_CORA_TOOLS: readonly GuestCoraToolName[] = [
  ...GUEST_FREE_CORA_TOOLS,
  ...GUEST_CAREER_CORA_TOOLS,
] as const

export const GUEST_CAPABILITY_TOOL_MAP: Partial<
  Record<GuestCapability, readonly GuestCoraToolName[]>
> = {
  "cora.generateRecommendationBrief": GUEST_FREE_CORA_TOOLS,
  "cora.reviewResume": ["review_guest_resume"],
  "cora.prepareInterview": ["prepare_guest_interview"],
  "cora.helpApplication": ["draft_guest_statement", "propose_guest_application_plan"],
  "career.resume": ["review_guest_resume", "run_guest_resume_match"],
  "career.application": ["propose_guest_application_plan", "draft_guest_statement", "list_guest_applications"],
  "career.interview": ["prepare_guest_interview"],
  "career.cora": [...GUEST_CAREER_CORA_TOOLS, ...GUEST_DISCOVERY_CORA_TOOLS],
  "career.documents": GUEST_FREE_CORA_TOOLS,
  "recommendations.request": GUEST_DISCOVERY_CORA_TOOLS,
}

/** Hard-denied tool prefixes for guest Cora — never merge with student tools. */
export const GUEST_CORA_DENIED_PREFIXES = [
  "grades.",
  "courses.private.",
  "questionBank.",
  "assessments.",
  "assessmentAnswers.",
  "studentProgress.",
  "quiz.",
  "homework.",
  "finalExam.",
  "midterm.",
  "faculty.",
  "admin.",
  "roles.",
  "permissions.",
  "enrollment.",
  "system.",
  "coursePrivate.",
  "institutionPrivate.",
] as const

export function guestCoraToolsForCapabilities(
  capabilities: readonly GuestCapability[],
): readonly GuestCoraToolName[] {
  const out = new Set<GuestCoraToolName>(GUEST_DISCOVERY_CORA_TOOLS)

  for (const cap of capabilities) {
    const tools = GUEST_CAPABILITY_TOOL_MAP[cap]
    if (tools) tools.forEach((t) => out.add(t))
  }

  if (capabilities.includes("career.cora")) {
    GUEST_CAREER_CORA_TOOLS.forEach((t) => out.add(t))
  }

  return [...out]
}

export function isDeniedGuestCoraIntent(text: string): boolean {
  const lower = text.toLowerCase()
  const blocked = [
    /\b(pull|show|get|list|fetch)\b.{0,30}\b(all )?(my )?(grades?|gpa|transcript)\b/i,
    /\b(when i was|back when i took|from my course)\b/i,
    /\b(generate|write|draft)\b.{0,20}\b(recommendation letter|letter of recommendation)\b/i,
    /\b(submit|take|complete)\b.{0,20}\b(quiz|homework|exam)\b/i,
    /\b(student portal|course roster|question bank)\b/i,
  ]
  return blocked.some((re) => re.test(lower))
}
