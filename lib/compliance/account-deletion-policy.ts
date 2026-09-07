/**
 * Explicit deletion policy for an educational platform.
 * Academic records are not cascade-deleted.
 */

export const ACCOUNT_DELETION_POLICY = {
  summary:
    "Personal profile data is anonymized or deleted. Institutional academic records and financial records are retained without the user's reusable identity.",
  deleted: [
    "Password and MFA credentials",
    "Active sessions and refresh tokens (all devices)",
    "Expo push notification tokens",
    "Cora conversation text and personal learning memory the account owns",
    "Guest career profile fields that are not academic records",
  ],
  anonymized: [
    "Name",
    "Email",
    "Login username where applicable",
    "Student-facing profile fields",
  ],
  retainedInstitutional: [
    "Quiz, homework, and exam attempts",
    "Grades and released results",
    "Attendance and classroom-point ledgers",
    "Assignment and project submissions already associated with a course",
    "Faculty-owned course materials, question banks, and announcements",
  ],
  retainedFinancial: [
    "Stripe customer and subscription references",
    "Paid membership and credit-pack fulfillment rows needed for receipts, refunds, and tax records",
  ],
} as const

export type AccountKind = "student" | "guest" | "instructor"

export type AccountDeletionResult = {
  ok: true
  accountKind: AccountKind
  accountId: number
  deleted: string[]
  anonymized: string[]
  retained: string[]
}

export type AccountDeletionFailure = {
  ok: false
  error: string
  status: number
}
