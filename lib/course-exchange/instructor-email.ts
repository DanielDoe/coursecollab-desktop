import { sql } from "@/lib/db"
import { sendEmail } from "@/lib/email/sendEmail"
import { escapeHtmlForEmail } from "@/lib/email/emailTemplates"
import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"

const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "")

function exchangeReviewUrl(requestId: number, tab: "received" | "sent" = "received"): string {
  const path = `${FACULTY_DASHBOARD_BASE}/course/exchange?tab=${tab}&request=${requestId}`
  return BASE_URL ? `${BASE_URL}${path}` : path
}

/** Email a faculty member about a Course Exchange event (owner or requester). */
export async function sendCourseExchangeFacultyAlertEmail(input: {
  instructorId: number
  title: string
  bodyHtml: string
  requestId: number
  tab?: "received" | "sent"
  linkLabel?: string
  footerNote?: string
}): Promise<{ sent: boolean; skipReason?: string }> {
  const rows = (await sql`
    SELECT email FROM instructors WHERE id = ${input.instructorId} LIMIT 1
  `) as { email: string | null }[]
  const email = String(rows[0]?.email ?? "").trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.warn("[course exchange email] Skipped: no valid email for instructor", input.instructorId)
    return { sent: false, skipReason: "no_instructor_email" }
  }

  const tab = input.tab ?? "received"
  const result = await sendEmail("course_exchange_faculty_alert", email, {
    title: input.title,
    bodyHtml: input.bodyHtml,
    linkLabel: input.linkLabel ?? "Open Course Exchange",
    linkUrl: exchangeReviewUrl(input.requestId, tab),
    footerNote: input.footerNote,
  })

  if (!result.success) {
    console.warn("[course exchange email] Send failed:", result.error)
    return { sent: false, skipReason: result.error }
  }
  return { sent: true }
}

/** @deprecated Use sendCourseExchangeFacultyAlertEmail */
export const sendCourseExchangeInstructorAlertEmail = sendCourseExchangeFacultyAlertEmail

export function courseExchangeRequestReceivedBodyHtml(input: {
  requesterName: string
  sourceCourseCode: string
}): string {
  return `<p style="margin:0 0 12px;color:#475569;font-size:15px;line-height:1.65;"><strong>${escapeHtmlForEmail(input.requesterName)}</strong> requested materials from <strong>${escapeHtmlForEmail(input.sourceCourseCode)}</strong>. Review the request and choose what may be shared.</p>`
}

export function courseExchangeSupplementBodyHtml(input: {
  requesterName: string
  sourceCourseCode: string
  modules: string[]
}): string {
  const moduleList =
    input.modules.length > 0
      ? input.modules.map((m) => escapeHtmlForEmail(m)).join(", ")
      : "additional modules"
  return `<p style="margin:0 0 12px;color:#475569;font-size:15px;line-height:1.65;"><strong>${escapeHtmlForEmail(input.requesterName)}</strong> asked to add <strong>${moduleList}</strong> from <strong>${escapeHtmlForEmail(input.sourceCourseCode)}</strong>. Review and approve what may be shared.</p>`
}

export function courseExchangeApprovedBodyHtml(input: {
  sourceCourseCode: string
  ownerName: string
  imported: boolean
}): string {
  if (input.imported) {
    return `<p style="margin:0 0 12px;color:#475569;font-size:15px;line-height:1.65;"><strong>${escapeHtmlForEmail(input.ownerName)}</strong> approved your Course Exchange request for <strong>${escapeHtmlForEmail(input.sourceCourseCode)}</strong>. The selected materials were copied into your course.</p><p style="margin:0;color:#475569;font-size:15px;line-height:1.65;">Review dates, publish settings, and student visibility before going live.</p>`
  }
  return `<p style="margin:0 0 12px;color:#475569;font-size:15px;line-height:1.65;"><strong>${escapeHtmlForEmail(input.ownerName)}</strong> approved your Course Exchange request for <strong>${escapeHtmlForEmail(input.sourceCourseCode)}</strong>.</p><p style="margin:0;color:#475569;font-size:15px;line-height:1.65;">Open Course Exchange → Requests Sent and tap <strong>Import</strong> to copy the approved materials into your course.</p>`
}
