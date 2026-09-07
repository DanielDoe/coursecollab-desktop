/**
 * Guest product configuration — single source of truth.
 * Feature unlock = lifetime (one-time). AI usage = consumable Cora Credits (never expire).
 *
 * Cora Credits ≠ API tokens. ~1,000 credits ≈ $1 provider AI cost (internal; do not show users).
 */

import type { GuestPlan } from "@/lib/guest/types"
import { CAREER_MEMBER_FREE_PLAN, CAREER_MEMBER_LABEL } from "@/lib/guest/display"
import { CORA_LOW_BALANCE_FRACTION } from "@/lib/cora/credits/economy"
import { GUEST_CAREER_AI_FEATURE_COSTS } from "@/lib/guest/career/guest-ai-credit-costs"

/** Small promotional starter — not a full AI allowance. */
export const GUEST_FREE_STARTER_CORA_CREDITS = 50

/** Lifetime Cora Career included credits (~$5 raw AI capacity at current peg). */
export const GUEST_CORA_CAREER_LIFETIME_CREDITS = 5_000

/** Complimentary full preview Resume Match analyses for Guest Free (lifetime, non-resetting). */
export const GUEST_FREE_COMPLIMENTARY_RESUME_MATCHES = 2

/** Standard one-time Cora Career Lifetime price (USD). */
export const GUEST_CORA_CAREER_LIFETIME_PRICE_USD = 39.99

/** Cora Career Essentials — entry lifetime tier (USD). */
export const GUEST_CORA_CAREER_ESSENTIALS_PRICE_USD = 19.99

/** Essentials included credits (~$2 raw AI capacity). */
export const GUEST_CORA_CAREER_ESSENTIALS_CREDITS = 2_000

export const GUEST_CAREER_PAID_PLAN_IDS = ["cora_career_essentials", "cora_career"] as const

export type GuestCareerPaidPlanId = (typeof GUEST_CAREER_PAID_PLAN_IDS)[number]

export function isGuestCareerPaidPlan(plan: string): plan is GuestCareerPaidPlanId {
  return plan === "cora_career_essentials" || plan === "cora_career"
}

export function guestPlanHasCareerUnlock(plan: GuestPlan): boolean {
  return isGuestCareerPaidPlan(plan)
}

/** Display order for pricing pages. */
export function listGuestAccessPlans(): GuestAccessPlanConfig[] {
  return [
    GUEST_ACCESS_PLANS.guest_free,
    GUEST_ACCESS_PLANS.cora_career_essentials,
    GUEST_ACCESS_PLANS.cora_career,
  ]
}

export type GuestAccessPlanId = GuestPlan

export type GuestAccessPlanConfig = {
  id: GuestAccessPlanId
  name: string
  displayName: string
  priceUsd: number
  priceCents: number
  /** Lifetime — no subscription, no renewal */
  lifetime: boolean
  coraCreditsIncluded: number
  stripePriceEnvKey: string | null
  marketingFeatures: readonly string[]
  recommendationsEnabled: boolean
  premiumCoraCareer: boolean
  /** Highlight on pricing grid */
  popular?: boolean
}

export const GUEST_ACCESS_PLANS: Record<GuestAccessPlanId, GuestAccessPlanConfig> = {
  guest_free: {
    id: "guest_free",
    name: CAREER_MEMBER_LABEL,
    displayName: CAREER_MEMBER_FREE_PLAN,
    priceUsd: 0,
    priceCents: 0,
    lifetime: true,
    coraCreditsIncluded: GUEST_FREE_STARTER_CORA_CREDITS,
    stripePriceEnvKey: null,
    recommendationsEnabled: true,
    premiumCoraCareer: false,
    marketingFeatures: [
      "Faculty recommendation requests — always free",
      "Recommendation tracking & faculty messaging",
      "Basic career profile & application tracker",
      "One master résumé on file",
      `${GUEST_FREE_COMPLIMENTARY_RESUME_MATCHES} complimentary Resume Match scans (lifetime)`,
      "Basic match scores & dimension overview",
      "Small promotional Cora Credit allowance",
    ],
  },
  cora_career_essentials: {
    id: "cora_career_essentials",
    name: "Cora Career Essentials",
    displayName: "Cora Career Essentials",
    priceUsd: GUEST_CORA_CAREER_ESSENTIALS_PRICE_USD,
    priceCents: Math.round(GUEST_CORA_CAREER_ESSENTIALS_PRICE_USD * 100),
    lifetime: true,
    coraCreditsIncluded: GUEST_CORA_CAREER_ESSENTIALS_CREDITS,
    stripePriceEnvKey: "STRIPE_GUEST_CORA_CAREER_ESSENTIALS_PRICE_ID",
    recommendationsEnabled: true,
    premiumCoraCareer: true,
    marketingFeatures: [
      "Lifetime access — no subscription",
      "Full Resume Match & match evidence (uses Cora Credits per scan)",
      "Cover letter assistance (uses Cora Credits)",
      "Application workspace",
      "Cora Career chat & agent (credit-based)",
      `${GUEST_CORA_CAREER_ESSENTIALS_CREDITS.toLocaleString("en-US")} Cora Credits included`,
      "Upgrade to Lifetime anytime for interview prep + more credits",
    ],
  },
  cora_career: {
    id: "cora_career",
    name: "Cora Career",
    displayName: "Cora Career Lifetime",
    priceUsd: GUEST_CORA_CAREER_LIFETIME_PRICE_USD,
    priceCents: Math.round(GUEST_CORA_CAREER_LIFETIME_PRICE_USD * 100),
    lifetime: true,
    coraCreditsIncluded: GUEST_CORA_CAREER_LIFETIME_CREDITS,
    stripePriceEnvKey: "STRIPE_GUEST_CORA_CAREER_LIFETIME_PRICE_ID",
    recommendationsEnabled: true,
    premiumCoraCareer: true,
    popular: true,
    marketingFeatures: [
      "Everything in Essentials",
      "Cora Optimize & résumé tailoring (uses Cora Credits)",
      "Interview preparation & practice (uses Cora Credits)",
      "Graduate school & scholarship support",
      "Full Cora Career Agent",
      `${GUEST_CORA_CAREER_LIFETIME_CREDITS.toLocaleString("en-US")} Cora Credits included`,
      "Purchased credits never expire",
    ],
  },
} as const

export type GuestCoraCreditPackId =
  | "quick_boost"
  | "application_pack"
  | "career_pack"
  | "power_pack"

export type GuestCoraCreditPackConfig = {
  id: GuestCoraCreditPackId
  name: string
  credits: number
  priceCents: number
  priceUsd: number
  description: string
  /** User-facing hint — never expose provider cost or margins */
  usageHint?: string
  popular?: boolean
  /** Vercel env key for Stripe Price ID (optional — falls back to price_data) */
  stripePriceEnvKey: string
}

/** What consumable Cora Credits power (requires Cora Career lifetime unlock). */
export const GUEST_CORA_CREDIT_USES: readonly string[] = [
  "Cora Career Agent chat (usage-based credits per session)",
  `Resume Match (${GUEST_CAREER_AI_FEATURE_COSTS.resume_match} credits per new scan; cached re-runs free)`,
  `Résumé review (${GUEST_CAREER_AI_FEATURE_COSTS.resume_review} credits)`,
  `Interview prep (${GUEST_CAREER_AI_FEATURE_COSTS.interview_prep} credits)`,
  `Application statements (${GUEST_CAREER_AI_FEATURE_COSTS.statement_draft} credits)`,
  `Application planning (${GUEST_CAREER_AI_FEATURE_COSTS.application_plan} credits)`,
  "Cover letter drafts (template-based — no credits today)",
  "Graduate school & scholarship support via Cora chat",
] as const

/**
 * Guest consumable packs — intentionally more conservative than enrolled-student packs.
 * Credits never expire. All values configurable here only.
 */
export const GUEST_CORA_CREDIT_PACKS: readonly GuestCoraCreditPackConfig[] = [
  {
    id: "quick_boost",
    name: "Quick Boost",
    credits: 250,
    priceCents: 299,
    priceUsd: 2.99,
    description: "A focused top-up when you need a few more AI sessions.",
    usageHint: "Great for a few résumé scans or Cora chat sessions.",
    stripePriceEnvKey: "STRIPE_GUEST_CREDIT_QUICK_BOOST_PRICE_ID",
  },
  {
    id: "application_pack",
    name: "Application Pack",
    credits: 600,
    priceCents: 599,
    priceUsd: 5.99,
    description: "Extra runway for drafts and revisions across an application cycle.",
    usageHint: "Covers several Cora sessions across one or two applications.",
    popular: true,
    stripePriceEnvKey: "STRIPE_GUEST_CREDIT_APPLICATION_PACK_PRICE_ID",
  },
  {
    id: "career_pack",
    name: "Career Pack",
    credits: 1_250,
    priceCents: 999,
    priceUsd: 9.99,
    description: "Extended capacity for parallel applications and deeper revisions.",
    usageHint: "Solid for multiple programs, cover letters, and interview prep.",
    stripePriceEnvKey: "STRIPE_GUEST_CREDIT_CAREER_PACK_PRICE_ID",
  },
  {
    id: "power_pack",
    name: "Power Pack",
    credits: 2_750,
    priceCents: 1999,
    priceUsd: 19.99,
    description: "Largest Career Member top-up for competitive application seasons.",
    usageHint: "Best for heavy revision cycles and multi-round Cora workflows.",
    stripePriceEnvKey: "STRIPE_GUEST_CREDIT_POWER_PACK_PRICE_ID",
  },
] as const

export type GuestCoraBalanceLevel = "normal" | "low" | "critical" | "empty"

/** Configurable balance UX thresholds — do not hard-code in UI components. */
export function resolveGuestCoraBalanceLevel(
  available: number,
  plan: GuestAccessPlanId,
): GuestCoraBalanceLevel {
  if (available <= 0) return "empty"
  const included = getGuestAccessPlan(plan).coraCreditsIncluded
  const lowThreshold =
    included > 0
      ? Math.max(25, Math.floor(included * CORA_LOW_BALANCE_FRACTION))
      : 25
  const criticalThreshold =
    included > 0 ? Math.max(10, Math.floor(included * 0.02)) : 10
  if (available <= criticalThreshold) return "critical"
  if (available <= lowThreshold) return "low"
  return "normal"
}

/** @deprecated use GUEST_ACCESS_PLANS */
export const GUEST_MEMBERSHIP_PLANS = GUEST_ACCESS_PLANS

export function getGuestAccessPlan(plan: GuestPlan): GuestAccessPlanConfig {
  return GUEST_ACCESS_PLANS[plan] ?? GUEST_ACCESS_PLANS.guest_free
}

/** @deprecated */
export const getGuestMembershipPlan = getGuestAccessPlan

export function getGuestCoraCreditPack(packId: string): GuestCoraCreditPackConfig | null {
  return GUEST_CORA_CREDIT_PACKS.find((p) => p.id === packId) ?? null
}

export function resolveGuestLifetimeStripePriceId(plan: GuestPlan = "cora_career"): string | null {
  const cfg = getGuestAccessPlan(plan)
  if (!cfg.stripePriceEnvKey) return null
  const raw = process.env[cfg.stripePriceEnvKey]?.trim()
  if (raw) return raw
  if (plan === "cora_career") {
    return process.env.STRIPE_GUEST_CORA_CAREER_PRICE_ID?.trim() || null
  }
  return null
}

/** @deprecated use resolveGuestLifetimeStripePriceId(plan) */
export function resolveGuestLifetimeStripePriceIdLegacy(): string | null {
  return resolveGuestLifetimeStripePriceId("cora_career")
}

export function resolveGuestCreditPackStripePriceId(packId: string): string | null {
  const pack = getGuestCoraCreditPack(packId)
  if (!pack) return null
  const raw = process.env[pack.stripePriceEnvKey]?.trim()
  return raw || null
}

export function formatGuestAccessPrice(plan: GuestPlan): string {
  const cfg = getGuestAccessPlan(plan)
  if (cfg.priceUsd === 0) return "$0 · Lifetime"
  return `$${cfg.priceUsd.toFixed(2)} one-time`
}

/** @deprecated */
export const formatGuestPlanPrice = formatGuestAccessPrice
