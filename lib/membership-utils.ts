"use client"

import { MEMBERSHIP_PLANS, type MembershipTier, type MembershipFeatures } from "./membership-constants"

import { DEV_MODE_UNRESTRICTED_ACCESS } from "./membership-constants"

export function getQuizAttemptsLimit(tier: MembershipTier): number {
  if (DEV_MODE_UNRESTRICTED_ACCESS) return 999
  const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier)
  return plan?.features.quizAttempts || 1
}

export function getAITutorAccess(tier: MembershipTier): number {
  if (DEV_MODE_UNRESTRICTED_ACCESS) return 999999
  const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier)
  const aiTutorValue = plan?.features.aiTutor
  if (typeof aiTutorValue === "number") return aiTutorValue
  return 0
}

export function canAccessFeature(
  tier: MembershipTier,
  feature: keyof MembershipFeatures,
): {
  allowed: boolean
  message?: string
  upgradeRequired?: MembershipTier
} {
  if (DEV_MODE_UNRESTRICTED_ACCESS) {
    return { allowed: true }
  }

  const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier)
  if (!plan) {
    return {
      allowed: false,
      message: "Invalid membership tier",
    }
  }

  const featureValue = plan.features[feature]
  let hasAccess = false

  // Handle boolean features
  if (typeof featureValue === "boolean") {
    hasAccess = featureValue
  }
  // Handle aiTutor (monthly Cora Credits)
  else if (feature === "aiTutor") {
    if (typeof featureValue === "number") {
      hasAccess = featureValue > 0
    }
  }
  // Handle numeric features (like quizAttempts)
  else if (typeof featureValue === "number") {
    hasAccess = featureValue > 0
  }
  // Handle playgroundCredits (number or "unlimited")
  else if (feature === "playgroundCredits") {
    if (featureValue === "unlimited") {
      hasAccess = true
    } else if (typeof featureValue === "number") {
      hasAccess = featureValue > 0
    }
  }

  if (hasAccess) {
    return { allowed: true }
  }

  // Determine which tier is needed
  let requiredTier: MembershipTier = "Explorer"

  for (const planOption of MEMBERSHIP_PLANS) {
    const planFeature = planOption.features[feature]
    if (
      (typeof planFeature === "boolean" && planFeature) ||
      (feature === "aiTutor" && typeof planFeature === "number" && planFeature > 0) ||
      (typeof planFeature === "number" && planFeature > 0) ||
      (feature === "playgroundCredits" && (planFeature === "unlimited" || (typeof planFeature === "number" && planFeature > 0)))
    ) {
      requiredTier = planOption.id
      break
    }
  }

  return {
    allowed: false,
    message: `This feature requires ${requiredTier} membership or higher`,
    upgradeRequired: requiredTier,
  }
}
