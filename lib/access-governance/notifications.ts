import { sendEmail } from "@/lib/email/sendEmail"
import type { AccessAccountType } from "@/lib/access-governance/types"

const BASE = (process.env.NEXT_PUBLIC_BASE_URL || "https://course-collab.com").replace(/\/$/, "")

function loginPathForAccountType(accountType: AccessAccountType): string {
  switch (accountType) {
    case "faculty":
      return "/faculty/login"
    case "career_member":
      return "/student/login/guest"
    case "summer_student":
      return "/student/login/summer-camp"
    default:
      return "/student/login"
  }
}

export async function notifyAccessRequestApproved(input: {
  toEmail: string
  fullName: string
  accountType: AccessAccountType
  message?: string
}): Promise<void> {
  const email = String(input.toEmail ?? "").trim().toLowerCase()
  if (!email.includes("@")) return

  const first = String(input.fullName ?? "").trim().split(/\s+/)[0] || "there"
  const loginPath = loginPathForAccountType(input.accountType)
  const loginUrl = BASE ? `${BASE}${loginPath}` : loginPath

  const defaultMessage =
    input.accountType === "faculty"
      ? "An administrator approved your faculty account. Sign in with the credentials you registered."
      : input.accountType === "career_member"
        ? "Your Career Member access was approved. Sign in with the email and password you used when applying."
        : input.accountType === "summer_student"
          ? "Your summer program access was approved. Sign in with the email and password you registered."
          : "Your student account was approved. Sign in with your Student ID and the default password from your instructor."

  try {
    await sendEmail("announcement", email, {
      title: "Your CourseCollab access was approved",
      message: `Hi ${first},\n\n${input.message ?? defaultMessage}`,
      link: loginUrl,
    })
  } catch (e) {
    console.warn("[access-governance] approve notification failed:", e)
  }
}

export async function notifyAccessRequestRejected(input: {
  toEmail: string
  fullName: string
  accountType: AccessAccountType
  reason?: string | null
}): Promise<void> {
  const email = String(input.toEmail ?? "").trim().toLowerCase()
  if (!email.includes("@")) return

  const first = String(input.fullName ?? "").trim().split(/\s+/)[0] || "there"
  const reasonLine = input.reason?.trim()
    ? `\n\nReason: ${input.reason.trim()}`
    : ""

  try {
    await sendEmail("announcement", email, {
      title: "Your CourseCollab access request was not approved",
      message: `Hi ${first},\n\nYour access request was reviewed and not approved at this time.${reasonLine}\n\nContact your instructor or administrator if you believe this was a mistake.`,
    })
  } catch (e) {
    console.warn("[access-governance] reject notification failed:", e)
  }
}
