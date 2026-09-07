import Stripe from "stripe"

// Lazy init: don't throw at module load - let routes handle missing config gracefully
// This prevents 500s when STRIPE_SECRET_KEY isn't set in Vercel (e.g. env not synced)
let _stripe: Stripe | null = null
function getStripe(): Stripe | null {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || !key.trim()) {
    console.error("[Stripe] Missing STRIPE_SECRET_KEY - payment features disabled")
    return null
  }
  _stripe = new Stripe(key, {
    apiVersion: "2024-06-20",
    typescript: true,
    maxNetworkRetries: 3,
    timeout: 30000,
  })
  return _stripe
}

const hasKey = typeof process !== "undefined" && process.env?.STRIPE_SECRET_KEY?.trim()
export const stripe: Stripe | null = hasKey ? getStripe() : null

// Stripe product IDs - trim to fix env vars with trailing newlines from Vercel
const trim = (s: string | undefined) => s?.trim() || ""
export const STRIPE_PRODUCTS = {
  Explorer: trim(process.env.STRIPE_EXPLORER_PRICE_ID) || "price_explorer",
  Trailblazer: trim(process.env.STRIPE_TRAILBLAZER_PRICE_ID) || "price_trailblazer",
  Explorer_Semester: trim(process.env.STRIPE_EXPLORER_SEMESTER_PRICE_ID) || trim(process.env.Explorer_Semester) || "price_1U8dfHI51MiyxGVkhRX23M4u",
  Trailblazer_Semester: trim(process.env.STRIPE_TRAILBLAZER_SEMESTER_PRICE_ID) || trim(process.env.Trailblazer_Semester) || "price_1U8dfII51MiyxGVkPUkTefWv",
}

/** Student Cora Credit packs — one-time top-ups */
export const STRIPE_STUDENT_CREDIT_PACKS = {
  student_1k: trim(process.env.STRIPE_STUDENT_CREDIT_STUDY_BOOST_PRICE_ID),
  student_3k: trim(process.env.STRIPE_STUDENT_CREDIT_EXAM_BOOST_PRICE_ID),
  student_7_5k: trim(process.env.STRIPE_STUDENT_CREDIT_POWER_PACK_PRICE_ID),
} as const

export const STRIPE_STUDENT_CREDIT_PRODUCT_ID = trim(process.env.STRIPE_STUDENT_CORA_CREDITS_PRODUCT_ID)

/** Instructor/faculty membership — semester (one-time) and annual (one-time academic year) prices. */
export const STRIPE_INSTRUCTOR_PRODUCTS = {
  Pro_Semester: trim(process.env.STRIPE_INSTRUCTOR_PRO_SEMESTER_PRICE_ID),
  Pro_Annual: trim(process.env.STRIPE_INSTRUCTOR_PRO_ANNUAL_PRICE_ID),
  Teams_Semester:
    trim(process.env.STRIPE_INSTRUCTOR_TEAMS_SEMESTER_PRICE_ID) ||
    trim(process.env.STRIPE_INSTRUCTOR_ENTERPRISE_SEMESTER_PRICE_ID),
  Teams_Annual:
    trim(process.env.STRIPE_INSTRUCTOR_TEAMS_ANNUAL_PRICE_ID) ||
    trim(process.env.STRIPE_INSTRUCTOR_ENTERPRISE_ANNUAL_PRICE_ID),
  /** @deprecated alias — same price as Teams_Semester */
  Enterprise_Semester:
    trim(process.env.STRIPE_INSTRUCTOR_TEAMS_SEMESTER_PRICE_ID) ||
    trim(process.env.STRIPE_INSTRUCTOR_ENTERPRISE_SEMESTER_PRICE_ID),
  /** @deprecated alias — same price as Teams_Annual */
  Enterprise_Annual:
    trim(process.env.STRIPE_INSTRUCTOR_TEAMS_ANNUAL_PRICE_ID) ||
    trim(process.env.STRIPE_INSTRUCTOR_ENTERPRISE_ANNUAL_PRICE_ID),
} as const

export const STRIPE_INSTRUCTOR_PRODUCT_IDS = {
  Pro: trim(process.env.STRIPE_INSTRUCTOR_PRO_PRODUCT_ID),
  Teams:
    trim(process.env.STRIPE_INSTRUCTOR_TEAMS_PRODUCT_ID) ||
    trim(process.env.STRIPE_INSTRUCTOR_ENTERPRISE_PRODUCT_ID),
  /** @deprecated alias — same product as Teams */
  Enterprise:
    trim(process.env.STRIPE_INSTRUCTOR_TEAMS_PRODUCT_ID) ||
    trim(process.env.STRIPE_INSTRUCTOR_ENTERPRISE_PRODUCT_ID),
} as const

/** Guest / Cora Career — lifetime unlock + credit packs */
export const STRIPE_GUEST_PRODUCTS = {
  CoraCareerEssentials: trim(process.env.STRIPE_GUEST_CORA_CAREER_ESSENTIALS_PRICE_ID),
  CoraCareerLifetime: trim(process.env.STRIPE_GUEST_CORA_CAREER_LIFETIME_PRICE_ID)
    || trim(process.env.STRIPE_GUEST_CORA_CAREER_PRICE_ID),
  CreditQuickBoost: trim(process.env.STRIPE_GUEST_CREDIT_QUICK_BOOST_PRICE_ID),
  CreditApplicationPack: trim(process.env.STRIPE_GUEST_CREDIT_APPLICATION_PACK_PRICE_ID),
  CreditCareerPack: trim(process.env.STRIPE_GUEST_CREDIT_CAREER_PACK_PRICE_ID),
  CreditPowerPack: trim(process.env.STRIPE_GUEST_CREDIT_POWER_PACK_PRICE_ID),
} as const

export const STRIPE_GUEST_PRODUCT_IDS = {
  CoraCareer: trim(process.env.STRIPE_GUEST_CORA_CAREER_PRODUCT_ID),
  CoraCredits: trim(process.env.STRIPE_GUEST_CORA_CREDITS_PRODUCT_ID),
} as const

export type InstructorStripePriceKey = keyof typeof STRIPE_INSTRUCTOR_PRODUCTS

/** Resolve Stripe price ID for instructor tier + billing cadence. Returns null for Free tier. */
export function resolveInstructorStripePriceId(
  tier: "Pro" | "Teams" | "Enterprise",
  cadence: "semester" | "annual",
): string | null {
  const canonical = tier === "Enterprise" ? "Teams" : tier
  const key = `${canonical}_${cadence === "semester" ? "Semester" : "Annual"}` as InstructorStripePriceKey
  const priceId = STRIPE_INSTRUCTOR_PRODUCTS[key]
  return priceId || null
}

// Avoid spamming dev server logs on every route that imports stripe; set DEBUG_STRIPE=1 to log once.
if (process.env.DEBUG_STRIPE === "1") {
  console.log("[Stripe] Configuration loaded:", {
    hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
    hasDonationProductId: !!process.env.STRIPE_DONATION_PRODUCT_ID,
    hasPrice5: !!process.env.STRIPE_DONATION_PRICE_5,
    hasPrice10: !!process.env.STRIPE_DONATION_PRICE_10,
    hasPrice25: !!process.env.STRIPE_DONATION_PRICE_25,
    hasPrice50: !!process.env.STRIPE_DONATION_PRICE_50,
    hasPrice100: !!process.env.STRIPE_DONATION_PRICE_100,
  })
}
