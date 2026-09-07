/**
 * Institutional license catalog — single source of truth.
 * List prices are configurable metadata. Entitlements use plan IDs and feature bundles, never dollar amounts.
 */

export type InstitutionPlanKey =
  | "course_pilot"
  | "program"
  | "department"
  | "department_plus"
  | "college"
  | "college_plus"
  | "university_enterprise"

/** @deprecated Use university_enterprise. Stored/legacy plan_id alias. */
export type InstitutionPlanId = InstitutionPlanKey | "enterprise"

export type InstitutionBillingMode = "stripe" | "quote"
export type InstitutionBillingCadence = "annual"
export type InstitutionScopeType =
  | "course"
  | "program"
  | "department"
  | "college"
  | "institution"

export type InstitutionSupportLevel = "standard" | "priority" | "dedicated"
export type InstitutionOnboardingLevel = "standard" | "enhanced" | "priority" | "premium" | "custom"
export type InstitutionPricePresentation = "list" | "from_list" | "custom"

export type InstitutionFeatureFlag =
  | "institutional_cora"
  | "institutional_ai_grading"
  | "codebench"
  | "practice_hub"
  | "institutional_analytics"
  | "cross_course_analytics"
  | "department_analytics"
  | "institution_analytics"
  | "faculty_management"
  | "student_management"
  | "organization_management"
  | "shared_question_banks"
  | "shared_assessment_library"
  | "shared_cora_resources"
  | "ta_management"
  | "institutional_reports"
  | "accreditation_reports"
  | "sso"
  | "sis_integration"
  | "lms_integration"
  | "audit_logs"
  | "advanced_rbac"
  | "custom_branding"
  | "priority_support"
  | "dedicated_support"
  | "sla"

export type InstitutionOveragePolicy = {
  overageEnabled: boolean
  overagePriceCents: number | null
  overageUnit: "credit" | "credit_pack" | "annual_addon"
  hardLimit: boolean
  softLimit: boolean
  warningThresholds: readonly number[]
}

export interface InstitutionPlan {
  planKey: InstitutionPlanKey
  /** Same as planKey. Kept for existing callers. */
  id: InstitutionPlanKey
  displayName: string
  description: string
  /** Annual list price in integer cents. Null = custom quote. */
  annualListPriceCents: number | null
  /** @deprecated Use annualListPriceCents */
  annualPriceCents: number | null
  studentCapacity: number | "negotiated"
  /** @deprecated Use studentCapacity */
  studentCap: number | "negotiated"
  instructorCapacity: number | "unlimited"
  /** @deprecated Use instructorCapacity */
  instructorCap: number | "unlimited"
  institutionAdminCap: number | "unlimited"
  includedCoraCredits: number | "negotiated"
  billingCadence: InstitutionBillingCadence
  selfServiceEligible: boolean
  quoteOnly: boolean
  allowedScopeTypes: InstitutionScopeType[]
  featureBundle: InstitutionPlanKey
  featureFlags: InstitutionFeatureFlag[]
  supportLevel: InstitutionSupportLevel
  onboardingLevel: InstitutionOnboardingLevel
  overagePolicy: InstitutionOveragePolicy
  active: boolean
  displayOrder: number
  billingMode: InstitutionBillingMode
  analyticsLevel: "course" | "program" | "department" | "college" | "institution"
  pricePresentation: InstitutionPricePresentation
  recommended?: boolean
  recommendedBadge?: string
  ctaLabel: string
  ctaHref: string
  eligibleScopeTypes: InstitutionScopeType[]
  /** Customer-facing perks shown before the request form. */
  includedPerks: string[]
}

const CORE_TEACHING: InstitutionFeatureFlag[] = [
  "institutional_cora",
  "institutional_ai_grading",
  "codebench",
  "practice_hub",
  "faculty_management",
  "student_management",
  "shared_question_banks",
  "shared_assessment_library",
  "shared_cora_resources",
  "ta_management",
]

/** Conservative shared-pool starting allowances. Independent of list price; platform-admin configurable. */
export const DEFAULT_CORA_WARNING_THRESHOLDS = [70, 85, 95, 100] as const

function overagePolicy(): InstitutionOveragePolicy {
  return {
    overageEnabled: false,
    overagePriceCents: null,
    overageUnit: "credit",
    hardLimit: true,
    softLimit: false,
    warningThresholds: DEFAULT_CORA_WARNING_THRESHOLDS,
  }
}

const CORE_LICENSE_PERKS = [
  "Institution-sponsored student access",
  "Institution-sponsored faculty access",
  "Cora for covered courses",
  "Practice Hub",
  "CodeBench",
  "Playground",
  "Automated grading",
  "AI assessment authoring",
  "Student progress tools",
  "Course analytics",
  "Centralized institution administration",
  "12-month annual license",
]

export const INSTITUTION_PLAN_PERKS: Record<InstitutionPlanKey, string[]> = {
  course_pilot: [
    ...CORE_LICENSE_PERKS,
    "Full Course Collab teaching tools — not a crippled trial",
    "Up to 125 active students",
    "Up to 3 instructors",
    "Limited-course or limited-program deployment scope",
    "Institutional usage analytics",
    "Standard onboarding and support",
  ],
  program: [
    ...CORE_LICENSE_PERKS,
    "Up to 250 active students",
    "Unlimited instructors within licensed program/course scope",
    "Multiple covered courses",
    "Multiple sections",
    "Multi-section support",
    "Institutional usage analytics",
    "Priority onboarding and support",
  ],
  department: [
    ...CORE_LICENSE_PERKS,
    "Up to 500 active students",
    "Unlimited covered instructors",
    "Department-level scope across programs and courses",
    "Department analytics",
    "Shared resources and shared assessment libraries",
    "Department Cora resources",
    "Department administrator functionality",
    "Coordinated course management",
    "Expanded AI allowance",
    "Enhanced onboarding and support",
  ],
  department_plus: [
    ...CORE_LICENSE_PERKS,
    "Up to 1,000 active students",
    "Unlimited covered instructors",
    "Larger departmental or multi-program deployment",
    "Expanded institutional analytics",
    "Larger Cora allowance",
    "Advanced permissions",
    "Broader shared resources",
    "Enhanced support",
  ],
  college: [
    ...CORE_LICENSE_PERKS,
    "Up to 2,500 active students",
    "Unlimited covered instructors",
    "Multiple departments",
    "College-level administration",
    "Cross-department analytics",
    "Advanced institutional reporting",
    "Broader governance",
    "Expanded AI capacity",
    "Integration options",
    "Priority onboarding and support",
  ],
  college_plus: [
    ...CORE_LICENSE_PERKS,
    "Up to 5,000 active students",
    "Unlimited covered instructors",
    "College-wide administration",
    "Advanced analytics",
    "Institutional governance",
    "Large Cora allowance",
    "Integrations",
    "Audit capabilities",
    "Premium support",
  ],
  university_enterprise: [
    ...CORE_LICENSE_PERKS,
    "5,000+ active learners (negotiated)",
    "Unlimited covered instructors",
    "Campus-wide administration",
    "SSO, SIS, and LMS integration options",
    "Custom AI capacity",
    "SLA and dedicated support",
    "Security and compliance review",
    "Custom contract terms",
  ],
}

function plan(
  input: Omit<
    InstitutionPlan,
    "id" | "annualPriceCents" | "studentCap" | "instructorCap" | "eligibleScopeTypes" | "billingMode" | "includedPerks"
  >,
): InstitutionPlan {
  return {
    ...input,
    id: input.planKey,
    annualPriceCents: input.annualListPriceCents,
    studentCap: input.studentCapacity,
    instructorCap: input.instructorCapacity,
    eligibleScopeTypes: input.allowedScopeTypes,
    billingMode: input.quoteOnly || !input.selfServiceEligible ? "quote" : "stripe",
    includedPerks: INSTITUTION_PLAN_PERKS[input.planKey],
  }
}

export const INSTITUTION_PRICING_VERSION = 2
export const INSTITUTION_PRICING_EFFECTIVE_FROM = "2026-08-26"

export const INSTITUTION_PLANS: InstitutionPlan[] = [
  plan({
    planKey: "course_pilot",
    displayName: "Course Pilot",
    description:
      "Limited-scope paid institutional deployment (up to 125 active students and 3 instructors). Full Course Collab teaching tools — not a crippled trial.",
    annualListPriceCents: 950_000,
    studentCapacity: 125,
    instructorCapacity: 3,
    institutionAdminCap: 5,
    includedCoraCredits: 250_000,
    billingCadence: "annual",
    selfServiceEligible: true,
    quoteOnly: false,
    allowedScopeTypes: ["course", "program"],
    featureBundle: "course_pilot",
    featureFlags: [...CORE_TEACHING, "institutional_analytics"],
    supportLevel: "standard",
    onboardingLevel: "standard",
    overagePolicy: overagePolicy(),
    active: true,
    displayOrder: 1,
    analyticsLevel: "course",
    pricePresentation: "from_list",
    ctaLabel: "Start Institutional Pilot",
    ctaHref: "/institutions/request-demo",
  }),
  plan({
    planKey: "program",
    displayName: "Program",
    description:
      "Primary institutional package for a program or related courses: up to 250 active students, unlimited instructors within licensed scope, multi-section coverage, and institution administration.",
    annualListPriceCents: 1_850_000,
    studentCapacity: 250,
    instructorCapacity: "unlimited",
    institutionAdminCap: 10,
    includedCoraCredits: 500_000,
    billingCadence: "annual",
    selfServiceEligible: true,
    quoteOnly: false,
    allowedScopeTypes: ["course", "program"],
    featureBundle: "program",
    featureFlags: [...CORE_TEACHING, "institutional_analytics", "department_analytics", "priority_support"],
    supportLevel: "priority",
    onboardingLevel: "standard",
    overagePolicy: overagePolicy(),
    active: true,
    displayOrder: 2,
    analyticsLevel: "program",
    pricePresentation: "from_list",
    recommended: true,
    recommendedBadge: "Recommended for Academic Programs",
    ctaLabel: "Request Program License",
    ctaHref: "/institutions/request-quote",
  }),
  plan({
    planKey: "department",
    displayName: "Department",
    description:
      "Department-level coverage for up to 500 active students, unlimited covered instructors, shared resources, department analytics, and department administration.",
    annualListPriceCents: 2_950_000,
    studentCapacity: 500,
    instructorCapacity: "unlimited",
    institutionAdminCap: 25,
    includedCoraCredits: 875_000,
    billingCadence: "annual",
    selfServiceEligible: false,
    quoteOnly: false,
    allowedScopeTypes: ["department", "program", "course"],
    featureBundle: "department",
    featureFlags: [
      ...CORE_TEACHING,
      "institutional_analytics",
      "department_analytics",
      "cross_course_analytics",
      "organization_management",
      "institutional_reports",
      "audit_logs",
      "priority_support",
    ],
    supportLevel: "priority",
    onboardingLevel: "enhanced",
    overagePolicy: overagePolicy(),
    active: true,
    displayOrder: 3,
    analyticsLevel: "department",
    pricePresentation: "from_list",
    ctaLabel: "Request Department License",
    ctaHref: "/institutions/request-quote",
  }),
  plan({
    planKey: "department_plus",
    displayName: "Department Plus",
    description:
      "Larger departmental or multi-program deployment: up to 1,000 active students, expanded analytics, larger Cora allowance, and advanced permissions.",
    annualListPriceCents: 4_950_000,
    studentCapacity: 1_000,
    instructorCapacity: "unlimited",
    institutionAdminCap: 40,
    includedCoraCredits: 1_500_000,
    billingCadence: "annual",
    selfServiceEligible: false,
    quoteOnly: true,
    allowedScopeTypes: ["department", "program", "course"],
    featureBundle: "department_plus",
    featureFlags: [
      ...CORE_TEACHING,
      "institutional_analytics",
      "department_analytics",
      "cross_course_analytics",
      "organization_management",
      "institutional_reports",
      "audit_logs",
      "advanced_rbac",
      "priority_support",
    ],
    supportLevel: "priority",
    onboardingLevel: "enhanced",
    overagePolicy: overagePolicy(),
    active: true,
    displayOrder: 4,
    analyticsLevel: "department",
    pricePresentation: "custom",
    ctaLabel: "Request Quote",
    ctaHref: "/institutions/request-quote",
  }),
  plan({
    planKey: "college",
    displayName: "College",
    description:
      "College-level administration across departments: up to 2,500 active students, cross-department analytics, governance, and priority onboarding. Quote / procurement workflow.",
    annualListPriceCents: 8_950_000,
    studentCapacity: 2_500,
    instructorCapacity: "unlimited",
    institutionAdminCap: "unlimited",
    includedCoraCredits: 3_000_000,
    billingCadence: "annual",
    selfServiceEligible: false,
    quoteOnly: true,
    allowedScopeTypes: ["college", "department", "program", "course"],
    featureBundle: "college",
    featureFlags: [
      ...CORE_TEACHING,
      "institutional_analytics",
      "department_analytics",
      "cross_course_analytics",
      "institution_analytics",
      "organization_management",
      "institutional_reports",
      "accreditation_reports",
      "audit_logs",
      "advanced_rbac",
      "dedicated_support",
    ],
    supportLevel: "dedicated",
    onboardingLevel: "priority",
    overagePolicy: overagePolicy(),
    active: true,
    displayOrder: 5,
    analyticsLevel: "college",
    pricePresentation: "custom",
    ctaLabel: "Request Quote",
    ctaHref: "/institutions/request-quote",
  }),
  plan({
    planKey: "college_plus",
    displayName: "College Plus",
    description:
      "College-wide deployment for up to 5,000 active students with advanced analytics, institutional governance, audit capabilities, and premium support.",
    annualListPriceCents: 14_950_000,
    studentCapacity: 5_000,
    instructorCapacity: "unlimited",
    institutionAdminCap: "unlimited",
    includedCoraCredits: 5_000_000,
    billingCadence: "annual",
    selfServiceEligible: false,
    quoteOnly: true,
    allowedScopeTypes: ["college", "department", "program", "course"],
    featureBundle: "college_plus",
    featureFlags: [
      ...CORE_TEACHING,
      "institutional_analytics",
      "department_analytics",
      "cross_course_analytics",
      "institution_analytics",
      "organization_management",
      "institutional_reports",
      "accreditation_reports",
      "audit_logs",
      "advanced_rbac",
      "dedicated_support",
    ],
    supportLevel: "dedicated",
    onboardingLevel: "premium",
    overagePolicy: overagePolicy(),
    active: true,
    displayOrder: 6,
    analyticsLevel: "college",
    pricePresentation: "custom",
    ctaLabel: "Request Quote",
    ctaHref: "/institutions/request-quote",
  }),
  plan({
    planKey: "university_enterprise",
    displayName: "University Enterprise",
    description:
      "Custom campus-wide licensing for 5,000+ active learners. Pricing depends on AI usage, integrations, SSO/SIS/LMS, support, SLA, and contract terms.",
    annualListPriceCents: null,
    studentCapacity: "negotiated",
    instructorCapacity: "unlimited",
    institutionAdminCap: "unlimited",
    includedCoraCredits: "negotiated",
    billingCadence: "annual",
    selfServiceEligible: false,
    quoteOnly: true,
    allowedScopeTypes: ["institution", "college", "department", "program", "course"],
    featureBundle: "university_enterprise",
    featureFlags: [
      ...CORE_TEACHING,
      "institutional_analytics",
      "department_analytics",
      "cross_course_analytics",
      "institution_analytics",
      "organization_management",
      "institutional_reports",
      "accreditation_reports",
      "sso",
      "sis_integration",
      "lms_integration",
      "audit_logs",
      "advanced_rbac",
      "custom_branding",
      "dedicated_support",
      "sla",
    ],
    supportLevel: "dedicated",
    onboardingLevel: "custom",
    overagePolicy: overagePolicy(),
    active: true,
    displayOrder: 7,
    analyticsLevel: "institution",
    pricePresentation: "custom",
    ctaLabel: "Contact Enterprise Sales",
    ctaHref: "/institutions/request-quote",
  }),
]

const PLAN_ALIASES: Record<string, InstitutionPlanKey> = {
  enterprise: "university_enterprise",
  university_enterprise: "university_enterprise",
  course_pilot: "course_pilot",
  program: "program",
  department: "department",
  department_plus: "department_plus",
  college: "college",
  college_plus: "college_plus",
}

export function normalizeInstitutionPlanKey(id: string | null | undefined): InstitutionPlanKey | null {
  const key = String(id ?? "").trim().toLowerCase()
  return PLAN_ALIASES[key] ?? null
}

export function getInstitutionPlan(id: string | null | undefined): InstitutionPlan | null {
  const key = normalizeInstitutionPlanKey(id)
  if (!key) return null
  return INSTITUTION_PLANS.find((p) => p.planKey === key) ?? null
}

export function institutionPlanAllowsSelfService(id: string | null | undefined): boolean {
  return getInstitutionPlan(id)?.selfServiceEligible === true
}

export function institutionPlanHasFeature(
  planId: string | null | undefined,
  flag: InstitutionFeatureFlag,
): boolean {
  return getInstitutionPlan(planId)?.featureFlags.includes(flag) === true
}

/** Integer cents → display dollars. Never used for arithmetic on money. */
export function formatUsdFromCents(cents: number): string {
  const negative = cents < 0
  const abs = Math.abs(cents)
  const dollars = Math.trunc(abs / 100)
  const remainder = abs % 100
  const core =
    remainder === 0
      ? `$${dollars.toLocaleString("en-US")}`
      : `$${dollars.toLocaleString("en-US")}.${String(remainder).padStart(2, "0")}`
  return negative ? `-${core}` : core
}

export function publicInstitutionPriceLabel(plan: InstitutionPlan): string {
  if (plan.planKey === "university_enterprise" || plan.annualListPriceCents == null) {
    return "Custom"
  }
  if (plan.quoteOnly || plan.pricePresentation === "custom") {
    return "Contact us for a quote"
  }
  const amount = `${formatUsdFromCents(plan.annualListPriceCents)} / year`
  return plan.pricePresentation === "from_list" ? `Starting from ${amount}` : amount
}

export function publicInstructorCapacityLabel(plan: InstitutionPlan): string {
  if (plan.instructorCapacity === "unlimited") return "Unlimited instructors within licensed scope"
  return `Up to ${plan.instructorCapacity} instructors`
}

export function publicStudentCapacityLabel(plan: InstitutionPlan): string {
  if (plan.studentCapacity === "negotiated") return "5,000+ active students"
  return `Up to ${plan.studentCapacity.toLocaleString("en-US")} active students`
}

/** Catalog / landing CTA — perks first, then the request form. */
export function institutionPlanCtaHref(plan: InstitutionPlan): string {
  return `/institutions/${plan.planKey}`
}

export function institutionPlanRequestHref(plan: InstitutionPlan): string {
  const path = plan.ctaHref.split("?")[0]
  return `${path}?plan=${encodeURIComponent(plan.planKey)}`
}
