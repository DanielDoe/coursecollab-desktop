/**
 * Guest Cora contextual tool discovery — narrows allowed tools by intent.
 */

import type { GuestCoraToolName } from "@/lib/cora/tools/guest-tool-definitions"
import { GUEST_CORA_TOOLS } from "@/lib/cora/agent/guest-clearances"

export type GuestCoraToolIntent =
  | "recommendation"
  | "resume"
  | "application"
  | "cover_letter"
  | "interview"
  | "statement"
  | "profile"
  | "general"

const INTENT_TOOL_HINTS: Record<GuestCoraToolIntent, readonly GuestCoraToolName[]> = {
  recommendation: [
    "get_guest_career_context",
    "list_guest_recommendations",
    "get_guest_recommendation_detail",
    "list_guest_recommendation_attachments",
    "get_guest_recommendation_brief",
    "save_guest_recommendation_brief_fields",
    "generate_guest_recommendation_brief",
  ],
  resume: [
    "get_guest_career_context",
    "get_guest_master_resume",
    "review_guest_resume",
    "run_guest_resume_match",
    "list_guest_applications",
  ],
  application: [
    "get_guest_career_context",
    "list_guest_applications",
    "get_guest_application_detail",
    "propose_guest_application_plan",
    "run_guest_resume_match",
  ],
  cover_letter: [
    "get_guest_career_context",
    "get_guest_master_resume",
    "get_guest_cover_letter",
    "generate_guest_cover_letter",
    "list_guest_applications",
    "get_guest_application_detail",
  ],
  interview: [
    "get_guest_career_context",
    "prepare_guest_interview",
    "get_guest_recommendation_detail",
    "list_guest_recommendation_attachments",
    "get_guest_master_resume",
  ],
  statement: [
    "get_guest_career_context",
    "draft_guest_statement",
    "get_guest_recommendation_detail",
    "list_guest_recommendation_attachments",
    "get_guest_master_resume",
  ],
  profile: [
    "get_guest_profile",
    "get_guest_career_context",
    "update_guest_career_profile",
    "refresh_guest_career_context",
  ],
  general: [...GUEST_CORA_TOOLS],
}

export function detectGuestCoraToolIntent(text: string): GuestCoraToolIntent {
  const t = text.toLowerCase()
  if (/\b(recommendation|recommender|brief|faculty letter prep)\b/.test(t)) return "recommendation"
  if (/\b(cover letter|covering letter)\b/.test(t)) return "cover_letter"
  if (/\b(résumé|resume|cv|match rate|scan|ats)\b/.test(t)) return "resume"
  if (/\b(interview|mock interview|talking points)\b/.test(t)) return "interview"
  if (/\b(personal statement|sop|statement of purpose|essay)\b/.test(t)) return "statement"
  if (/\b(application|deadline|checklist|tracker|apply)\b/.test(t)) return "application"
  if (/\b(my goals|remember|profile|context|who am i)\b/.test(t)) return "profile"
  return "general"
}

export function guestToolsForIntent(
  allowed: readonly GuestCoraToolName[],
  intent: GuestCoraToolIntent,
): readonly GuestCoraToolName[] {
  const allowSet = new Set(allowed)
  const hints = INTENT_TOOL_HINTS[intent]
  const picked = hints.filter((name) => allowSet.has(name))
  if (picked.length >= 3) return picked
  return allowed
}
