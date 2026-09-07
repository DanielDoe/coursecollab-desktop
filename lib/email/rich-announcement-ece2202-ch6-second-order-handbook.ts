/**
 * Rich HTML email — ECE 2202 Ch. 6 Second-Order Circuit Comprehensive Handbook.
 */
import { escapeHtmlForEmail } from "@/lib/email/emailTemplates"
import { ECE2202_CH6_SECOND_ORDER_HANDBOOK_TITLE } from "@/lib/announcements/ece2202-ch6-second-order-handbook-upload"

export const ECE2202_CH6_SECOND_ORDER_HANDBOOK_EMAIL_SUBJECT =
  "ECE 2202 — Download & review the Ch. 6 Second-Order Circuit Handbook"

export type Ece2202Ch6SecondOrderHandbookEmailOpts = {
  studentFirstName: string
  loginUrl: string
  announcementsUrl: string
  instructorName?: string
  instructorEmail?: string
}

export function buildEce2202Ch6SecondOrderHandbookEmailHtml(
  opts: Ece2202Ch6SecondOrderHandbookEmailOpts,
): string {
  const name = escapeHtmlForEmail(opts.studentFirstName || "there")
  const loginUrl = escapeHtmlForEmail(opts.loginUrl)
  const announcementsUrl = escapeHtmlForEmail(opts.announcementsUrl)
  const instructorEmail = escapeHtmlForEmail(opts.instructorEmail ?? "dmdoe@pvamu.edu")

  const p = (text: string) =>
    `<p style="margin:0 0 14px;color:#334155;font-size:16px;line-height:1.65;">${text}</p>`
  const li = (text: string) =>
    `<li style="margin:0 0 10px;color:#334155;font-size:15px;line-height:1.6;">${text}</li>`

  return `
${p(`Hi <strong>${name}</strong>,`)}

${p(
  `Your <strong>Chapter 6 Second-Order Circuit Comprehensive Handbook</strong> is now posted on CourseCollab. Please <strong>download and review</strong> it this week as we work through RLC transients and switching circuits.`,
)}

${p(`This handbook walks you through the complete framework:`)}

<ul style="margin:0 0 18px 22px;padding:0;">
${li(`Second-order ODE form and characteristic equation`)}
${li(`Damping coefficient $\alpha$ and natural frequency $\omega_0$`)}
${li(`Overdamped, critically damped, and underdamped responses`)}
${li(`Initial conditions and the seven-step solution procedure`)}
${li(`A color-coded quick-reference summary table`)}
</ul>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border-collapse:collapse;">
  <tr>
    <td style="background:linear-gradient(135deg,#fef2f2 0%,#fee2e2 100%);border-radius:14px;padding:18px 22px;border:1px solid #fca5a5;">
      <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#b91c1c;text-transform:uppercase;letter-spacing:0.04em;">Download the handbook</p>
      <p style="margin:0;font-size:15px;line-height:1.6;">
        <a href="${announcementsUrl}" style="color:#b91c1c;font-weight:700;text-decoration:none;">Open Announcements → download the PDF</a>
      </p>
      <p style="margin:10px 0 0;font-size:14px;color:#475569;line-height:1.5;">The PDF is attached to the course announcement titled &ldquo;${escapeHtmlForEmail(ECE2202_CH6_SECOND_ORDER_HANDBOOK_TITLE)}&rdquo;.</p>
    </td>
  </tr>
</table>

${p(`Sign in: <a href="${loginUrl}" style="color:#2563eb;font-weight:600;">${loginUrl}</a>`)}

${p(`Questions? Email <a href="mailto:${instructorEmail}" style="color:#2563eb;">${instructorEmail}</a> or reply on the announcement.`)}
`.trim()
}
