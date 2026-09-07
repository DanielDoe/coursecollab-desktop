import {
  MEMBERSHIP_PLANS,
  studentSemesterOffer,
  type MembershipPlan,
  type MembershipTier,
} from "@/lib/membership-constants"
import { STUDENT_CORA_MONTHLY } from "@/lib/cora/credits/economy"

export type StudentPlanCardModel = {
  id: MembershipTier
  name: string
  subtitle: string
  description: string
  ctaLabel: string
  popular: boolean
  semesterPriceInCents: number
  listPriceInCents: number | null
  saveCents: number
  monthlyCoraCredits: number
  coraLiteAfterAllowance: boolean
  highlights: string[]
  secondaryBenefits: string[]
  colorClass: string
}

const TIER_COLOR: Record<MembershipTier, string> = {
  Scholar: "bg-slate-500",
  Explorer: "bg-blue-600",
  Trailblazer: "bg-[var(--cc-accent)]",
}

export function studentPlanCardModel(plan: MembershipPlan): StudentPlanCardModel {
  const offer = studentSemesterOffer(plan.id)
  return {
    id: plan.id,
    name: plan.name,
    subtitle: plan.subtitle,
    description: plan.description,
    ctaLabel: plan.ctaLabel,
    popular: Boolean(plan.popular),
    semesterPriceInCents: plan.semesterPriceInCents ?? plan.priceInCents,
    listPriceInCents: offer?.listCents ?? null,
    saveCents: offer?.saveCents ?? 0,
    monthlyCoraCredits: STUDENT_CORA_MONTHLY[plan.id],
    coraLiteAfterAllowance: plan.id === "Trailblazer" || plan.id === "Explorer",
    highlights: plan.highlights,
    secondaryBenefits: plan.secondaryBenefits,
    colorClass: TIER_COLOR[plan.id],
  }
}

export function listStudentPlanCards(): StudentPlanCardModel[] {
  return MEMBERSHIP_PLANS.map(studentPlanCardModel)
}

export function formatSemesterPrice(cents: number): string {
  if (cents <= 0) return "Free"
  return `$${(cents / 100).toFixed(2)}`
}
