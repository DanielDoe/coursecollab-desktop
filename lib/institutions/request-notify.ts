import { sql } from "@/lib/db"
import { notifyAllAdmins } from "@/lib/create-admin-notification"
import { getBaseUrl } from "@/lib/get-base-url"
import { INSTITUTION_SALES_NOTIFY_EMAIL } from "@/components/landing/landing-contact"
import { getInstitutionPlan } from "@/lib/institution-plans"

export async function institutionRequestNotifyEmails(): Promise<string[]> {
  const emails = new Set<string>([INSTITUTION_SALES_NOTIFY_EMAIL.toLowerCase()])
  const admins = (await sql`
    SELECT email FROM admin_users
    WHERE email IS NOT NULL AND TRIM(email) != ''
  `) as { email: string }[]
  for (const row of admins) {
    const email = String(row.email).trim().toLowerCase()
    if (email.includes("@")) emails.add(email)
  }
  return [...emails]
}

function inboxUrl(): string {
  try {
    return `${getBaseUrl()}/admin/dashboard-v2/institutions`
  } catch {
    return "https://course-collab.com/admin/dashboard-v2/institutions"
  }
}

export async function notifyInstitutionAccessRequest(input: {
  requestId: number
  requestKind: string
  institutionName: string
  contactName: string
  contactEmail: string
  desiredPlan: string | null
  domain?: string | null
  jobTitle?: string | null
  department?: string | null
  phone?: string | null
  estimatedStudents?: number | null
  estimatedInstructors?: number | null
  desiredScope?: string | null
}): Promise<void> {
  const plan = getInstitutionPlan(input.desiredPlan)
  const kind = input.requestKind === "pilot" ? "pilot" : input.requestKind === "quote" ? "quote" : "demo"
  const title = `Institution ${kind} request: ${input.institutionName}`
  const lines = [
    `${input.contactName} (${input.contactEmail}) submitted an institutional ${kind} request.`,
    `Institution: ${input.institutionName}`,
    input.domain ? `Domain: ${input.domain}` : null,
    `Package: ${plan?.displayName ?? input.desiredPlan ?? "not specified"}`,
    input.jobTitle ? `Title: ${input.jobTitle}` : null,
    input.department ? `Department: ${input.department}` : null,
    input.phone ? `Phone: ${input.phone}` : null,
    input.estimatedStudents != null ? `Estimated students: ${input.estimatedStudents}` : null,
    input.estimatedInstructors != null ? `Estimated instructors: ${input.estimatedInstructors}` : null,
    input.desiredScope ? `Scope: ${input.desiredScope}` : null,
    `Request id: ${input.requestId}`,
  ].filter(Boolean) as string[]
  const message = lines.join("\n")
  const link = inboxUrl()

  await notifyAllAdmins({
    type: "institution_request",
    title,
    message: `${input.contactName} · ${input.contactEmail} · ${plan?.displayName ?? kind}`,
    link,
  })

  const { sendEmail } = await import("@/lib/email/sendEmail")
  const recipients = await institutionRequestNotifyEmails()
  await Promise.allSettled(
    recipients.map((to) =>
      sendEmail("announcement", to, {
        title,
        message,
        link,
      }),
    ),
  )
}
