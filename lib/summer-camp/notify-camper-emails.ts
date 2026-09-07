import { sendEmail } from "@/lib/email/sendEmail"
import { getBaseUrl } from "@/lib/get-base-url"

const BASE = getBaseUrl()

export async function notifyCamperAccountRequested(params: {
  adminEmail: string
  camperName: string
  camperEmail: string
  school: string
}): Promise<{ success: boolean; error?: string }> {
  const adminUrl = `${BASE}/admin/dashboard-v2/campers?tab=requests`
  const message = `A new Summer Camp account has been requested.

Name: ${params.camperName}
Email: ${params.camperEmail}
School: ${params.school}

Review and approve or reject in the Campers admin area.`

  return sendEmail("announcement", params.adminEmail, {
    title: "New Summer Camper account request",
    message,
    link: adminUrl,
  })
}

export async function notifyCamperPasswordResetRequested(params: {
  adminEmail: string
  camperName: string
  camperEmail: string
}): Promise<{ success: boolean; error?: string }> {
  const adminUrl = `${BASE}/admin/dashboard-v2/campers?tab=requests`
  const message = `A summer camp student requested a password reset.

Name: ${params.camperName}
Email: ${params.camperEmail}

Review and approve the new password in the Campers admin Requests tab.`

  return sendEmail("announcement", params.adminEmail, {
    title: "Summer Camp password reset request",
    message,
    link: adminUrl,
  })
}

export async function notifyCamperPasswordResetApproved(
  toEmail: string,
  fullName: string,
): Promise<{ success: boolean; error?: string }> {
  const email = String(toEmail ?? "").trim().toLowerCase()
  if (!email.includes("@")) return { success: false, error: "invalid_email" }

  const first = String(fullName ?? "").trim().split(/\s+/)[0] || "there"
  const loginUrl = `${BASE}/student/login/summer-camp`

  const message = `Hi ${first},

Your Summer Camp password reset on CourseCollab was approved. Sign in with your email and the new password you submitted.

If you did not request this change, contact your camp administrator immediately.`

  return sendEmail("announcement", email, {
    title: "Your Summer Camp password was reset",
    message,
    link: loginUrl,
  })
}

export async function notifyCamperAccountApproved(
  toEmail: string,
  fullName: string,
): Promise<{ success: boolean; error?: string }> {
  const email = String(toEmail ?? "").trim().toLowerCase()
  if (!email.includes("@")) return { success: false, error: "invalid_email" }

  const first = String(fullName ?? "").trim().split(/\s+/)[0] || "there"
  const loginUrl = `${BASE}/student/login/summer-camp`

  const message = `Hi ${first},

Your Summer Camp account on CourseCollab has been approved. Sign in with the email and password you used when you registered.

After signing in, enroll in your training track from your camp dashboard.

If you did not request this account, you can ignore this email.`

  return sendEmail("announcement", email, {
    title: "Your Summer Camp account was approved",
    message,
    link: loginUrl,
  })
}
