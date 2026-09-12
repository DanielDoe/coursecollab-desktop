/**
 * Utility functions to check if a student has retake access
 * Students need Explorer/Trailblazer membership OR active donation to retake assessments
 */

import { getEffectiveMembershipTier, hasActiveDonationTrial, isBetaUser } from "./membership"
import { MEMBERSHIP_PLANS, type MembershipTier } from "./membership-constants"
import { membershipAssessmentBenefitsAllowedForStudent } from "./assessment-privilege-governance"
import { isPastRegularAssessmentsHardCloseAsync } from "./regular-assessments-cutoff-server"
export { retakeBlockedForMissingMembership } from "./retake-access-policy"

/**
 * Check if a student has retake access
 * Returns true if:
 * - Student has Explorer or Trailblazer membership
 * - Student has active donation (within 14 days)
 * - Student is a beta user
 */
/**
 * After the semester conclusion cutoff, regular quiz/homework access is closed for all students.
 * Per-assessment `available_until` remains the primary gate while the term is active.
 */
export async function isRegularAssessmentSemesterHardCloseBlockingStudent(
  _studentId: number,
  _courseId?: number | null,
  at?: Date,
): Promise<boolean> {
  return isPastRegularAssessmentsHardCloseAsync(at)
}

export async function hasRetakeAccess(studentId: number, courseId?: number | null): Promise<boolean> {
  try {
    const membershipPerksAllowed = await membershipAssessmentBenefitsAllowedForStudent(studentId, courseId)
    if (!membershipPerksAllowed) {
      return false
    }

    // Beta users get full access
    const isBeta = await isBetaUser(studentId)
    if (isBeta) {
      return true
    }

    // Check if student has active donation (within 14 days)
    const hasDonationAccess = await hasActiveDonationTrial(studentId)
    if (hasDonationAccess) {
      return true
    }

    // Check membership tier
    const tier = await getEffectiveMembershipTier(studentId)
    const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier)
    
    // Scholar has quizAttempts: 1 (first-time only, no retakes)
    // Explorer has quizAttempts: 2; Trailblazer has quizAttempts: 3 (includes retakes)
    if (plan && plan.features.quizAttempts > 1) {
      return true
    }

    return false
  } catch (error) {
    return false
  }
}

/**
 * Get the required tier for retake access
 */
export function getRequiredTierForRetake(): MembershipTier {
  return "Explorer" // Explorer is the minimum tier for retakes
}

/**
 * Check if student has "Save and Finish Later" access
 * Only Explorer and Trailblazer (and beta/donation) get this feature
 */
export async function hasSaveAndFinishLaterAccess(
  studentId: number,
  courseId?: number | null,
): Promise<boolean> {
  return hasRetakeAccess(studentId, courseId) // Same as retake: Explorer, Trailblazer, beta, donation
}

/**
 * Get Save and Finish Later limit for a student
 * Explorer: 3 in-progress assessments max
 * Trailblazer: unlimited (null)
 * Scholar/beta/donation: use Explorer limit for donation, Trailblazer for beta
 */
export async function getSaveAndFinishLaterLimit(studentId: number): Promise<number | null> {
  try {
    const isBeta = await isBetaUser(studentId)
    if (isBeta) return null // Unlimited for beta

    const hasDonation = await hasActiveDonationTrial(studentId)
    if (hasDonation) return 3 // Donation gets Explorer-level (3)

    const tier = await getEffectiveMembershipTier(studentId)
    const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier)
    const limit = plan?.features.saveAndFinishLater
    if (limit === false) return 0
    if (limit === "unlimited") return null
    if (typeof limit === "number") return limit
    return 0
  } catch {
    return 0
  }
}

/**
 * Get retake access info for display
 */
export async function getRetakeAccessInfo(studentId: number): Promise<{
  hasAccess: boolean
  reason: string
  requiredTier: MembershipTier
  hasDonation: boolean
  hasMembership: boolean
}> {
  try {
    const isBeta = await isBetaUser(studentId)
    const hasDonation = await hasActiveDonationTrial(studentId)
    const tier = await getEffectiveMembershipTier(studentId)
    const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier)
    
    const hasMembership = plan ? plan.features.quizAttempts > 1 : false
    const hasAccess = isBeta || hasDonation || hasMembership

    let reason = ""
    if (isBeta) {
      reason = "You have beta user access"
    } else if (hasDonation) {
      reason = "You have active donation access (14 days)"
    } else if (hasMembership) {
      reason = `You have ${tier} membership`
    } else {
      reason = "You need Explorer or Trailblazer membership, or an active donation to retake assessments"
    }

    return {
      hasAccess,
      reason,
      requiredTier: "Explorer",
      hasDonation,
      hasMembership,
    }
  } catch (error) {
    return {
      hasAccess: false,
      reason: "Error checking access",
      requiredTier: "Explorer",
      hasDonation: false,
      hasMembership: false,
    }
  }
}

