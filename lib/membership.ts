"use server"

import { sql } from "@/lib/db"
import { isAppStoreReviewDemoStudentExternalId } from "@/lib/app-store-review-accounts"
import {
  ensurePlaygroundCreditsRow,
  syncWeeklyPlaygroundCreditBalance,
  weeklyPlaygroundCreditAllowance,
} from "@/lib/playground-weekly-credits"
import {
  MEMBERSHIP_PLANS,
  PLAYGROUND_WEEKLY_CREDITS,
  normalizeMembershipTier,
  type MembershipTier,
  type MembershipFeatures,
  type MembershipPlan,
} from "./membership-constants"
import { isPastRegularAssessmentsHardCloseAsync } from "./regular-assessments-cutoff-server"
import { membershipAssessmentBenefitsAllowedForStudent } from "./assessment-privilege-governance"

export type MembershipStatus = "active" | "expired" | "canceled"

let entitlementColumnReady = false
async function ensureMembershipEntitlementColumn(): Promise<void> {
  if (entitlementColumnReady) return
  try {
    await sql`ALTER TABLE memberships ADD COLUMN IF NOT EXISTS entitlement_source VARCHAR(32) DEFAULT 'personal_purchase'`
    entitlementColumnReady = true
  } catch {
    entitlementColumnReady = true
  }
}

/** Future institution/grant/promotion sources — defaults to personal_purchase. */
export async function getMembershipEntitlementSource(
  studentId: number,
): Promise<string> {
  await ensureMembershipEntitlementColumn()
  try {
    const rows = await sql`
      SELECT entitlement_source FROM memberships
      WHERE student_id = ${studentId}
      ORDER BY created_at DESC
      LIMIT 1
    `
    return String(rows[0]?.entitlement_source || "personal_purchase")
  } catch {
    return "personal_purchase"
  }
}

export type { MembershipTier, MembershipFeatures, MembershipPlan }

function isAssessmentRolloverEnabled(v: MembershipFeatures["assessmentRollover"]): boolean {
  if (v === false) return false
  return typeof v === "object" && v !== null && v.maxAttemptsPerAssessment > 0
}

/** Self-service rollover limits for the student's effective tier (Explorer / Trailblazer; trial & donation use Trailblazer). */
export async function getAssessmentRolloverConfigForStudent(studentId: number): Promise<{
  enabled: boolean
  maxAttemptsPerAssessment: number
  windowHours: number
}> {
  const disabled = { enabled: false, maxAttemptsPerAssessment: 0, windowHours: 24 }
  const membershipPerksAllowed = await membershipAssessmentBenefitsAllowedForStudent(studentId)
  if (!membershipPerksAllowed) {
    return disabled
  }

  const tbPlan = MEMBERSHIP_PLANS.find((p) => p.id === "Trailblazer")
  const fromPlan = (plan: MembershipPlan | undefined) => {
    const ar = plan?.features.assessmentRollover
    if (typeof ar === "object" && ar !== null) {
      return {
        enabled: true,
        maxAttemptsPerAssessment: ar.maxAttemptsPerAssessment,
        windowHours: ar.windowHours,
      }
    }
    return { enabled: false, maxAttemptsPerAssessment: 0, windowHours: 24 }
  }

  const isBeta = await isBetaUser(studentId)
  if (isBeta) return fromPlan(tbPlan)

  const hasTrial = await hasActiveTrial(studentId)
  if (hasTrial) return fromPlan(tbPlan)

  const hasDonationAccess = await hasActiveDonationTrial(studentId)
  if (hasDonationAccess) return fromPlan(tbPlan)

  const tier = await getEffectiveMembershipTier(studentId)
  const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier)
  return fromPlan(plan)
}

export interface Membership {
  id: number
  student_id: number
  plan: MembershipTier
  start_date: string
  end_date: string | null
  status: MembershipStatus
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  created_at: string
  updated_at: string
}

// Get student's current membership
export async function getStudentMembership(studentId: number): Promise<Membership | null> {
  try {
    const result = await sql`
      SELECT * FROM memberships 
      WHERE student_id = ${studentId}
      LIMIT 1
    `
    return (result[0] as Membership) || null
  } catch (error) {
    return null
  }
}

// Get student's membership tier from students table
// Returns effective tier (Trailblazer for beta users)
export async function getStudentMembershipTier(studentId: number): Promise<MembershipTier> {
  try {
    // Beta users get Trailblazer tier
    const isBeta = await isBetaUser(studentId)
    if (isBeta) {
      return "Trailblazer"
    }
    
    const result = await sql`
      SELECT membership_tier FROM students 
      WHERE id = ${studentId}
      LIMIT 1
    `
    const raw = result[0]?.membership_tier
    return normalizeMembershipTier(raw) ?? "Scholar"
  } catch (error) {
    return "Scholar"
  }
}

// Create or update membership
export async function upsertMembership(
  studentId: number,
  plan: MembershipTier,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string,
): Promise<void> {
  try {
    // Update students table
    await sql`
      UPDATE students 
      SET membership_tier = ${plan}
      WHERE id = ${studentId}
    `

    // Upsert memberships table
    if (stripeCustomerId && stripeSubscriptionId) {
      await sql`
        INSERT INTO memberships (student_id, plan, status, stripe_customer_id, stripe_subscription_id, start_date)
        VALUES (${studentId}, ${plan}, 'active', ${stripeCustomerId}, ${stripeSubscriptionId}, CURRENT_TIMESTAMP)
        ON CONFLICT (student_id) 
        DO UPDATE SET 
          plan = ${plan},
          status = 'active',
          stripe_customer_id = ${stripeCustomerId},
          stripe_subscription_id = ${stripeSubscriptionId},
          updated_at = CURRENT_TIMESTAMP
      `
    } else {
      await sql`
        INSERT INTO memberships (student_id, plan, status, start_date)
        VALUES (${studentId}, ${plan}, 'active', CURRENT_TIMESTAMP)
        ON CONFLICT (student_id) 
        DO UPDATE SET 
          plan = ${plan},
          status = 'active',
          updated_at = CURRENT_TIMESTAMP
      `
    }
  } catch (error) {
    throw error
  }
}

// Cancel membership
export async function cancelMembership(studentId: number): Promise<void> {
  try {
    await sql`
      UPDATE memberships 
      SET status = 'canceled', end_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE student_id = ${studentId}
    `

    // Downgrade to Scholar
    await sql`
      UPDATE students 
      SET membership_tier = 'Scholar'
      WHERE id = ${studentId}
    `
  } catch (error) {
    throw error
  }
}

// Get all memberships (for admin)
export async function getAllMemberships(): Promise<
  Array<Membership & { student_name: string; student_id_code: string }>
> {
  try {
    const result = await sql`
      SELECT 
        m.*,
        s.full_name as student_name,
        s.student_id as student_id_code
      FROM memberships m
      JOIN students s ON m.student_id = s.id
      ORDER BY m.created_at DESC
    `
    return result as Array<Membership & { student_name: string; student_id_code: string }>
  } catch (error) {
    return []
  }
}

// Check if student is a beta user (BETA session OR beta_user column OR demo student)
export async function isBetaUser(studentId: number): Promise<boolean> {
  try {
    const result = await sql`
      SELECT beta_user, student_id, full_name, section FROM students 
      WHERE id = ${studentId}
      LIMIT 1
    `
    if (result.length === 0) return false
    
    const student = result[0]
    if (isAppStoreReviewDemoStudentExternalId(student.student_id as string)) {
      return false
    }
    // Check: BETA session OR beta_user column OR demo student identifier
    const isBeta = (
      student.section === 'BETA' ||  // Students in BETA session are beta testers
      student.beta_user === true ||   // Explicit beta_user flag
      student.student_id === 'DEMO001' ||  // Demo student identifier
      student.full_name?.toLowerCase() === 'demo student'  // Fallback
    )
    
    return isBeta
  } catch (error) {
    return false
  }
}

/** Beta + effective Explorer/Trailblazer bypass homework/mid-semester date windows (available_from/until). */
export async function bypassesAssessmentAvailabilityWindows(studentId: number): Promise<boolean> {
  if (await isBetaUser(studentId)) {
    return !(await isPastRegularAssessmentsHardCloseAsync())
  }
  const tier = await getEffectiveMembershipTier(studentId)
  if (tier === "Explorer" || tier === "Trailblazer") {
    return membershipAssessmentBenefitsAllowedForStudent(studentId)
  }
  if (await isPastRegularAssessmentsHardCloseAsync()) return false
  return false
}

// Check if student has active 7-day free trial (activated when changing password for first time)
// DEMO STUDENT: Always returns false - demo student has unlimited Trailblazer access, not trial
export async function hasActiveTrial(studentId: number): Promise<boolean> {
  try {
    // Check if this is demo student first - demo student doesn't have trial, has unlimited access
    const studentCheck = await sql`
      SELECT student_id, beta_user, section FROM students WHERE id = ${studentId} LIMIT 1
    `
    
    if (studentCheck.length > 0) {
      const student = studentCheck[0]
      if (isAppStoreReviewDemoStudentExternalId(student.student_id as string)) {
        return false
      }
      const isDemo = student.student_id === 'DEMO001' || 
                     student.beta_user === true || 
                     student.section === 'BETA'
      
      if (isDemo) {
        return false // Demo student doesn't have trial, has permanent Trailblazer access
      }
    }
    
    const result = await sql`
      SELECT trial_start_date
      FROM students
      WHERE id = ${studentId}
      LIMIT 1
    `
    
    if (result.length === 0) {
      return false
    }
    
    const trialStartDate = result[0].trial_start_date
    if (!trialStartDate) {
      return false
    }
    
    // Check if trial_start_date is within last 7 days
    // Use a single query to get both the trial_start_date and calculate days_ago
    const trialCheck = await sql`
      SELECT 
        trial_start_date,
        EXTRACT(EPOCH FROM (NOW() - trial_start_date)) / 86400 as days_ago
      FROM students
      WHERE id = ${studentId}
      LIMIT 1
    `
    
    if (trialCheck.length === 0) {
      return false
    }
    
    // Ensure days_ago is a number (convert string to number if needed)
    const daysAgoRaw = trialCheck[0].days_ago
    const daysAgo = typeof daysAgoRaw === 'string' ? parseFloat(daysAgoRaw) : (typeof daysAgoRaw === 'number' ? daysAgoRaw : 0)
    const isActive = daysAgo <= 7
    
    return isActive
  } catch (error) {
    return false
  }
}

// Get personal membership tier only (beta/trial/donation/membership row — no institution upgrade).
export async function getPersonalMembershipTier(studentId: number): Promise<MembershipTier> {
  const isBeta = await isBetaUser(studentId)
  if (isBeta) {
    return "Trailblazer"
  }

  const hasTrial = await hasActiveTrial(studentId)
  if (hasTrial) {
    return "Trailblazer"
  }

  const hasDonationAccess = await hasActiveDonationTrial(studentId)
  if (hasDonationAccess) {
    return "Trailblazer"
  }

  const activeMembership = await sql`
    SELECT COALESCE(m.tier, m.plan) as tier
    FROM memberships m
    WHERE m.student_id = ${studentId}
      AND m.status = 'active'
      AND (COALESCE(m.expires_at, m.end_date) IS NULL OR COALESCE(m.expires_at, m.end_date) > NOW())
    ORDER BY m.created_at DESC
    LIMIT 1
  `
  const membershipTier = normalizeMembershipTier(activeMembership[0]?.tier)
  if (membershipTier) {
    return membershipTier
  }

  const expiredCheck = await sql`
    SELECT id FROM memberships
    WHERE student_id = ${studentId}
      AND status = 'active'
      AND COALESCE(expires_at, end_date) IS NOT NULL
      AND COALESCE(expires_at, end_date) < NOW()
      AND (tier != 'Scholar' OR plan != 'Scholar')
    LIMIT 1
  `
  if (expiredCheck.length > 0) {
    return "Scholar"
  }

  return await getStudentMembershipTier(studentId)
}

// Get effective membership tier (returns Trailblazer for beta users, active trial, active donors, and institution sponsorship)
export async function getEffectiveMembershipTier(studentId: number): Promise<MembershipTier> {
  const personalTier = await getPersonalMembershipTier(studentId)
  return applyInstitutionalFeatureTier(studentId, personalTier)
}

const MEMBERSHIP_TIER_RANK: Record<MembershipTier, number> = {
  Scholar: 0,
  Explorer: 1,
  Trailblazer: 2,
}

/** Upgrade effective tier when an active institution license sponsors learning access. */
async function applyInstitutionalFeatureTier(
  studentId: number,
  tier: MembershipTier,
): Promise<MembershipTier> {
  try {
    const { findStudentCoveredLicenses } = await import("@/lib/institutions/coverage")
    const licenses = await findStudentCoveredLicenses(studentId)
    if (licenses.length > 0) {
      return MEMBERSHIP_TIER_RANK[tier] >= MEMBERSHIP_TIER_RANK.Trailblazer ? tier : "Trailblazer"
    }
  } catch {
    /* institution schema may not exist yet */
  }
  return tier
}

// Check if student has active donation within last 14 days (grants Trailblazer perks)
export async function hasActiveDonationTrial(studentId: number): Promise<boolean> {
  try {
    // Check if student has a completed donation within the last 14 days
    // Note: Using NOW() which uses the database server's timezone
    // The created_at column should be compared in the same timezone context
    const result = await sql`
      SELECT 
        id,
        amount,
        status,
        created_at,
        EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 as days_ago
      FROM donations
      WHERE student_id = ${studentId}
        AND status = 'completed'
        AND created_at >= NOW() - INTERVAL '14 days'
      ORDER BY created_at DESC
      LIMIT 1
    `
    
    if (result.length > 0) {
      return true
    } else {
      return false
    }
  } catch (error) {
    return false
  }
}

// Check if student has access to a feature
export async function hasFeatureAccess(
  studentId: number,
  feature: keyof MembershipFeatures,
  options?: { courseId?: number | null },
): Promise<boolean> {
  const assessmentGovernedFeatures: (keyof MembershipFeatures)[] = [
    "assessmentRollover",
    "saveAndFinishLater",
    "quizAttempts",
  ]
  if (assessmentGovernedFeatures.includes(feature)) {
    const allowed = await membershipAssessmentBenefitsAllowedForStudent(studentId, options?.courseId)
    if (!allowed) return false
  }

  try {
    const { getEffectiveStudentAccess } = await import("@/lib/entitlements/resolver")
    const access = await getEffectiveStudentAccess(studentId, { courseId: options?.courseId })
    if (access.institutionalEntitlement === "institution_student_access") {
      if (assessmentGovernedFeatures.includes(feature) && !access.gradedAttemptPerksAllowed) {
        return false
      }
      const trailblazerPlan = MEMBERSHIP_PLANS.find((p) => p.id === "Trailblazer")
      if (trailblazerPlan) {
        const featureValue = trailblazerPlan.features[feature]
        if (feature === "assessmentRollover") {
          return isAssessmentRolloverEnabled(featureValue as MembershipFeatures["assessmentRollover"])
        }
        if (typeof featureValue === "boolean") return featureValue
        if (typeof featureValue === "number") return featureValue > 0
        if (feature === "playgroundCredits" && featureValue === "unlimited") return true
      }
    }
  } catch {
    /* schema may not exist yet */
  }

  // Beta users get full access to all features
  const isBeta = await isBetaUser(studentId)
  if (isBeta) {
    return true
  }
  
  // Check if student has active 7-day free trial
  const hasTrial = await hasActiveTrial(studentId)
  if (hasTrial) {
    // Trial users get Trailblazer-level access, so check Trailblazer plan
    const trailblazerPlan = MEMBERSHIP_PLANS.find((p) => p.id === "Trailblazer")
    if (!trailblazerPlan) return false

    const featureValue = trailblazerPlan.features[feature]

    if (feature === "assessmentRollover") {
      return isAssessmentRolloverEnabled(featureValue as MembershipFeatures["assessmentRollover"])
    }

    // Handle boolean features
    if (typeof featureValue === "boolean") {
      return featureValue
    }

    // Handle string features (like aiTutor)
    if (typeof featureValue === "string") {
      return featureValue !== "No access"
    }

    // Handle numeric features (like quizAttempts)
    if (typeof featureValue === "number") {
      return featureValue > 0
    }

    // Handle playgroundCredits (number or "unlimited")
    if (feature === "playgroundCredits") {
      if (featureValue === "unlimited") return true
      if (typeof featureValue === "number") {
        try {
          const credits = await getPlaygroundCredits(studentId)
          return credits > 0
        } catch {
          return false
        }
      }
    }

    return false
  }

  // Check if student has active donation (within 14 days) - grants Trailblazer perks
  const hasDonationAccess = await hasActiveDonationTrial(studentId)
  if (hasDonationAccess) {
    // Donors get Trailblazer-level access, so check Trailblazer plan
    const trailblazerPlan = MEMBERSHIP_PLANS.find((p) => p.id === "Trailblazer")
    if (!trailblazerPlan) return false

    const featureValue = trailblazerPlan.features[feature]

    if (feature === "assessmentRollover") {
      return isAssessmentRolloverEnabled(featureValue as MembershipFeatures["assessmentRollover"])
    }

    // Handle boolean features
    if (typeof featureValue === "boolean") {
      return featureValue
    }

    // Handle string features (like aiTutor)
    if (typeof featureValue === "string") {
      return featureValue !== "No access"
    }

    // Handle numeric features (like quizAttempts)
    if (typeof featureValue === "number") {
      return featureValue > 0
    }

    // Handle playgroundCredits (number or "unlimited")
    if (feature === "playgroundCredits") {
      if (featureValue === "unlimited") return true
      if (typeof featureValue === "number") {
        try {
          const credits = await getPlaygroundCredits(studentId)
          return credits > 0
        } catch {
          return false
        }
      }
    }

    return false
  }

  const tier = await getEffectiveMembershipTier(studentId)
  const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier)
  if (!plan) return false

  const featureValue = plan.features[feature]

  if (feature === "assessmentRollover") {
    return isAssessmentRolloverEnabled(featureValue as MembershipFeatures["assessmentRollover"])
  }

  // Playground: weekly allowance — check live balance (not the plan's numeric limit alone)
  if (feature === "playgroundCredits") {
    if (featureValue === "unlimited") return true
    if (typeof featureValue === "number") {
      try {
        const credits = await getPlaygroundCredits(studentId)
        return credits > 0
      } catch {
        return false
      }
    }
    return false
  }

  // Handle boolean features
  if (typeof featureValue === "boolean") {
    return featureValue
  }

  // Handle string features (like aiTutor)
  if (typeof featureValue === "string") {
    return featureValue !== "No access"
  }

  // Handle numeric features (like quizAttempts)
  if (typeof featureValue === "number") {
    return featureValue > 0
  }

  // Handle playgroundCredits (number or "unlimited")
  if (feature === "playgroundCredits") {
    if (featureValue === "unlimited") return true
    if (typeof featureValue === "number") {
      // Check actual credit balance
      try {
        const credits = await getPlaygroundCredits(studentId)
        return credits > 0
      } catch {
        return false
      }
    }
  }

  return false
}

// Get student's playground credits balance
export async function getPlaygroundCredits(studentId: number): Promise<number> {
  try {
    // Beta users get unlimited credits
    const isBeta = await isBetaUser(studentId)
    if (isBeta) {
      return 999999 // Return a high number for unlimited
    }
    
    // Check if student has active 7-day free trial - grants Trailblazer perks (unlimited credits)
    const hasTrial = await hasActiveTrial(studentId)
    if (hasTrial) {
      return 999999 // Return a high number for unlimited
    }
    
    // Check if student has active donation (within 14 days) - grants Trailblazer perks (unlimited credits)
    const hasDonationAccess = await hasActiveDonationTrial(studentId)
    if (hasDonationAccess) {
      return 999999 // Return a high number for unlimited
    }
    
    const tier = await getEffectiveMembershipTier(studentId)
    const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier)
    
    // Trailblazer has unlimited credits
    if (plan?.features.playgroundCredits === "unlimited") {
      return 999999 // Return a high number for unlimited
    }

    // Scholar & Explorer: weekly free playground sessions (PLAYGROUND_WEEKLY_CREDITS)
    const weeklyResetTiers = ["Scholar", "Explorer"]
    if (weeklyResetTiers.includes(tier)) {
      const creditsRow = await sql`
        SELECT credits, last_reset_date
        FROM playground_credits
        WHERE student_id = ${studentId}
        LIMIT 1
      `

      const weeklyCredits = weeklyPlaygroundCreditAllowance(plan?.features.playgroundCredits)

      if (creditsRow.length > 0) {
        const credits = creditsRow[0]
        const currentCredits = Number(credits.credits) || 0
        return await syncWeeklyPlaygroundCreditBalance(
          studentId,
          weeklyCredits,
          credits.last_reset_date,
          currentCredits,
        )
      }

      const initializedCredits = await ensurePlaygroundCreditsRow(studentId, weeklyCredits)
      return initializedCredits
    }

    // Other tiers - check actual balance
    const creditsRow = await sql`
      SELECT credits
      FROM playground_credits
      WHERE student_id = ${studentId}
      LIMIT 1
    `
    
    if (creditsRow.length > 0) {
      return creditsRow[0].credits || 0
    } else {
      // Initialize credits based on plan
      const initialCredits = plan?.features.playgroundCredits === "unlimited" ? 0 : (typeof plan?.features.playgroundCredits === "number" ? plan.features.playgroundCredits : 0)
      await sql`
        INSERT INTO playground_credits (student_id, credits, last_reset_date)
        VALUES (${studentId}, ${initialCredits}, CURRENT_DATE)
        ON CONFLICT (student_id) DO NOTHING
      `
      return initialCredits
    }
  } catch (error) {
    // Return default if table doesn't exist yet
    return PLAYGROUND_WEEKLY_CREDITS
  }
}

// Deduct playground credits (returns true if successful, false if insufficient credits)
export async function deductPlaygroundCredits(studentId: number, amount: number = 1): Promise<boolean> {
  try {
    // Beta users get unlimited credits - no deduction needed
    const isBeta = await isBetaUser(studentId)
    if (isBeta) {
      return true
    }
    
    // Check if student has active 7-day free trial - grants Trailblazer perks (unlimited credits)
    const hasTrial = await hasActiveTrial(studentId)
    if (hasTrial) {
      return true
    }
    
    // Check if student has active donation (within 14 days) - grants Trailblazer perks (unlimited credits)
    const hasDonationAccess = await hasActiveDonationTrial(studentId)
    if (hasDonationAccess) {
      return true
    }
    
    const tier = await getEffectiveMembershipTier(studentId)
    const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier)
    
    // Trailblazer has unlimited - no deduction needed
    if (plan?.features.playgroundCredits === "unlimited") {
      return true
    }

    const currentCredits = await getPlaygroundCredits(studentId)
    
    if (currentCredits < amount) {
      return false
    }

    await sql`
      UPDATE playground_credits
      SET credits = credits - ${amount}, updated_at = CURRENT_TIMESTAMP
      WHERE student_id = ${studentId}
    `
    
    await sql`
      INSERT INTO playground_credit_transactions (student_id, transaction_type, credits, description, source)
      VALUES (${studentId}, 'spent', ${amount}, 'Playground session usage', 'usage')
    `

    return true
  } catch (error) {
    return false
  }
}

async function resolveStudentCoraTier(studentId: number): Promise<"Scholar" | "Explorer" | "Trailblazer"> {
  if (await isBetaUser(studentId)) return "Trailblazer"
  if (await hasActiveTrial(studentId)) return "Trailblazer"
  if (await hasActiveDonationTrial(studentId)) return "Trailblazer"
  try {
    const { studentHasInstitutionalLearningAccess } = await import("@/lib/entitlements/resolver")
    if (await studentHasInstitutionalLearningAccess(studentId)) return "Trailblazer"
  } catch {
    /* ignore */
  }
  const tier = await getEffectiveMembershipTier(studentId)
  if (tier === "Explorer" || tier === "Trailblazer" || tier === "Scholar") return tier
  return "Scholar"
}

/** Monthly Cora Credits balance (membership + purchased). No unlimited tiers. */
export async function getAITutorCredits(studentId: number): Promise<number> {
  try {
    const studentCheck = await sql`
      SELECT id FROM students WHERE id = ${studentId} LIMIT 1
    `
    if (studentCheck.length === 0) return 0
    const { getStudentCoraBalanceForTier } = await import("@/lib/cora/credits/student-ledger")
    const tier = await resolveStudentCoraTier(studentId)
    const bal = await getStudentCoraBalanceForTier(studentId, tier)
    return bal.total
  } catch {
    return 0
  }
}

export async function getStudentCoraBalance(studentId: number) {
  const { getStudentCoraBalanceForTier } = await import("@/lib/cora/credits/student-ledger")
  const tier = await resolveStudentCoraTier(studentId)
  try {
    const { ensureCreditAccount } = await import("@/lib/cora/ai/credit-accounts")
    await ensureCreditAccount({
      userId: studentId,
      userRole: "student",
      membershipTier: tier,
    })
  } catch {
    /* display ledger may lag; fall through to personal row */
  }
  const bal = await getStudentCoraBalanceForTier(studentId, tier)
  try {
    const { getCoraAllowance } = await import("@/lib/institutions/cora")
    const { studentSpendableCredits } = await import("@/lib/institutions/cora-spend")
    const allowance = await getCoraAllowance("student", studentId)
    const total = studentSpendableCredits(bal.total, allowance.institutionPool)
    return {
      ...bal,
      total,
      institutionRemaining: allowance.institutionPool?.remaining ?? null,
    }
  } catch {
    return { ...bal, institutionRemaining: null as number | null }
  }
}

/** Deduct Cora Credits (membership bucket first, then purchased). */
export async function deductAITutorCredits(
  studentId: number,
  creditsUsed: number = 5,
  sessionId?: number,
): Promise<boolean> {
  try {
    try {
      const { tryDebitInstitutionCora } = await import("@/lib/institutions/cora")
      // Campus pool is additional accounting — never a substitute for the
      // student's monthly cap (institution cover is not unlimited tokens).
      await tryDebitInstitutionCora({
        userType: "student",
        userId: studentId,
        credits: creditsUsed,
        workflowType: "student_cora",
      })
    } catch {
      /* no institutional pool */
    }
    const { deductStudentCoraCredits } = await import("@/lib/cora/credits/student-ledger")
    const tier = await resolveStudentCoraTier(studentId)
    const deducted = await deductStudentCoraCredits(studentId, creditsUsed, tier, {
      sessionId,
      description: "Cora usage",
      source: "usage",
    })
    if (deducted) {
      try {
        const { finalizeCreditCharge } = await import("@/lib/cora/ai/credit-accounts")
        await finalizeCreditCharge({
          userId: studentId,
          userRole: "student",
          reservedAmount: 0,
          actualCharge: creditsUsed,
          membershipTier: tier,
          description: "Cora usage",
        })
      } catch {
        /* display ledger may lag; personal row already moved */
      }
    }
    return deducted
  } catch {
    return false
  }
}

// Grant all perks for a membership tier (called when upgrading)
export async function grantMembershipPerks(studentId: number, tier: MembershipTier): Promise<void> {
  try {
    const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier)
    if (!plan) {
      return
    }

    // Grant playground credits based on tier
    const playgroundCreditsConfig = plan.features.playgroundCredits
    if (playgroundCreditsConfig === "unlimited") {
      // Trailblazer - unlimited, no need to set credits
    } else if (typeof playgroundCreditsConfig === "number") {
      // Scholar & Explorer: set weekly credits (PLAYGROUND_WEEKLY_CREDITS per week)
      try {
        const existingCredits = await sql`
          SELECT credits, last_reset_date
          FROM playground_credits
          WHERE student_id = ${studentId}
          LIMIT 1
        `

        if (existingCredits.length > 0) {
          // Update to tier's weekly amount and reset date
          await sql`
            UPDATE playground_credits
            SET 
              credits = ${playgroundCreditsConfig},
              last_reset_date = CURRENT_DATE,
              updated_at = CURRENT_TIMESTAMP
            WHERE student_id = ${studentId}
          `
          await sql`
            INSERT INTO playground_credit_transactions (student_id, transaction_type, credits, description, source)
            VALUES (${studentId}, 'reset', ${playgroundCreditsConfig}, ${`Membership upgrade to ${tier} - weekly credits reset`}, 'membership')
          `
        } else {
          // Create new record
          await sql`
            INSERT INTO playground_credits (student_id, credits, last_reset_date)
            VALUES (${studentId}, ${playgroundCreditsConfig}, CURRENT_DATE)
          `
          await sql`
            INSERT INTO playground_credit_transactions (student_id, transaction_type, credits, description, source)
            VALUES (${studentId}, 'earned', ${playgroundCreditsConfig}, ${`Membership upgrade to ${tier} - initial weekly credits`}, 'membership')
          `
        }
      } catch (error) {
        // Silently fail - perks are nice to have but shouldn't break the upgrade
      }
    }

    // Grant monthly Cora Credits based on tier (purchased credits preserved)
    const aiTutorConfig = plan.features.aiTutor
    if (typeof aiTutorConfig === "number" && aiTutorConfig > 0) {
      try {
        const { currentStudentPeriodKey, ensureStudentCoraCreditsSchema } = await import(
          "@/lib/cora/credits/student-ledger"
        )
        const { creditPeriodAction } = await import("@/lib/cora/credits/period-reset")
        await ensureStudentCoraCreditsSchema()
        const periodKey = currentStudentPeriodKey()
        const existing = (await sql`
          SELECT credits, period_key FROM ai_tutor_credits
          WHERE student_id = ${studentId}
          LIMIT 1
        `) as Array<{ credits: number; period_key: string | null }>
        const refill =
          existing.length === 0 ||
          creditPeriodAction(existing[0]?.period_key, periodKey) === "period_reset"

        if (refill) {
          await sql`
            INSERT INTO ai_tutor_credits (student_id, credits, purchased_credits, last_reset_date, period_key, membership_tier)
            VALUES (${studentId}, ${aiTutorConfig}, 0, CURRENT_DATE, ${periodKey}, ${tier})
            ON CONFLICT (student_id) DO UPDATE SET
              credits = ${aiTutorConfig},
              period_key = ${periodKey},
              membership_tier = ${tier},
              last_reset_date = CURRENT_DATE,
              updated_at = CURRENT_TIMESTAMP
          `
          await sql`
            INSERT INTO ai_tutor_credit_transactions (student_id, transaction_type, credits, description, source)
            VALUES (
              ${studentId},
              'reset',
              ${aiTutorConfig},
              ${`Membership upgrade to ${tier} - monthly Cora Credits`},
              'membership'
            )
          `
        } else {
          await sql`
            UPDATE ai_tutor_credits
            SET membership_tier = ${tier},
                period_key = ${periodKey},
                updated_at = CURRENT_TIMESTAMP
            WHERE student_id = ${studentId}
          `
        }

        // Authoritative balance API reads cora_credit_accounts — keep it in sync on upgrade/downgrade
        const { ensureCreditAccount } = await import("@/lib/cora/ai/credit-accounts")
        await ensureCreditAccount({
          userId: studentId,
          userRole: "student",
          membershipTier: tier,
        })
      } catch {
        // Silently fail - perks are nice to have but shouldn't break the upgrade
      }
    }
  } catch (error) {
    // Don't throw - perks are nice to have but shouldn't break the upgrade
  }
}

// Award playground credits (e.g., from donation)
export async function awardPlaygroundCredits(studentId: number, amount: number, source: string = "donation", description?: string): Promise<void> {
  try {
    await sql`
      INSERT INTO playground_credits (student_id, credits, last_reset_date)
      VALUES (${studentId}, ${amount}, CURRENT_DATE)
      ON CONFLICT (student_id)
      DO UPDATE SET
        credits = playground_credits.credits + ${amount},
        updated_at = CURRENT_TIMESTAMP
    `
    
    await sql`
      INSERT INTO playground_credit_transactions (student_id, transaction_type, credits, description, source)
      VALUES (${studentId}, 'earned', ${amount}, ${description || `Credits awarded from ${source}`}, ${source})
    `
  } catch (error) {
    // Silently fail - credits are nice to have but shouldn't break the flow
  }
}

/**
 * Grant Trailblazer-level perks for donors (14-day access)
 * Donations grant unlimited playground credits, unlimited AI tutor credits, and retake access
 */
export async function grantDonationPerks(studentId: number): Promise<void> {
  try {
    // Grant unlimited playground credits
    try {
      // Check if is_unlimited column exists
      const hasUnlimitedColumn = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'playground_credits' AND column_name = 'is_unlimited'
      `

      const existingCredits = await sql`
        SELECT credits
        FROM playground_credits
        WHERE student_id = ${studentId}
        LIMIT 1
      `

      if (existingCredits.length > 0) {
        // Update to unlimited
        if (hasUnlimitedColumn.length > 0) {
          await sql`
            UPDATE playground_credits
            SET 
              credits = 999999,
              is_unlimited = true,
              updated_at = CURRENT_TIMESTAMP
            WHERE student_id = ${studentId}
          `
        } else {
          await sql`
            UPDATE playground_credits
            SET 
              credits = 999999,
              updated_at = CURRENT_TIMESTAMP
            WHERE student_id = ${studentId}
          `
        }
        await sql`
          INSERT INTO playground_credit_transactions (student_id, transaction_type, credits, description, source)
          VALUES (${studentId}, 'earned', 999999, 'Donation - unlimited playground access (14 days)', 'donation')
        `
      } else {
        // Create new record with unlimited
        if (hasUnlimitedColumn.length > 0) {
          await sql`
            INSERT INTO playground_credits (student_id, credits, last_reset_date, is_unlimited)
            VALUES (${studentId}, 999999, CURRENT_DATE, true)
          `
        } else {
          await sql`
            INSERT INTO playground_credits (student_id, credits, last_reset_date)
            VALUES (${studentId}, 999999, CURRENT_DATE)
          `
        }
        await sql`
          INSERT INTO playground_credit_transactions (student_id, transaction_type, credits, description, source)
          VALUES (${studentId}, 'earned', 999999, 'Donation - unlimited playground access (14 days)', 'donation')
        `
      }
    } catch (error) {
      // Silently fail - perks are nice to have but shouldn't break the donation flow
    }

    // Grant Trailblazer monthly Cora Credits (donation unlocks Trailblazer allocation, not unlimited)
    try {
      const { STUDENT_CORA_MONTHLY } = await import("@/lib/cora/credits/economy")
      const { currentStudentPeriodKey, ensureStudentCoraCreditsSchema } = await import(
        "@/lib/cora/credits/student-ledger"
      )
      await ensureStudentCoraCreditsSchema()
      const allocation = STUDENT_CORA_MONTHLY.Trailblazer
      const periodKey = currentStudentPeriodKey()
      await sql`
        INSERT INTO ai_tutor_credits (student_id, credits, purchased_credits, last_reset_date, period_key, membership_tier)
        VALUES (${studentId}, ${allocation}, 0, CURRENT_DATE, ${periodKey}, 'Trailblazer')
        ON CONFLICT (student_id) DO UPDATE SET
          credits = ${allocation},
          period_key = ${periodKey},
          membership_tier = 'Trailblazer',
          last_reset_date = CURRENT_DATE,
          updated_at = CURRENT_TIMESTAMP
      `
      await sql`
        INSERT INTO ai_tutor_credit_transactions (student_id, transaction_type, credits, description, source)
        VALUES (
          ${studentId},
          'earned',
          ${allocation},
          'Donation — Trailblazer monthly Cora Credits',
          'donation'
        )
      `
    } catch {
      // Silently fail - perks are nice to have but shouldn't break the donation flow
    }
  } catch (error) {
    throw error
  }
}
