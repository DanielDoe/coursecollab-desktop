/**
 * Rich HTML announcement — ECE 2202 class cancellation + op-amps self-study.
 */
import { escapeHtmlForEmail } from "@/lib/email/emailTemplates"

export type Ece2202ClassCancelOpAmpsEmailOpts = {
  studentFirstName: string
  loginUrl: string
  lecturesUrl: string
  recordedLectureUrl: string
  classDateLabel: string
  instructorName?: string
  instructorEmail?: string
  courseCode?: string
  courseTitle?: string
}

export function buildEce2202ClassCancelOpAmpsEmailHtml(
  opts: Ece2202ClassCancelOpAmpsEmailOpts,
): string {
  const name = escapeHtmlForEmail(opts.studentFirstName || "there")
  const loginUrl = escapeHtmlForEmail(opts.loginUrl)
  const lecturesUrl = escapeHtmlForEmail(opts.lecturesUrl)
  const recordedLectureUrl = escapeHtmlForEmail(opts.recordedLectureUrl)
  const classDateLabel = escapeHtmlForEmail(opts.classDateLabel)
  const courseCode = escapeHtmlForEmail(opts.courseCode ?? "ECE 2202")
  const courseTitle = escapeHtmlForEmail(opts.courseTitle ?? "Circuit Analysis II")
  const instructorName = escapeHtmlForEmail(opts.instructorName ?? "Daniel Doe")
  const instructorEmail = escapeHtmlForEmail(opts.instructorEmail ?? "dmdoe@pvamu.edu")

  const p = (text: string) =>
    `<p style="margin:0 0 14px;color:#334155;font-size:16px;line-height:1.65;">${text}</p>`
  const li = (text: string) =>
    `<li style="margin:0 0 10px;color:#334155;font-size:15px;line-height:1.6;">${text}</li>`

  return `
${p(`Hi <strong>${name}</strong>,`)}

${p(
  `I am writing with a quick update for <strong>${courseCode} (${courseTitle})</strong>. I have an emergency to attend to and will <strong>not be able to make class tomorrow (${classDateLabel})</strong>. I sincerely apologize for any inconvenience this may cause.`,
)}

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border-collapse:collapse;">
  <tr>
    <td style="background:linear-gradient(135deg,#fff7ed 0%,#ffedd5 100%);border-radius:14px;padding:18px 22px;border:1px solid #fdba74;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#c2410c;text-transform:uppercase;letter-spacing:0.04em;">While I am away</p>
      <p style="margin:0;color:#7c2d12;font-size:16px;line-height:1.6;">Please begin <strong>Op-Amps Lecture 4</strong> and work through the <strong>sample practice problems</strong> on the Lecture 4 slides on CourseCollab.</p>
    </td>
  </tr>
</table>

<h2 style="margin:28px 0 12px;font-size:18px;color:#0f172a;font-weight:700;">What to do today</h2>
<ol style="margin:0 0 20px;padding-left:22px;">
  ${li(`Sign in: <a href="${loginUrl}" style="color:#2563eb;font-weight:600;">${loginUrl}</a>`)}
  ${li(`Open <a href="${lecturesUrl}" style="color:#2563eb;font-weight:600;">Lectures</a> and start <strong>Op-Amps Lecture 4</strong>.`)}
  ${li(`Complete the <strong>sample practice problems</strong> linked on the Lecture 4 slides.`)}
  ${li(`Watch the recorded op-amp lecture on YouTube: <a href="${recordedLectureUrl}" style="color:#2563eb;font-weight:600;">Op-Amps recorded lecture</a>`)}
</ol>

<h2 style="margin:28px 0 12px;font-size:18px;color:#0f172a;font-weight:700;">Coming up</h2>
<ul style="margin:0 0 20px;padding-left:22px;">
  ${li(`I will upload the <strong>Classroom Points op-amp questions</strong> tomorrow.`)}
  ${li(`Our plan is to <strong>finish op-amps this week</strong>.`)}
  ${li(`Next week we will start <strong>RC and RL first-order circuits</strong> — I will upload that material tomorrow as well.`)}
</ul>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border-collapse:collapse;">
  <tr>
    <td style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:0 12px 12px 0;padding:16px 20px;">
      <p style="margin:0;font-size:15px;color:#1e3a8a;line-height:1.6;">Thank you for your patience and for staying on track with the material. If you have questions, use <strong>Issues &amp; Comments</strong> on CourseCollab or email me directly.</p>
    </td>
  </tr>
</table>

${p(
  `Again, I apologize for the disruption to our schedule. I appreciate your understanding.<br/><br/><strong>${instructorName}</strong><br/>CourseCollab · ${courseCode}`,
)}
`.trim()
}

export const ECE2202_CLASS_CANCEL_OPAMPS_EMAIL_SUBJECT =
  "ECE 2202 — No class tomorrow · Op-Amps Lecture 4 self-study"
