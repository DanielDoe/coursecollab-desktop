"use client"

import { instructorApiFetch } from "@/lib/instructor-api-headers"
import {
  getInstructorMembershipPlan,
  type InstructorMembershipTier,
} from "@/lib/instructor-membership-constants"

export const INSTRUCTOR_MEMBERSHIP_TIER_STORAGE_KEY = "instructorMembershipTier"

const KNOWN_INSTRUCTOR_TIERS = new Set<InstructorMembershipTier>(["Free", "Pro", "Teams"])

type MembershipApiResponse = {
  membership?: {
    tier?: string
    effectiveFeatureTier?: string
  }
}

export function readCachedInstructorMembershipTier(): string | null {
  if (typeof window === "undefined") return null
  const tier =
    sessionStorage.getItem(INSTRUCTOR_MEMBERSHIP_TIER_STORAGE_KEY) ||
    localStorage.getItem(INSTRUCTOR_MEMBERSHIP_TIER_STORAGE_KEY)
  return tier?.trim() || null
}

export function persistInstructorMembershipTier(tier: string): void {
  const clean = tier.trim()
  if (!clean || typeof window === "undefined") return
  sessionStorage.setItem(INSTRUCTOR_MEMBERSHIP_TIER_STORAGE_KEY, clean)
  localStorage.setItem(INSTRUCTOR_MEMBERSHIP_TIER_STORAGE_KEY, clean)
  window.dispatchEvent(new Event("instructor-membership-synced"))
}

export function formatInstructorSidebarPlanLabel(tier: string | null | undefined): string {
  const clean = (tier ?? "").trim()
  if (!clean) return getInstructorMembershipPlan("Free").displayName
  if (KNOWN_INSTRUCTOR_TIERS.has(clean as InstructorMembershipTier)) {
    return getInstructorMembershipPlan(clean as InstructorMembershipTier).displayName
  }
  if (/plan$/i.test(clean)) return clean
  return `${clean} Plan`
}

let inflightSync: Promise<string | null> | null = null

/** Fetch instructor membership tier from API and cache for sidebar / Cora. */
export async function syncInstructorMembershipTierCache(
  instructorId?: string | number | null,
): Promise<string | null> {
  const id =
    instructorId != null
      ? String(instructorId).trim()
      : typeof localStorage !== "undefined"
        ? (localStorage.getItem("instructorId")?.trim() ?? "")
        : ""
  if (!id) return readCachedInstructorMembershipTier()

  if (inflightSync) return inflightSync

  inflightSync = (async () => {
    try {
      const res = await instructorApiFetch(
        `/api/instructor/membership?instructorId=${encodeURIComponent(id)}`,
      )
      if (!res.ok) return readCachedInstructorMembershipTier()

      const data = (await res.json()) as MembershipApiResponse
      const tier =
        data.membership?.effectiveFeatureTier?.trim() ||
        data.membership?.tier?.trim() ||
        null
      if (tier) {
        persistInstructorMembershipTier(tier)
        return tier
      }
      return readCachedInstructorMembershipTier()
    } catch {
      return readCachedInstructorMembershipTier()
    } finally {
      inflightSync = null
    }
  })()

  return inflightSync
}
