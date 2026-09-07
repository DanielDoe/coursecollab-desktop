import { sendEmail } from "./sendEmail"
import { isValidStudentEmail } from "./send-notification-email"

const DEFAULT_TEMP_PASSWORD = "ELEG2026!"

/**
 * Email the student after an instructor/admin sets their password to the default temporary password.
 * Skips send if email is missing or placeholder; API routes should still succeed.
 */
export async function notifyStudentStaffPasswordReset(params: {
  email: string | null | undefined
  fullName: string | null | undefined
  temporaryPassword?: string
}): Promise<{ sent: boolean; skippedReason?: string; error?: string }> {
  const { email, fullName, temporaryPassword = DEFAULT_TEMP_PASSWORD } = params
  if (!isValidStudentEmail(email)) {
    return { sent: false, skippedReason: "invalid_or_missing_email" }
  }
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "https://course-collab.com").replace(
    /\/$/,
    "",
  )
  const loginUrl = `${base}/student/login`
  const result = await sendEmail("student_password_reset_by_staff", email!.trim(), {
    name: (fullName && String(fullName).trim()) || "Student",
    temporaryPassword,
    loginUrl,
  })
  if (result.success) return { sent: true }
  return { sent: false, error: result.error }
}
