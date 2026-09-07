import type { GuestOnboardingPurpose } from "@/lib/guest/types"
import { CAREER_MEMBER_LABEL, CAREER_MEMBER_WORKSPACE } from "@/lib/guest/display"

export const GUEST_OCCUPATION_OPTIONS = [
  { id: "undergraduate", label: "undergraduate student", short: "Student" },
  { id: "graduate_student", label: "graduate student", short: "Grad student" },
  { id: "recent_graduate", label: "recent graduate", short: "Recent grad" },
  { id: "working_professional", label: "working professional", short: "Professional" },
  { id: "career_changer", label: "career changer", short: "Career changer" },
  { id: "educator", label: "educator / researcher", short: "Educator" },
  { id: "other", label: "something else", short: "Other" },
] as const

export type GuestOccupation = (typeof GUEST_OCCUPATION_OPTIONS)[number]["id"]

const VALID_OCCUPATIONS = new Set<string>(GUEST_OCCUPATION_OPTIONS.map((o) => o.id))

export function isValidGuestOccupation(raw: unknown): raw is GuestOccupation {
  return VALID_OCCUPATIONS.has(String(raw ?? "").trim())
}

export function guestOccupationLabel(raw: unknown): string {
  const id = String(raw ?? "").trim()
  return GUEST_OCCUPATION_OPTIONS.find((o) => o.id === id)?.label ?? CAREER_MEMBER_LABEL
}

export const GUEST_ONBOARDING_OPTIONS = [
  {
    id: "recommendation_letter" as const,
    label: "Request a recommendation",
    description: "Ask a faculty member for a letter of recommendation",
  },
  {
    id: "career_application" as const,
    label: "Career & application support",
    description: "Résumés, applications, and interview preparation",
  },
  {
    id: "graduate_school" as const,
    label: "Graduate school preparation",
    description: "Programs, statements, and application planning",
  },
  {
    id: "scholarship" as const,
    label: "Scholarship application",
    description: "Organize materials and deadlines for scholarships",
  },
  {
    id: "other_academic" as const,
    label: "Other academic support",
    description: "Tell us what you need and we will guide you",
  },
] as const

const VALID_PURPOSES = new Set<string>([
  "recommendation_letter",
  "career_application",
  "graduate_school",
  "scholarship",
  "other_academic",
  "other",
])

/** Normalize DB / legacy purpose values for display. */
export function normalizeGuestOnboardingPurpose(raw: unknown): GuestOnboardingPurpose {
  const p = String(raw ?? "").trim().toLowerCase()
  if (p === "other") return "other_academic"
  if (VALID_PURPOSES.has(p)) return p as GuestOnboardingPurpose
  return "other_academic"
}

export function guestOnboardingPurposeLabel(purpose: GuestOnboardingPurpose | string | null | undefined): string {
  const p = normalizeGuestOnboardingPurpose(purpose)
  const map: Record<GuestOnboardingPurpose, string> = {
    recommendation_letter: "Recommendation letters",
    career_application: "Career & applications",
    graduate_school: "Graduate school",
    scholarship: "Scholarships",
    other_academic: "Academic support",
    other: "Academic support",
  }
  return map[p] ?? CAREER_MEMBER_WORKSPACE
}

export function isValidGuestOnboardingPurpose(raw: unknown): raw is GuestOnboardingPurpose {
  return VALID_PURPOSES.has(String(raw ?? "").trim().toLowerCase())
}
