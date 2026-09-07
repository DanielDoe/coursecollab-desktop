/**
 * Rich HTML welcome email for ECE 2202 students (CourseCollab onboarding).
 */
import { escapeHtmlForEmail } from "@/lib/email/emailTemplates"
import {
  STUDENT_ROSTER_DEFAULT_PASSWORD_ECE2202,
} from "@/lib/student-roster-default-password"

export type Ece2202WelcomeEmailOpts = {
  studentFirstName: string
  loginUrl: string
  changePasswordUrl: string
  syllabusUrl: string
  lecturesUrl: string
  instructorName?: string
  instructorEmail?: string
  courseCode?: string
  courseTitle?: string
  term?: string
}

function firstName(fullName: string): string {
  const trimmed = fullName.trim()
  if (!trimmed) return "there"
  return trimmed.split(/\s+/)[0] || "there"
}

export function studentFirstNameFromFullName(fullName: string): string {
  return firstName(fullName)
}

export function buildEce2202WelcomeEmailHtml(opts: Ece2202WelcomeEmailOpts): string {
  const name = escapeHtmlForEmail(opts.studentFirstName || "there")
  const loginUrl = escapeHtmlForEmail(opts.loginUrl)
  const changePasswordUrl = escapeHtmlForEmail(opts.changePasswordUrl)
  const syllabusUrl = escapeHtmlForEmail(opts.syllabusUrl)
  const lecturesUrl = escapeHtmlForEmail(opts.lecturesUrl)
  const courseCode = escapeHtmlForEmail(opts.courseCode ?? "ECE 2202")
  const courseTitle = escapeHtmlForEmail(opts.courseTitle ?? "Circuit Analysis II")
  const term = escapeHtmlForEmail(opts.term ?? "Summer 2026")
  const instructorName = escapeHtmlForEmail(opts.instructorName ?? "Daniel Doe")
  const instructorEmail = escapeHtmlForEmail(opts.instructorEmail ?? "dmdoe@CougarNet.UH.EDU")
  const defaultPassword = escapeHtmlForEmail(STUDENT_ROSTER_DEFAULT_PASSWORD_ECE2202)

  const p = (text: string) =>
    `<p style="margin:0 0 14px;color:#334155;font-size:16px;line-height:1.65;">${text}</p>`
  const li = (text: string) =>
    `<li style="margin:0 0 10px;color:#334155;font-size:15px;line-height:1.6;">${text}</li>`

  return `
${p(`Hi <strong>${name}</strong>,`)}

${p(
  `Welcome to <strong>${courseCode} (${courseTitle})</strong> for <strong>${term}</strong>! Your course is now live on <strong>CourseCollab</strong> — our platform for lectures, homework, quizzes, grades, and the course syllabus.`,
)}

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border-collapse:collapse;">
  <tr>
    <td style="background:linear-gradient(135deg,#eef2ff 0%,#e0e7ff 100%);border-radius:14px;padding:18px 22px;border:1px solid #c7d2fe;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#3730a3;text-transform:uppercase;letter-spacing:0.04em;">Getting started</p>
      <p style="margin:0;color:#312e81;font-size:16px;line-height:1.6;">Sign in today, <strong>change your password</strong>, then explore the syllabus and Week 1 lecture (including in-class sample practice).</p>
    </td>
  </tr>
</table>

<h2 style="margin:28px 0 12px;font-size:18px;color:#0f172a;font-weight:700;">How to sign in</h2>
<ol style="margin:0 0 20px;padding-left:22px;">
  ${li(`Open the student portal: <a href="${loginUrl}" style="color:#2563eb;font-weight:600;">${loginUrl}</a>`)}
  ${li(`Under <strong>Course</strong>, choose <strong>${courseCode}</strong>.`)}
  ${li(`Stay on the <strong>Roster</strong> tab and select <strong>your name</strong> from the class list.`)}
  ${li(`Enter your default password: <strong style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:16px;">${defaultPassword}</strong> (capital letters and punctuation matter).`)}
  ${li(`Click <strong>Continue to CourseCollab</strong>.`)}
</ol>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border-collapse:collapse;">
  <tr>
    <td style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 12px 12px 0;padding:16px 20px;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.04em;">Important — change your password</p>
      <p style="margin:0;font-size:15px;color:#78350f;line-height:1.6;">On your first login, CourseCollab will ask you to <strong>set a new password</strong>. Choose something private and memorable. You can also update it later under <a href="${changePasswordUrl}" style="color:#b45309;font-weight:600;">Settings → Change password</a>.</p>
    </td>
  </tr>
</table>

<h2 style="margin:28px 0 12px;font-size:18px;color:#0f172a;font-weight:700;">What to explore first</h2>
<ul style="margin:0 0 20px;padding-left:22px;">
  ${li(`<strong>Syllabus:</strong> <a href="${syllabusUrl}" style="color:#2563eb;">Course Info → Syllabus</a> — policies, schedule, and grading.`)}
  ${li(`<strong>Lectures:</strong> <a href="${lecturesUrl}" style="color:#2563eb;">Learning Center → Lectures</a> — Week 1 includes <strong>Sample Practice</strong> questions with step-by-step solutions.`)}
  ${li(`<strong>Homework:</strong> open <em>Assessments → Homework</em> after you sign in for assigned work.`)}
</ul>

${p(
  `If you have trouble signing in, contact ${instructorName} at <a href="mailto:${instructorEmail}" style="color:#2563eb;">${instructorEmail}</a> or reply to this email.`,
)}

${p(`We're glad you're in the course!<br/><strong>CourseCollab · ${courseCode}</strong>`)}
`.trim()
}

export const ECE2202_WELCOME_EMAIL_SUBJECT =
  "Welcome to ECE 2202 — sign in to CourseCollab & change your password"
