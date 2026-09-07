/**
 * Rich HTML email — ECE 2202 course progress & upcoming topics announcement.
 */
import { escapeHtmlForEmail } from "@/lib/email/emailTemplates"

export const ECE2202_COURSE_PROGRESS_EMAIL_SUBJECT =
  "ECE 2202 — Course Progress, Upcoming Topics, and Student Feedback"

export type Ece2202CourseProgressEmailOpts = {
  studentFirstName: string
  loginUrl: string
  announcementsUrl: string
  instructorName?: string
  instructorEmail?: string
}

export function buildEce2202CourseProgressEmailHtml(opts: Ece2202CourseProgressEmailOpts): string {
  const name = escapeHtmlForEmail(opts.studentFirstName || "there")
  const loginUrl = escapeHtmlForEmail(opts.loginUrl)
  const announcementsUrl = escapeHtmlForEmail(opts.announcementsUrl)
  const instructorName = escapeHtmlForEmail(opts.instructorName ?? "Daniel Doe")
  const instructorEmail = escapeHtmlForEmail(opts.instructorEmail ?? "dmdoe@pvamu.edu")

  const p = (text: string) =>
    `<p style="margin:0 0 14px;color:#334155;font-size:16px;line-height:1.65;">${text}</p>`
  const li = (text: string) =>
    `<li style="margin:0 0 10px;color:#334155;font-size:15px;line-height:1.6;">${text}</li>`
  const h2 = (text: string) =>
    `<h2 style="margin:28px 0 12px;font-size:18px;color:#0f172a;font-weight:700;">${text}</h2>`

  return `
${p(`Hi <strong>${name}</strong>,`)}

${p(
  `I wanted to share a brief update on <strong>course progress</strong>, what is coming next, and how you can share feedback.`,
)}

${h2("Why the early material may feel familiar")}
${p(
  `Many topics so far overlap with <strong>Circuits I</strong>. That is expected: our syllabus covers <strong>Chapters 1–8</strong> of the textbook, and the early chapters strengthen analytical foundations before we move into more advanced material.`,
)}

${p(`We are currently on <strong>Chapter 5</strong>. Upcoming topics include:`)}
<ul style="margin:0 0 20px;padding-left:22px;">
  ${li("<strong>RLC Circuits</strong> (Second-Order Circuits)")}
  ${li("<strong>AC Circuit Analysis</strong>")}
  ${li("<strong>Phasors and Complex Impedance</strong>")}
  ${li("<strong>AC Power Analysis</strong>")}
  ${li("<strong>Frequency Response</strong> and more advanced circuit behavior")}
</ul>

${p(
  `These later chapters connect more directly with junior-level EE coursework — the material will become increasingly advanced as we move forward.`,
)}

${h2("Your feedback")}
${p(
  `If there are topics, applications, or concepts beyond the scheduled chapters that would help your learning, please let me know. I will do my best to incorporate additional discussions where time permits.`,
)}

${h2("Textbook table of contents (attached in CourseCollab)")}
${p(
  `The full announcement on CourseCollab includes the <strong>textbook table of contents</strong> as a PDF attachment so you can see the semester roadmap.`,
)}

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border-collapse:collapse;">
  <tr>
    <td style="background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%);border-radius:14px;padding:18px 22px;border:1px solid #86efac;">
      <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:0.04em;">Read on CourseCollab</p>
      <p style="margin:0;font-size:15px;line-height:1.6;">
        <a href="${announcementsUrl}" style="color:#15803d;font-weight:700;text-decoration:none;">Open Announcements → download the PDF</a>
      </p>
    </td>
  </tr>
</table>

${p(`Sign in: <a href="${loginUrl}" style="color:#2563eb;font-weight:600;">${loginUrl}</a>`)}

${p(`Questions? Email <a href="mailto:${instructorEmail}" style="color:#2563eb;">${instructorEmail}</a> or reply on the announcement.`)}

${p(`Best regards,<br/><br/><strong>${instructorName}</strong><br/>ECE 2202 · CourseCollab`)}
`.trim()
}
