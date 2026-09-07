/**
 * Fall 2026 ELEG — apology + CourseCollab sign-in reminder with credentials.
 */
import { escapeHtmlForEmail } from "@/lib/email/emailTemplates"
import { STUDENT_ROSTER_DEFAULT_PASSWORD } from "@/lib/student-roster-default-password"
import { studentFirstNameFromFullName } from "@/lib/email/rich-announcement-ece2202-welcome"

export type ElegFall2026LoginReminderEmailOpts = {
  studentFirstName: string
  studentId: string
  studentEmail: string
  sessionCode: string
  courseCode: string
  courseTitle: string
  authUniversityUrl: string
  authStudentUrl: string
  changePasswordUrl: string
  instructorName?: string
  instructorEmail?: string
  term?: string
}

const SECTION_LABELS: Record<string, string> = {
  ELEG1301P01: "P01 / P81",
  ELEG1301P02: "P02 / P82",
  ELEG1304P03: "P03 / P83",
}

function formatCourseCode(code: string): string {
  const c = code.trim().toUpperCase()
  const m = c.match(/^ELEG(\d{4})$/)
  if (m) return `ELEG ${m[1]}`
  return c
}

function sectionLabel(sessionCode: string): string {
  return SECTION_LABELS[sessionCode] ?? sessionCode
}

export function buildElegFall2026LoginReminderEmailHtml(opts: ElegFall2026LoginReminderEmailOpts): string {
  const name = escapeHtmlForEmail(opts.studentFirstName || "there")
  const studentId = escapeHtmlForEmail(opts.studentId)
  const studentEmail = escapeHtmlForEmail(opts.studentEmail)
  const sessionCode = escapeHtmlForEmail(opts.sessionCode)
  const courseCode = escapeHtmlForEmail(formatCourseCode(opts.courseCode))
  const courseTitle = escapeHtmlForEmail(opts.courseTitle)
  const section = escapeHtmlForEmail(sectionLabel(opts.sessionCode))
  const authUniversityUrl = escapeHtmlForEmail(opts.authUniversityUrl)
  const authStudentUrl = escapeHtmlForEmail(opts.authStudentUrl)
  const changePasswordUrl = escapeHtmlForEmail(opts.changePasswordUrl)
  const term = escapeHtmlForEmail(opts.term ?? "Fall 2026")
  const instructorName = escapeHtmlForEmail(opts.instructorName ?? "Daniel Doe")
  const instructorEmail = escapeHtmlForEmail(opts.instructorEmail ?? "dmdoe@pvamu.edu")
  const defaultPassword = escapeHtmlForEmail(STUDENT_ROSTER_DEFAULT_PASSWORD)

  const p = (text: string) =>
    `<p style="margin:0 0 14px;color:#334155;font-size:16px;line-height:1.65;">${text}</p>`
  const li = (text: string) =>
    `<li style="margin:0 0 10px;color:#334155;font-size:15px;line-height:1.6;">${text}</li>`

  return `
${p(`Hi <strong>${name}</strong>,`)}

${p(`Good evening everyone,`)}

${p(
  `I want to apologize for the schedule confusion and conflicts today, as well as my absence from class. I appreciate your patience and understanding as we work through the scheduling adjustments at the beginning of the semester.`,
)}

${p(
  `I am looking forward to seeing everyone at our next class meeting and getting us fully underway for the semester.`,
)}

${p(
  `If you have <strong>not yet signed into CourseCollab</strong>, please make sure you do so before our next class. We will be using CourseCollab regularly for course materials, lectures, assignments, programming activities, announcements, and other class activities.`,
)}

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border-collapse:collapse;">
  <tr>
    <td style="background:linear-gradient(135deg,#eef2ff 0%,#e0e7ff 100%);border-radius:14px;padding:18px 22px;border:1px solid #c7d2fe;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#3730a3;text-transform:uppercase;letter-spacing:0.04em;">Your credentials (${courseCode} · ${section})</p>
      <p style="margin:0 0 8px;color:#312e81;font-size:16px;line-height:1.6;">Student ID: <strong style="font-family:ui-monospace,Menlo,Consolas,monospace;">${studentId}</strong></p>
      <p style="margin:0 0 8px;color:#312e81;font-size:15px;line-height:1.6;">Email: <strong>${studentEmail}</strong></p>
      <p style="margin:0;color:#312e81;font-size:15px;line-height:1.6;">Temporary password (first sign-in): <strong style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:16px;">${defaultPassword}</strong></p>
    </td>
  </tr>
</table>

<h2 style="margin:28px 0 12px;font-size:18px;color:#0f172a;font-weight:700;">How to sign in</h2>
<ol style="margin:0 0 20px;padding-left:22px;">
  ${li(`Open <a href="${authUniversityUrl}" style="color:#2563eb;font-weight:600;">${authUniversityUrl}</a> and select <strong>Prairie View A&amp;M University</strong>.`)}
  ${li(`On the student sign-in page (<a href="${authStudentUrl}" style="color:#2563eb;">${authStudentUrl}</a>), enter your <strong>Student ID</strong> or <strong>@pvamu.edu email</strong>.`)}
  ${li(`Choose <strong>Login</strong> (not account activation). First-time users: enter the temporary password above — CourseCollab will prompt you to set a new password.`)}
  ${li(`Already signed in before? Use your personal password, or <a href="${changePasswordUrl}" style="color:#2563eb;">reset it here</a> if needed.`)}
</ol>

<p style="margin:24px 0 0;text-align:center;">
  <a href="${authUniversityUrl}" style="display:inline-block;padding:14px 28px;background:#4f46e5;color:#ffffff !important;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">Sign in to CourseCollab</a>
</p>

${p(`Thank you again for your patience, and I look forward to seeing everyone at our next class.`)}

${p(`Best,<br/><strong>${instructorName}</strong><br/>CourseCollab · ${courseCode} · ${term}`)}

${p(`Questions? Contact ${instructorName} at <a href="mailto:${instructorEmail}" style="color:#2563eb;">${instructorEmail}</a>.`)}
`.trim()
}

export const ELEG_FALL2026_LOGIN_REMINDER_SUBJECT =
  "Please sign in to CourseCollab — Fall 2026 ELEG (login reminder + credentials)"

export { studentFirstNameFromFullName }
