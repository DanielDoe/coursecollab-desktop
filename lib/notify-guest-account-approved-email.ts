/**
 * Email sent when an instructor or admin approves a pending platform-guest account request.
 */

import { sendEmail } from "@/lib/email/sendEmail"

const BASE = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "")

export async function notifyGuestAccountApproved(
  toEmail: string,
  fullName: string,
  purpose: "recommendation_letter" | "other",
): Promise<{ success: boolean; error?: string }> {
  const email = String(toEmail ?? "").trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.warn("[guest account approved email] invalid recipient")
    return { success: false, error: "invalid_email" }
  }

  const first = String(fullName ?? "").trim().split(/\s+/)[0] || "there"
  const loginPath = "/student/login/guest"
  const loginUrl = BASE ? `${BASE}${loginPath}` : loginPath

  const purposeLine =
    purpose === "recommendation_letter"
      ? "After you sign in, open Recommendations to start or continue your recommendation letter."
      : "After you sign in, follow the prompts for the access you requested."

  const message = `Hi ${first},

An instructor approved your CourseCollab Career Member account. Sign in with the same email and password you used when you applied.

${purposeLine}

If you did not request Career Member access, you can ignore this email.`

  return sendEmail("announcement", email, {
    title: "Your CourseCollab Career Member access was approved",
    message,
    link: loginUrl,
  })
}
