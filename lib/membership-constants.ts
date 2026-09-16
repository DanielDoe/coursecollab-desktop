export const DEV_MODE_UNRESTRICTED_ACCESS = false // Set to false to enforce tier restrictions

export type MembershipTier = "Scholar" | "Explorer" | "Trailblazer"
export type BillingCadence = "monthly" | "semester"

const TIER_ALIASES: Record<string, MembershipTier> = {
  scholar: "Scholar",
  explorer: "Explorer",
  trailblazer: "Trailblazer",
}

/** Normalize tier strings from DB/UI (trim, case-insensitive). Returns null if not a known tier. */
export function normalizeMembershipTier(raw: unknown): MembershipTier | null {
  if (raw == null) return null
  const key = String(raw).trim().toLowerCase()
  if (!key) return null
  return TIER_ALIASES[key] ?? null
}

// --- PVAMU academic calendar (recurring month/day; year from ACADEMIC_END_YEAR) ---
export type AcademicTerm = "spring" | "fall"

/** Grades due all students — May 12, 11:59 p.m. Central (CDT). Same calendar date every Spring. */
export const PVAMU_SPRING_GRADES_DUE = { month: 5, day: 12, offset: "-05:00" as const }

/** Fall 16-week session — Dec 25, 11:59 p.m. Central (CST). */
export const PVAMU_FALL_SEMESTER_START = { month: 8, day: 25, offset: "-05:00" as const }
export const PVAMU_FALL_SEMESTER_END = { month: 12, day: 25, offset: "-06:00" as const }

function readAcademicTermFromEnv(): AcademicTerm {
  const raw =
    (typeof process.env.NEXT_PUBLIC_ACADEMIC_TERM === "string" && process.env.NEXT_PUBLIC_ACADEMIC_TERM) ||
    (typeof process.env.ACADEMIC_TERM === "string" && process.env.ACADEMIC_TERM) ||
    "fall"
  const t = raw.trim().toLowerCase()
  return t === "fall" || t === "autumn" ? "fall" : "spring"
}

function readAcademicEndYearFromEnv(): number {
  const raw =
    (typeof process.env.NEXT_PUBLIC_ACADEMIC_END_YEAR === "string" &&
      process.env.NEXT_PUBLIC_ACADEMIC_END_YEAR) ||
    (typeof process.env.ACADEMIC_END_YEAR === "string" && process.env.ACADEMIC_END_YEAR) ||
    ""
  const y = parseInt(String(raw).trim(), 10)
  if (Number.isFinite(y) && y >= 2000 && y <= 2100) return y
  return new Date().getFullYear()
}

/** Active term for default semester anchor (when SEMESTER_END_DATE is unset). */
export function resolveAcademicTerm(): AcademicTerm {
  return readAcademicTermFromEnv()
}

/** Calendar year of the term’s end anchor (e.g. Spring 2027 → 2027; Fall 2026 → 2026). */
export function resolveAcademicEndYear(): number {
  return readAcademicEndYearFromEnv()
}

/** Months in the active semester window (Aug 25 – Dec 25 ≈ 4 billing months). */
export const MONTHS_IN_SEMESTER = 4

function anchorInstant(
  year: number,
  anchor: { month: number; day: number; offset: string },
  endOfDay: boolean,
): Date {
  const m = String(anchor.month).padStart(2, "0")
  const d = String(anchor.day).padStart(2, "0")
  const time = endOfDay ? "T23:59:59" : "T00:00:00"
  return new Date(`${year}-${m}-${d}${time}${anchor.offset}`)
}

/** Default semester end instant when SEMESTER_END_DATE env is not set. */
export function computeDefaultSemesterEndDate(): Date {
  const year = readAcademicEndYearFromEnv()
  const term = readAcademicTermFromEnv()
  if (term === "fall") {
    return anchorInstant(year, PVAMU_FALL_SEMESTER_END, true)
  }
  const m = String(PVAMU_SPRING_GRADES_DUE.month).padStart(2, "0")
  const d = String(PVAMU_SPRING_GRADES_DUE.day).padStart(2, "0")
  return new Date(`${year}-${m}-${d}T23:59:59${PVAMU_SPRING_GRADES_DUE.offset}`)
}

/** Default semester start for savings / copy when DB term is unavailable. */
export function computeDefaultSemesterStartDate(): Date {
  const year = readAcademicEndYearFromEnv()
  const term = readAcademicTermFromEnv()
  if (term === "fall") {
    return anchorInstant(year, PVAMU_FALL_SEMESTER_START, false)
  }
  return new Date(`${year}-01-13T00:00:00-06:00`)
}

// Semester timeline anchor: pricing copy, Extend cutoff, rollover policy. Full override: SEMESTER_END_DATE.
export const SEMESTER_END_DATE = process.env.SEMESTER_END_DATE
  ? new Date(process.env.SEMESTER_END_DATE)
  : computeDefaultSemesterEndDate()

// Weekly classroom/personal playground sessions — Scholar free allowance
export const PLAYGROUND_WEEKLY_CREDITS = 3
export const EXPLORER_PLAYGROUND_WEEKLY_CREDITS = 5

export interface MembershipFeatures {
  quizAttempts: number
  lectures: boolean
  leaderboard: boolean
  /** Monthly Cora Credits (membership bucket; does not roll over). */
  aiTutor: number
  /** Core CodeBench IDE, run/compile, challenges, Live Classroom, gamification. */
  codeBench: boolean
  /** Cora-powered CodeBench actions (explain, debug, improve, suggest fix, evaluate). */
  codeBenchCora: boolean
  earlyAccess: boolean
  playgroundCredits: number | "unlimited" // Number of credits per week or "unlimited"
  /** Past-deadline self-service rollover: false, or max applies per assessment + window length */
  assessmentRollover:
    | false
    | { maxAttemptsPerAssessment: number; windowHours: number }
  /** Explorer & Trailblazer: save quiz progress and resume later. Explorer: 3 in-progress max, Trailblazer: unlimited */
  saveAndFinishLater: number | "unlimited" | false
}

/** How a student received their current entitlement. Personal purchase is the default. */
export type MembershipEntitlementSource =
  | "personal_purchase"
  | "institution"
  | "college"
  | "department"
  | "grant"
  | "promotion"
  | "trial"
  | "admin_override"

/** Retired semester catalog amounts — honor existing paid terms; do not rewrite history. */
export const LEGACY_STUDENT_SEMESTER_PRICE_CENTS: Record<"Explorer" | "Trailblazer", number> = {
  Explorer: 2499,
  Trailblazer: 3999,
}

/** Pre-discount semester list prices shown as the slashed “was” amount. */
export const STUDENT_SEMESTER_LIST_PRICE_CENTS: Record<"Explorer" | "Trailblazer", number> = {
  Explorer: 2999,
  Trailblazer: 4999,
}

export const STUDENT_SEMESTER_DISCOUNT_CENTS = 1000

export function studentSemesterOffer(tier: MembershipTier): {
  saleCents: number
  listCents: number
  saveCents: number
} | null {
  if (tier !== "Explorer" && tier !== "Trailblazer") return null
  const listCents = STUDENT_SEMESTER_LIST_PRICE_CENTS[tier]
  const saleCents = listCents - STUDENT_SEMESTER_DISCOUNT_CENTS
  return { saleCents, listCents, saveCents: STUDENT_SEMESTER_DISCOUNT_CENTS }
}

export interface MembershipPlan {
  id: MembershipTier
  name: string
  displayName: string
  priceInCents: number
  description: string
  /** Short value proposition shown under the plan name. */
  subtitle: string
  ctaLabel: string
  popular?: boolean
  features: MembershipFeatures
  /** High-signal differentiators shown first on membership cards. */
  highlights: string[]
  /** Secondary benefits behind “See all features”. */
  secondaryBenefits: string[]
  badge: string
  color: string
  billingCadence?: BillingCadence
  semesterPriceInCents?: number
  monthlyPriceInCents?: number
}

export const MEMBERSHIP_PLANS: MembershipPlan[] = [
  {
    id: "Scholar",
    name: "Scholar",
    displayName: "Scholar (Free)",
    priceInCents: 0,
    description: "Code, practice, and participate — including CodeBench.",
    subtitle: "Code, practice and participate",
    ctaLabel: "Current plan",
    features: {
      quizAttempts: 1, // 1 attempt per quiz (no retakes) - allows first-time access
      lectures: true,
      leaderboard: false,
      aiTutor: 250, // Cora Credits / month (Lite after exhaustion; no agent workflows)
      codeBench: true,
      codeBenchCora: false,
      earlyAccess: false,
      playgroundCredits: PLAYGROUND_WEEKLY_CREDITS, // resets weekly
      assessmentRollover: false,
      saveAndFinishLater: false, // No access
    },
    highlights: [
      "CodeBench IDE + run/compile",
      "Course lectures & materials",
      "Standard assessments",
      "250 Cora Credits / month",
    ],
    secondaryBenefits: [
      "Daily Challenge, XP, streak & badges",
      "Live Classroom & Classroom Points coding",
      "Cora explanations & study help",
      "3 Playground credits / week",
      "Basic support",
    ],
    badge: "🟢",
    color: "gray",
  },
  {
    id: "Explorer",
    name: "Explorer",
    displayName: "Explorer",
    priceInCents: 599, // legacy monthly catalog (semester-only campuses do not sell this)
    monthlyPriceInCents: 599,
    semesterPriceInCents: 1999, // $19.99/semester after $10 student discount (was $29.99)
    description: "Learn with Cora — explanations, debugging help, and study tools. $10 off this semester.",
    subtitle: "Learn with Cora",
    ctaLabel: "Get Explorer for $19.99",
    features: {
      quizAttempts: 2, // 1 main attempt + 1 retake from membership perks
      lectures: true,
      leaderboard: true,
      aiTutor: 3000, // Cora Credits / month
      codeBench: true,
      codeBenchCora: true,
      earlyAccess: false,
      playgroundCredits: EXPLORER_PLAYGROUND_WEEKLY_CREDITS, // resets weekly
      assessmentRollover: { maxAttemptsPerAssessment: 1, windowHours: 24 },
      saveAndFinishLater: 3, // 3 in-progress assessments max
    },
    highlights: [
      "3,000 Cora Credits / month",
      "Cora in CodeBench (explain, debug, improve)",
      "Full Cora learning assistant",
      "Interactive problem walkthroughs",
    ],
    secondaryBenefits: [
      "Everything in Scholar, including CodeBench",
      "Cora CodeBench tools (uses Cora credits)",
      "Personalized study assistance",
      "Enhanced Practice Hub",
      "2 assessment attempts",
      "Save & Finish Later",
      "1 past-due rollover per assessment",
      "Leaderboard participation",
      "5 Playground credits / week",
      "Priority support",
    ],
    badge: "🔵",
    color: "blue",
  },
  {
    id: "Trailblazer",
    name: "Trailblazer",
    displayName: "Trailblazer",
    priceInCents: 999, // legacy monthly catalog
    monthlyPriceInCents: 999,
    semesterPriceInCents: 3999, // $39.99/semester after $10 student discount (was $49.99)
    description: "Use Cora more — highest existing Cora allowance, plus unlimited Playground. $10 off this semester.",
    subtitle: "Use Cora more",
    ctaLabel: "Get Trailblazer for $39.99",
    popular: true,
    features: {
      quizAttempts: 3,
      lectures: true,
      leaderboard: true,
      aiTutor: 7500, // Cora Credits / month (+ Cora Lite after exhaustion)
      codeBench: true,
      codeBenchCora: true,
      earlyAccess: true,
      playgroundCredits: "unlimited", // Unlimited playground access
      assessmentRollover: { maxAttemptsPerAssessment: 3, windowHours: 24 },
      saveAndFinishLater: "unlimited", // Unlimited in-progress assessments
    },
    highlights: [
      "7,500 Cora Credits / month",
      "Highest Cora allowance",
      "Full Agentic Cora",
      "Cora Lite after allowance",
    ],
    secondaryBenefits: [
      "Everything in Explorer (same Cora CodeBench tools)",
      "More Cora credits for the same Cora tools",
      "Course-context intelligence",
      "Cora-powered study planning",
      "Smart learning recommendations",
      "Achievement & mastery analytics",
      "3 assessment attempts",
      "3 past-due rollovers per assessment",
      "Unlimited Playground",
      "Early access to new features",
      "Priority support",
    ],
    badge: "🟣",
    color: "purple",
  },
]

/** Alias used by economy/config docs — same array, one source of truth. */
export const STUDENT_MEMBERSHIP_PLANS = MEMBERSHIP_PLANS

export function getStudentMembershipPlan(tier: MembershipTier): MembershipPlan {
  return MEMBERSHIP_PLANS.find((p) => p.id === tier) ?? MEMBERSHIP_PLANS[0]!
}
