import type { GuestCoraContextPayload } from "@/lib/cora/fetch-guest-context"
import {
  minimizeGuestContextForExternalAi,
  type ExternalAiContextOptions,
} from "@/lib/cora/privacy/ai-data-minimization"

export type FormatGuestContextOptions = ExternalAiContextOptions & {
  forExternalAi?: boolean
}

/** Formats guest career snapshot for Cora's system prompt. */
export function formatGuestContextForPrompt(
  ctx: GuestCoraContextPayload,
  options?: FormatGuestContextOptions,
): string {
  const forExternalAi = options?.forExternalAi !== false
  const payload = forExternalAi ? minimizeGuestContextForExternalAi(ctx) : ctx

  const lines: string[] = [
    "**CAREER MEMBER CONTEXT (CourseCollab Career Member — read-only snapshot; use tools to refresh after mutations):**",
    `- Career Member${payload.account.organization ? ` · ${payload.account.organization}` : ""}`,
    `- Plan: ${payload.entitlements.plan} · Cora Credits: ${payload.entitlements.coraCredits.toLocaleString()}`,
  ]

  if (payload.account.onboardingPurpose) {
    lines.push(`- Onboarding purpose: ${payload.account.onboardingPurpose}`)
  }

  if (payload.careerProfile.goals) lines.push(`- Stated goals: ${payload.careerProfile.goals}`)
  if (payload.careerProfile.careerSummary) {
    lines.push(`- Career summary (Cora): ${payload.careerProfile.careerSummary}`)
  }
  if (payload.careerProfile.targetRoles.length) {
    lines.push(`- Target roles: ${payload.careerProfile.targetRoles.join(", ")}`)
  }
  if (payload.focusTopics.length) {
    lines.push(`- Current focus: ${payload.focusTopics.join(", ")}`)
  }

  if (payload.masterResume?.hasResume) {
    lines.push(
      `- Master résumé: "${payload.masterResume.label ?? payload.masterResume.fileName ?? "Master résumé"}" (${payload.masterResume.experienceCount} roles, ${payload.masterResume.skillCount} skills, updated ${payload.masterResume.updatedAt?.slice(0, 10) ?? "recently"})`,
    )
  } else {
    lines.push("- Master résumé: not uploaded yet")
  }

  lines.push(
    `- Applications: ${payload.summary.applicationCount}${payload.summary.avgMatchScore != null ? ` · avg match ${payload.summary.avgMatchScore}%` : ""}`,
    `- Recommendations: ${payload.summary.recommendationCount} (${payload.summary.activeRecommendations} active)`,
    `- Cover letter drafts: ${payload.summary.hasCoverLetterDrafts}`,
  )

  if (payload.applications.length) {
    lines.push("- **Recent applications:**")
    payload.applications.slice(0, 5).forEach((a, i) => {
      lines.push(
        `  • ${i + 1}. ${a.organization ?? "Opportunity"} — ${a.title}${a.matchScore != null ? ` (${a.matchScore}% match)` : ""} [${a.status}]`,
      )
    })
  }

  if (payload.recommendations.length) {
    lines.push("- **Recommendation requests:**")
    payload.recommendations.slice(0, 5).forEach((r, i) => {
      lines.push(
        `  • ${i + 1}. ${r.purpose}${r.instructorName ? ` with ${r.instructorName}` : ""} [${r.status}]${r.deadline ? ` · due ${r.deadline.slice(0, 10)}` : ""}${r.hasBrief ? " · brief ready" : ""}`,
      )
    })
  }

  if (forExternalAi) {
    lines.push(
      "**PRIVACY:** Member name, email, and internal account identifiers are excluded from external AI payloads.",
    )
  }

  lines.push(`- Context synced: ${payload.syncedAt}`)
  return lines.join("\n")
}
