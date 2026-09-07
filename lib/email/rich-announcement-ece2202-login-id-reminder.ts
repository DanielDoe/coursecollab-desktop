import { escapeHtmlForEmail } from "@/lib/email/emailTemplates"

export type Ece2202LoginIdReminderOpts = {
  studentFirstName: string
  rosterStudentId: string
  loginUrl: string
  changePasswordUrl: string
  instructorName?: string
  instructorEmail?: string
}

export const ECE2202_LOGIN_ID_REMINDER_SUBJECT =
  "ECE 2202 — Your CourseCollab login ID (duplicate accounts removed)"

export function buildEce2202LoginIdReminderHtml(opts: Ece2202LoginIdReminderOpts): string {
  const name = escapeHtmlForEmail(opts.studentFirstName || "there")
  const rosterId = escapeHtmlForEmail(opts.rosterStudentId)
  const loginUrl = escapeHtmlForEmail(opts.loginUrl)
  const changePasswordUrl = escapeHtmlForEmail(opts.changePasswordUrl)
  const instructorName = escapeHtmlForEmail(opts.instructorName ?? "Daniel Doe")
  const instructorEmail = escapeHtmlForEmail(opts.instructorEmail ?? "dmdoe@CougarNet.UH.EDU")

  const p = (text: string) =>
    `<p style="margin:0 0 14px;color:#334155;font-size:16px;line-height:1.65;">${text}</p>`

  return `
${p(`Hi <strong>${name}</strong>,`)}

${p(
  `We found duplicate CourseCollab accounts under your name that were created with test IDs (for example <strong>123</strong> or <strong>1234567890</strong>). Those extra accounts have been <strong>removed</strong> so your grades and attempts stay on one profile.`,
)}

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border-collapse:collapse;">
  <tr>
    <td style="background:#eef2ff;border-radius:14px;padding:18px 22px;border:1px solid #c7d2fe;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#3730a3;text-transform:uppercase;letter-spacing:0.04em;">Your correct login</p>
      <p style="margin:0;color:#1e293b;font-size:17px;line-height:1.5;"><strong>Student ID:</strong> ${rosterId}</p>
      <p style="margin:10px 0 0;color:#475569;font-size:15px;line-height:1.5;">Course: <strong>ECE 2202</strong> · Section: <strong>ECE2202</strong></p>
    </td>
  </tr>
</table>

${p(
  `Sign in at <a href="${loginUrl}" style="color:#4f46e5;font-weight:600;">${loginUrl}</a> using <strong>only</strong> Student ID <strong>${rosterId}</strong>. Do not create a new account with a different ID.`,
)}

${p(
  `If you forgot your password, use <a href="${changePasswordUrl}" style="color:#4f46e5;font-weight:600;">Change Password</a> on the login page or contact your instructor.`,
)}

${p(`Questions? Reply to this email or contact ${instructorName} at <a href="mailto:${instructorEmail}" style="color:#4f46e5;">${instructorEmail}</a>.`)}

${p("— CourseCollab / ECE 2202")}
`.trim()
}
