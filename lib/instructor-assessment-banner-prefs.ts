"use client"

const STORAGE_PREFIX = "cc_instructor_"
const MEMBERSHIP_POLICY_BANNER_SUFFIX = "_membership_policy_banner_dismissed"

export function getInstructorIdFromClient(): string | null {
  if (typeof window === "undefined") return null
  try {
    return (
      localStorage.getItem("instructorId") ||
      sessionStorage.getItem("instructorId") ||
      localStorage.getItem("adminId") ||
      sessionStorage.getItem("adminId")
    )
  } catch {
    return null
  }
}

export function membershipPolicyBannerStorageKey(instructorId: string): string {
  return `${STORAGE_PREFIX}${instructorId}${MEMBERSHIP_POLICY_BANNER_SUFFIX}`
}

export function readInstructorMembershipPolicyBannerDismissed(instructorId: string | null): boolean {
  if (!instructorId || typeof window === "undefined") return false
  try {
    return localStorage.getItem(membershipPolicyBannerStorageKey(instructorId)) === "true"
  } catch {
    return false
  }
}

export function writeInstructorMembershipPolicyBannerDismissed(instructorId: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(membershipPolicyBannerStorageKey(instructorId), "true")
  } catch {
    /* private mode */
  }
}

export function dismissInstructorMembershipPolicyBannerPermanently(): void {
  const instructorId = getInstructorIdFromClient()
  if (!instructorId) return
  writeInstructorMembershipPolicyBannerDismissed(instructorId)
}
