/**
 * Guest workspace feature flags — env-driven incremental rollout.
 * Set GUEST_*=0 to disable; default enabled when unset.
 */

function envFlag(name: string, defaultOn = true): boolean {
  const raw = process.env[name]?.trim().toLowerCase()
  if (raw === "0" || raw === "false" || raw === "off") return false
  if (raw === "1" || raw === "true" || raw === "on") return true
  return defaultOn
}

export type GuestFeatureFlags = {
  guestWorkspaceEnabled: boolean
  guestMembershipEnabled: boolean
  coraCareerEnabled: boolean
  recommendationBriefEnabled: boolean
  careerResumeEnabled: boolean
  careerInterviewEnabled: boolean
  careerApplicationsEnabled: boolean
  careerScholarshipsEnabled: boolean
}

export function getGuestFeatureFlags(): GuestFeatureFlags {
  return {
    guestWorkspaceEnabled: envFlag("GUEST_WORKSPACE_ENABLED"),
    guestMembershipEnabled: envFlag("GUEST_MEMBERSHIP_ENABLED"),
    coraCareerEnabled: envFlag("GUEST_CORA_CAREER_ENABLED"),
    recommendationBriefEnabled: envFlag("GUEST_RECOMMENDATION_BRIEF_ENABLED"),
    careerResumeEnabled: envFlag("GUEST_CAREER_RESUME_ENABLED"),
    careerInterviewEnabled: envFlag("GUEST_CAREER_INTERVIEW_ENABLED"),
    careerApplicationsEnabled: envFlag("GUEST_CAREER_APPLICATIONS_ENABLED", false),
    careerScholarshipsEnabled: envFlag("GUEST_CAREER_SCHOLARSHIPS_ENABLED"),
  }
}

export function isGuestFeatureEnabled(flag: keyof GuestFeatureFlags): boolean {
  return getGuestFeatureFlags()[flag]
}
