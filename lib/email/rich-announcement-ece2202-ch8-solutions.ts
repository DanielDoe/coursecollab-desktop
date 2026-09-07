/**
 * Rich HTML email — ECE 2202 Lecture 8 Ch. 8 Classroom Points solutions handout.
 */
import { escapeHtmlForEmail } from "@/lib/email/emailTemplates"
import { ECE2202_CH8_SOLUTIONS_UPLOAD_TITLE } from "@/lib/announcements/ece2202-ch8-solutions-upload"

export const ECE2202_CH8_SOLUTIONS_EMAIL_SUBJECT = ECE2202_CH8_SOLUTIONS_UPLOAD_TITLE

export type Ece2202Ch8SolutionsEmailOpts = {
  studentFirstName: string
  loginUrl: string
  announcementsUrl: string
  classroomPointsUrl: string
  instructorName?: string
  instructorEmail?: string
}

export function buildEce2202Ch8SolutionsEmailHtml(opts: Ece2202Ch8SolutionsEmailOpts): string {
  const name = escapeHtmlForEmail(opts.studentFirstName || "there")
  const loginUrl = escapeHtmlForEmail(opts.loginUrl)
  const announcementsUrl = escapeHtmlForEmail(opts.announcementsUrl)
  const classroomPointsUrl = escapeHtmlForEmail(opts.classroomPointsUrl)
  const instructorEmail = escapeHtmlForEmail(opts.instructorEmail ?? "dmdoe@pvamu.edu")

  const p = (text: string) =>
    `<p style="margin:0 0 14px;color:#334155;font-size:16px;line-height:1.65;">${text}</p>`
  const li = (text: string) =>
    `<li style="margin:0 0 10px;color:#334155;font-size:15px;line-height:1.6;">${text}</li>`

  return `
${p(`Hi <strong>${name}</strong>,`)}

${p(
  `Worked solutions for our <strong>Lecture 8 Chapter 8 Classroom Points</strong> exercises (AC power, complex power, power factor, and maximum power transfer) are now posted on CourseCollab.`,
)}

${p(`The handout includes step-by-step solutions for problems <strong>8.19, 8.20, 8.22, 8.24, 8.27, 8.32, 8.36, 8.47, 8.50, 8.51, 8.53,</strong> and <strong>8.55</strong>.`)}

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border-collapse:collapse;">
  <tr>
    <td style="background:linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%);border-radius:14px;padding:18px 22px;border:1px solid #93c5fd;">
      <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:0.04em;">PDF on CourseCollab</p>
      <p style="margin:0;font-size:15px;line-height:1.6;">
        <a href="${announcementsUrl}" style="color:#1d4ed8;font-weight:700;text-decoration:none;">Open Announcements → download the solution PDF</a>
      </p>
      <p style="margin:10px 0 0;font-size:14px;color:#475569;line-height:1.5;">The PDF is attached to the course announcement — please refer to that post for the full handout.</p>
    </td>
  </tr>
</table>

${p(`Submit your own work in <a href="${classroomPointsUrl}" style="color:#2563eb;font-weight:600;">Classroom Points</a> (deadline <strong>Wednesday, July 30, 2026, 11:59 PM CT</strong>).`)}

${p(`Sign in: <a href="${loginUrl}" style="color:#2563eb;font-weight:600;">${loginUrl}</a>`)}

${p(`Questions? Email <a href="mailto:${instructorEmail}" style="color:#2563eb;">${instructorEmail}</a> or reply on the announcement.`)}
`.trim()
}
