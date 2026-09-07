/**
 * Internal institutional pricing analysis — not an accounting or tax calculation.
 * All money is integer cents. Catalog changes must not rewrite historical contracts.
 */

import { MEMBERSHIP_PLANS, type MembershipTier } from "@/lib/membership-constants"
import {
  getInstructorMembershipPlan,
  type InstructorMembershipTier,
} from "@/lib/instructor-membership-constants"
import {
  INSTITUTION_PLANS,
  INSTITUTION_PRICING_VERSION,
  getInstitutionPlan,
  type InstitutionPlan,
  type InstitutionPlanKey,
} from "@/lib/institution-plans"

export const INSTITUTION_DISCOUNT_TYPES = ["percentage", "fixed_amount", "custom_price"] as const
export type InstitutionDiscountType = (typeof INSTITUTION_DISCOUNT_TYPES)[number]

export const INSTITUTION_DISCOUNT_REASONS = [
  "founding_institution",
  "pilot_partnership",
  "multi_year_agreement",
  "volume",
  "nonprofit_education",
  "strategic_partnership",
  "promotional",
  "custom",
] as const
export type InstitutionDiscountReason = (typeof INSTITUTION_DISCOUNT_REASONS)[number]

export type StudentRetailTier = Extract<MembershipTier, "Explorer" | "Trailblazer">
export type InstructorRetailTier = Extract<InstructorMembershipTier, "Pro" | "Teams">

export type RetailEquivalentInput = {
  studentCount: number
  instructorCount: number
  semesters: number
  studentTier?: StudentRetailTier
  instructorTier?: InstructorRetailTier
}

export type RetailEquivalentResult = {
  studentSemesterPriceCents: number
  instructorSemesterPriceCents: number
  studentRetailCents: number
  instructorRetailCents: number
  totalRetailCents: number
  disclaimer: string
}

export const PRICING_ANALYSIS_DISCLAIMER =
  "Internal pricing analysis only. Not an accounting, tax, or invoice calculation."

function studentSemesterCents(tier: StudentRetailTier): number {
  const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier)
  const cents = plan?.semesterPriceInCents
  if (cents == null || !Number.isInteger(cents)) {
    throw new Error(`Missing integer semester price for ${tier}`)
  }
  return cents
}

function instructorSemesterCents(tier: InstructorRetailTier): number {
  const cents = getInstructorMembershipPlan(tier).semesterPriceInCents
  if (!Number.isInteger(cents)) {
    throw new Error(`Missing integer semester price for ${tier}`)
  }
  return cents
}

function requireNonNegativeInt(n: number, label: string): number {
  if (!Number.isInteger(n) || n < 0) throw new Error(`${label} must be a non-negative integer`)
  return n
}

/** Unique-student × tier × semesters + instructors × tier × semesters. */
export function calculateRetailEquivalent(input: RetailEquivalentInput): RetailEquivalentResult {
  const studentCount = requireNonNegativeInt(input.studentCount, "studentCount")
  const instructorCount = requireNonNegativeInt(input.instructorCount, "instructorCount")
  const semesters = requireNonNegativeInt(input.semesters, "semesters")
  const studentTier = input.studentTier ?? "Trailblazer"
  const instructorTier = input.instructorTier ?? "Pro"
  const studentSemesterPriceCents = studentSemesterCents(studentTier)
  const instructorSemesterPriceCents = instructorSemesterCents(instructorTier)
  const studentRetailCents = studentCount * studentSemesterPriceCents * semesters
  const instructorRetailCents = instructorCount * instructorSemesterPriceCents * semesters
  return {
    studentSemesterPriceCents,
    instructorSemesterPriceCents,
    studentRetailCents,
    instructorRetailCents,
    totalRetailCents: studentRetailCents + instructorRetailCents,
    disclaimer: PRICING_ANALYSIS_DISCLAIMER,
  }
}

/** Effective annual list price per maximum student capacity. Null when capacity is negotiated. */
export function effectiveAnnualPricePerStudentCents(plan: InstitutionPlan): number | null {
  if (plan.annualListPriceCents == null || plan.studentCapacity === "negotiated") return null
  if (plan.studentCapacity <= 0) return null
  return Math.trunc(plan.annualListPriceCents / plan.studentCapacity)
}

export function institutionalDiscountAgainstRetail(input: {
  institutionalPriceCents: number
  retailEquivalentCents: number
}): { discountCents: number; discountBps: number | null } {
  const institutional = requireNonNegativeInt(input.institutionalPriceCents, "institutionalPriceCents")
  const retail = requireNonNegativeInt(input.retailEquivalentCents, "retailEquivalentCents")
  const discountCents = retail - institutional
  if (retail === 0) return { discountCents, discountBps: null }
  return { discountCents, discountBps: Math.trunc((discountCents * 10_000) / retail) }
}

export function applyInstitutionDiscount(input: {
  listPriceCents: number
  discountType?: InstitutionDiscountType | "none" | null
  discountValue?: number | null
  customPriceCents?: number | null
}): { listPriceCents: number; negotiatedPriceCents: number; discountCents: number } {
  const listPriceCents = requireNonNegativeInt(input.listPriceCents, "listPriceCents")
  const type = input.discountType ?? "none"
  if (type === "none" || type == null) {
    return { listPriceCents, negotiatedPriceCents: listPriceCents, discountCents: 0 }
  }
  if (type === "percentage") {
    const pct = requireNonNegativeInt(input.discountValue ?? 0, "discountValue")
    if (pct > 100) throw new Error("percentage discount cannot exceed 100")
    const discountCents = Math.trunc((listPriceCents * pct) / 100)
    return { listPriceCents, negotiatedPriceCents: listPriceCents - discountCents, discountCents }
  }
  if (type === "fixed_amount") {
    const discountCents = requireNonNegativeInt(input.discountValue ?? 0, "discountValue")
    const negotiatedPriceCents = Math.max(0, listPriceCents - discountCents)
    return { listPriceCents, negotiatedPriceCents, discountCents: listPriceCents - negotiatedPriceCents }
  }
  if (type === "custom_price") {
    const negotiatedPriceCents = requireNonNegativeInt(input.customPriceCents ?? 0, "customPriceCents")
    return {
      listPriceCents,
      negotiatedPriceCents,
      discountCents: listPriceCents - negotiatedPriceCents,
    }
  }
  throw new Error("Unsupported discount type")
}

export type ContractValueInput = {
  negotiatedPriceCents: number
  contractTermMonths?: number
  billingPeriod?: "annual"
}

export type ContractValueResult = {
  cashCollectedCents: number
  annualContractValueCents: number
  totalContractValueCents: number
  arrContributionCents: number
  mrrEquivalentCents: number
}

/**
 * Prepaid annual license: cash = ACV = ARR = negotiated annual amount.
 * Never treat the annual amount as monthly revenue.
 */
export function calculateContractValues(input: ContractValueInput): ContractValueResult {
  const negotiated = requireNonNegativeInt(input.negotiatedPriceCents, "negotiatedPriceCents")
  const months = requireNonNegativeInt(input.contractTermMonths ?? 12, "contractTermMonths")
  const years = Math.max(1, Math.trunc(months / 12) || 1)
  const remainderMonths = months % 12
  const annualContractValueCents =
    months === 12 ? negotiated : remainderMonths === 0 ? Math.trunc(negotiated / years) : negotiated
  const totalContractValueCents = negotiated
  return {
    cashCollectedCents: negotiated,
    annualContractValueCents,
    totalContractValueCents,
    arrContributionCents: annualContractValueCents,
    mrrEquivalentCents: Math.trunc((annualContractValueCents + 6) / 12),
  }
}

export type CommercialSnapshot = {
  planId: InstitutionPlanKey
  pricingVersion: number
  listPriceCents: number | null
  negotiatedPriceCents: number | null
  includedCoraCredits: number | null
  studentCapacity: number | null
  instructorCapacity: number | null
  featureBundle: InstitutionPlanKey
  billingPeriod: "annual"
  contractTermMonths: number
}

export function snapshotPlanCommercialTerms(
  planId: string,
  discount?: {
    discountType?: InstitutionDiscountType | "none" | null
    discountValue?: number | null
    customPriceCents?: number | null
    contractTermMonths?: number
  },
): CommercialSnapshot {
  const plan = getInstitutionPlan(planId)
  if (!plan) throw new Error(`Unknown institutional plan: ${planId}`)
  const listPriceCents = plan.annualListPriceCents
  let negotiatedPriceCents = listPriceCents
  if (listPriceCents != null && discount && discount.discountType && discount.discountType !== "none") {
    negotiatedPriceCents = applyInstitutionDiscount({
      listPriceCents,
      discountType: discount.discountType,
      discountValue: discount.discountValue,
      customPriceCents: discount.customPriceCents,
    }).negotiatedPriceCents
  }
  return {
    planId: plan.planKey,
    pricingVersion: INSTITUTION_PRICING_VERSION,
    listPriceCents,
    negotiatedPriceCents,
    includedCoraCredits: typeof plan.includedCoraCredits === "number" ? plan.includedCoraCredits : null,
    studentCapacity: typeof plan.studentCapacity === "number" ? plan.studentCapacity : null,
    instructorCapacity: typeof plan.instructorCapacity === "number" ? plan.instructorCapacity : null,
    featureBundle: plan.featureBundle,
    billingPeriod: "annual",
    contractTermMonths: discount?.contractTermMonths ?? 12,
  }
}

export function catalogPricingAnalysis() {
  return INSTITUTION_PLANS.filter((p) => p.active).map((plan) => {
    const perStudent = effectiveAnnualPricePerStudentCents(plan)
    const cap = typeof plan.studentCapacity === "number" ? plan.studentCapacity : null
    const retail2 = cap
      ? calculateRetailEquivalent({
          studentCount: cap,
          instructorCount: 0,
          semesters: 2,
          studentTier: "Trailblazer",
        })
      : null
    const retail3 = cap
      ? calculateRetailEquivalent({
          studentCount: cap,
          instructorCount: 0,
          semesters: 3,
          studentTier: "Trailblazer",
        })
      : null
    const vs2 =
      plan.annualListPriceCents != null && retail2
        ? institutionalDiscountAgainstRetail({
            institutionalPriceCents: plan.annualListPriceCents,
            retailEquivalentCents: retail2.totalRetailCents,
          })
        : null
    const vs3 =
      plan.annualListPriceCents != null && retail3
        ? institutionalDiscountAgainstRetail({
            institutionalPriceCents: plan.annualListPriceCents,
            retailEquivalentCents: retail3.totalRetailCents,
          })
        : null
    return {
      planKey: plan.planKey,
      displayName: plan.displayName,
      listPriceCents: plan.annualListPriceCents,
      studentCapacity: plan.studentCapacity,
      instructorCapacity: plan.instructorCapacity,
      pricePerMaxStudentCents: perStudent,
      trailblazerRetail2SemesterCents: retail2?.totalRetailCents ?? null,
      trailblazerRetail3SemesterCents: retail3?.totalRetailCents ?? null,
      discountVs2SemesterBps: vs2?.discountBps ?? null,
      discountVs3SemesterBps: vs3?.discountBps ?? null,
      includedCoraCredits: plan.includedCoraCredits,
      quoteOnly: plan.quoteOnly,
      selfServiceEligible: plan.selfServiceEligible,
      pricingVersion: INSTITUTION_PRICING_VERSION,
      disclaimer: PRICING_ANALYSIS_DISCLAIMER,
    }
  })
}
