/**
 * Internal privacy inventory derived from actual CourseCollab behavior.
 * Used for Apple App Privacy answers and public policy pages.
 * Do not list categories the product does not collect.
 */

export type PrivacyAccessRole =
  | "account_holder"
  | "course_instructor"
  | "teaching_assistant"
  | "platform_admin"
  | "payment_processor"
  | "ai_provider"
  | "email_provider"
  | "hosting_provider"

export type PrivacyRetention =
  | "account_lifetime"
  | "until_user_deletes"
  | "institutional_academic_record"
  | "financial_legal"
  | "session_or_device"
  | "provider_default"

export type PrivacyCategory = {
  id: string
  appleType: string
  label: string
  collected: string
  purpose: string
  stored: string
  retention: PrivacyRetention
  accessors: PrivacyAccessRole[]
  thirdParties: string[]
  linkedToIdentity: boolean
  userDeletable: "yes" | "anonymized" | "retained_institutional" | "retained_financial"
}

export const PRIVACY_INVENTORY: PrivacyCategory[] = [
  {
    id: "name",
    appleType: "Name",
    label: "Name",
    collected: "Full name on student, faculty, guest, and admin profiles.",
    purpose: "Account identification, course rosters, certificates, and support.",
    stored: "Neon Postgres (students, instructors, admin_users).",
    retention: "account_lifetime",
    accessors: ["account_holder", "course_instructor", "teaching_assistant", "platform_admin"],
    thirdParties: [],
    linkedToIdentity: true,
    userDeletable: "anonymized",
  },
  {
    id: "email",
    appleType: "Email Address",
    label: "Email address",
    collected: "Login email and notification address.",
    purpose: "Authentication, password reset, course email, and receipts.",
    stored: "Neon Postgres; also sent through Brevo/SMTP when emailing.",
    retention: "account_lifetime",
    accessors: ["account_holder", "course_instructor", "platform_admin", "email_provider"],
    thirdParties: ["Brevo or configured SMTP"],
    linkedToIdentity: true,
    userDeletable: "anonymized",
  },
  {
    id: "student_id",
    appleType: "User ID",
    label: "Student / university identifiers",
    collected: "Roster student_id, university affiliation, section, course enrollment.",
    purpose: "Enrollment matching, gradebook, institutional course operations.",
    stored: "Neon Postgres.",
    retention: "institutional_academic_record",
    accessors: ["account_holder", "course_instructor", "teaching_assistant", "platform_admin"],
    thirdParties: [],
    linkedToIdentity: true,
    userDeletable: "retained_institutional",
  },
  {
    id: "credentials",
    appleType: "Other User Content",
    label: "Authentication credentials",
    collected: "Password hashes (students/guests/admins); faculty password field; optional MFA secrets; session identifiers.",
    purpose: "Sign-in and account security.",
    stored: "Neon Postgres. Passwords are not returned to clients.",
    retention: "account_lifetime",
    accessors: ["platform_admin"],
    thirdParties: [],
    linkedToIdentity: true,
    userDeletable: "yes",
  },
  {
    id: "academic_work",
    appleType: "Other User Content",
    label: "Assignments, quizzes, submissions, grades, attendance",
    collected: "Quiz/homework/exam attempts, answers, scores, attendance, classroom points, project submissions.",
    purpose: "Instruction, grading, and academic records.",
    stored: "Neon Postgres; files in Vercel Blob when uploaded.",
    retention: "institutional_academic_record",
    accessors: ["account_holder", "course_instructor", "teaching_assistant", "platform_admin"],
    thirdParties: [],
    linkedToIdentity: true,
    userDeletable: "retained_institutional",
  },
  {
    id: "uploads",
    appleType: "Photos or Videos",
    label: "Uploaded documents and media",
    collected: "Lecture PDFs, résumés, project files, profile or coursework images when the user uploads them.",
    purpose: "Course materials, career tools, and assignment workflows.",
    stored: "Vercel Blob with application access checks.",
    retention: "until_user_deletes",
    accessors: ["account_holder", "course_instructor", "platform_admin", "hosting_provider"],
    thirdParties: ["Vercel Blob"],
    linkedToIdentity: true,
    userDeletable: "anonymized",
  },
  {
    id: "cora",
    appleType: "Other User Content",
    label: "Cora prompts, conversations, and usage",
    collected:
      "User messages, Cora replies, server-synced privacy toggles (personalization, learning context, instructor share), credit ledger, and device-local teaching memory when enabled.",
    purpose: "Tutoring, faculty copilot, career assistance, and credit accounting with data minimization before external AI calls.",
    stored:
      "Neon Postgres for conversations and server privacy settings; browser/app storage for local teaching memory; minimized prompts sent to configured AI providers.",
    retention: "until_user_deletes",
    accessors: ["account_holder", "platform_admin", "ai_provider"],
    thirdParties: ["OpenAI and/or Anthropic when Cora runs"],
    linkedToIdentity: true,
    userDeletable: "yes",
  },
  {
    id: "push",
    appleType: "Device ID",
    label: "Push notification tokens",
    collected: "Expo push tokens and coarse platform/device labels when the user enables notifications.",
    purpose: "Deliver opted-in course and account notifications.",
    stored: "Neon Postgres expo_push_tokens.",
    retention: "session_or_device",
    accessors: ["account_holder", "platform_admin"],
    thirdParties: ["Expo push service"],
    linkedToIdentity: true,
    userDeletable: "yes",
  },
  {
    id: "subscription",
    appleType: "Purchase History",
    label: "Membership and credit purchases",
    collected: "Stripe customer/subscription/session IDs, plan tier, credit pack fulfillments. Card numbers are not stored.",
    purpose: "Paid memberships, Cora credit packs, receipts, and entitlement checks.",
    stored: "Neon Postgres membership/credit tables; Stripe retains payment records.",
    retention: "financial_legal",
    accessors: ["account_holder", "platform_admin", "payment_processor"],
    thirdParties: ["Stripe"],
    linkedToIdentity: true,
    userDeletable: "retained_financial",
  },
  {
    id: "usage",
    appleType: "Product Interaction",
    label: "Usage activity",
    collected: "Login events, lecture progress, Cora credit usage, selected platform activity logs.",
    purpose: "Product operation, support, and instructor teaching insights.",
    stored: "Neon Postgres.",
    retention: "account_lifetime",
    accessors: ["account_holder", "course_instructor", "platform_admin"],
    thirdParties: [],
    linkedToIdentity: true,
    userDeletable: "anonymized",
  },
  {
    id: "diagnostics",
    appleType: "Crash Data",
    label: "Diagnostics",
    collected: "Server error logs and optional Vercel analytics if enabled. No dedicated mobile crash SDK is configured in this repository.",
    purpose: "Reliability and incident response.",
    stored: "Vercel/runtime logs.",
    retention: "provider_default",
    accessors: ["platform_admin", "hosting_provider"],
    thirdParties: ["Vercel"],
    linkedToIdentity: false,
    userDeletable: "retained_institutional",
  },
]

export const PRIVACY_TRACKING = false

export const PRIVACY_NOT_COLLECTED = [
  "Precise location is not requested by the CourseCollab backend.",
  "Raw payment card numbers are not stored; Stripe handles card data.",
  "Advertising identifiers are not used for third-party ads in this codebase.",
  "Health, fitness, browsing history, and contacts are not collected.",
]

export function privacyCategoriesForApple(): PrivacyCategory[] {
  return PRIVACY_INVENTORY.filter((item) => item.linkedToIdentity || item.id === "diagnostics")
}
