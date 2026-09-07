/**
 * Rich HTML welcome email for Fall 2026 PVAMU ELEG students (1301 P01/P02, 1304 P03).
 * Uses university-first auth (/auth/university → /auth/student) — not legacy roster login.
 */
import { escapeHtmlForEmail } from "@/lib/email/emailTemplates"
import { STUDENT_ROSTER_DEFAULT_PASSWORD } from "@/lib/student-roster-default-password"
import { studentFirstNameFromFullName } from "@/lib/email/rich-announcement-ece2202-welcome"

export type ElegFall2026WelcomeEmailOpts = {
  studentFirstName: string
  studentId: string
  studentEmail: string
  sessionCode: string
  courseCode: string
  courseTitle: string
  universityName?: string
  universityShortName?: string
  authUniversityUrl: string
  authStudentUrl: string
  changePasswordUrl: string
  dashboardUrl: string
  membershipUrl: string
  syllabusUrl: string
  lecturesUrl: string
  instructorName?: string
  instructorEmail?: string
  term?: string
  /** When true, opens with an apology for outdated roster-login instructions. */
  correction?: boolean
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

export function buildElegFall2026WelcomeEmailHtml(opts: ElegFall2026WelcomeEmailOpts): string {
  const name = escapeHtmlForEmail(opts.studentFirstName || "there")
  const studentId = escapeHtmlForEmail(opts.studentId)
  const studentEmail = escapeHtmlForEmail(opts.studentEmail)
  const sessionCode = escapeHtmlForEmail(opts.sessionCode)
  const courseCode = escapeHtmlForEmail(formatCourseCode(opts.courseCode))
  const courseTitle = escapeHtmlForEmail(opts.courseTitle)
  const section = escapeHtmlForEmail(sectionLabel(opts.sessionCode))
  const universityName = escapeHtmlForEmail(opts.universityName ?? "Prairie View A&M University")
  const universityShortName = escapeHtmlForEmail(opts.universityShortName ?? "PVAMU")
  const authUniversityUrl = escapeHtmlForEmail(opts.authUniversityUrl)
  const authStudentUrl = escapeHtmlForEmail(opts.authStudentUrl)
  const changePasswordUrl = escapeHtmlForEmail(opts.changePasswordUrl)
  const dashboardUrl = escapeHtmlForEmail(opts.dashboardUrl)
  const membershipUrl = escapeHtmlForEmail(opts.membershipUrl)
  const syllabusUrl = escapeHtmlForEmail(opts.syllabusUrl)
  const lecturesUrl = escapeHtmlForEmail(opts.lecturesUrl)
  const term = escapeHtmlForEmail(opts.term ?? "Fall 2026")
  const instructorName = escapeHtmlForEmail(opts.instructorName ?? "Daniel Doe")
  const instructorEmail = escapeHtmlForEmail(opts.instructorEmail ?? "dmdoe@pvamu.edu")
  const defaultPassword = escapeHtmlForEmail(STUDENT_ROSTER_DEFAULT_PASSWORD)

  const p = (text: string) =>
    `<p style="margin:0 0 14px;color:#334155;font-size:16px;line-height:1.65;">${text}</p>`
  const li = (text: string) =>
    `<li style="margin:0 0 10px;color:#334155;font-size:15px;line-height:1.6;">${text}</li>`

  const correctionBlock = opts.correction
    ? `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;border-collapse:collapse;">
  <tr>
    <td style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:0 12px 12px 0;padding:16px 20px;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.04em;">Correction</p>
      <p style="margin:0;font-size:15px;color:#7f1d1d;line-height:1.6;">Our earlier welcome email described an <strong>old roster sign-in flow</strong> that is no longer used. Please follow the steps below — this is the correct way to access CourseCollab today.</p>
    </td>
  </tr>
</table>`
    : ""

  return `
${correctionBlock}

${p(`Hi <strong>${name}</strong>,`)}

${p(
  opts.correction
    ? `Welcome to <strong>${courseCode} (${courseTitle})</strong> for <strong>${term}</strong>! Your section is <strong>${section}</strong>. Below are the <strong>correct</strong> sign-in steps for CourseCollab.`
    : `Welcome to <strong>${courseCode} (${courseTitle})</strong> for <strong>${term}</strong>! Your section is <strong>${section}</strong>. We're using <strong>CourseCollab</strong> for lectures, practice, homework, quizzes, collaboration, and your course syllabus — everything in one place.`,
)}

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border-collapse:collapse;">
  <tr>
    <td style="background:linear-gradient(135deg,#eef2ff 0%,#e0e7ff 100%);border-radius:14px;padding:18px 22px;border:1px solid #c7d2fe;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#3730a3;text-transform:uppercase;letter-spacing:0.04em;">Your credentials</p>
      <p style="margin:0 0 8px;color:#312e81;font-size:16px;line-height:1.6;">Student ID: <strong style="font-family:ui-monospace,Menlo,Consolas,monospace;">${studentId}</strong></p>
      <p style="margin:0 0 8px;color:#312e81;font-size:15px;line-height:1.6;">Email: <strong>${studentEmail}</strong></p>
      <p style="margin:0;color:#312e81;font-size:15px;line-height:1.6;">Section: <strong>${sessionCode}</strong> (${section})</p>
    </td>
  </tr>
</table>

<h2 style="margin:28px 0 12px;font-size:18px;color:#0f172a;font-weight:700;">How to sign in (university-first)</h2>
<ol style="margin:0 0 20px;padding-left:22px;">
  ${li(`Open <a href="${authUniversityUrl}" style="color:#2563eb;font-weight:600;">${authUniversityUrl}</a> and select <strong>${universityName}</strong> (${universityShortName}).`)}
  ${li(`On the student sign-in page (<a href="${authStudentUrl}" style="color:#2563eb;">${authStudentUrl}</a>), enter your <strong>Student ID</strong> (<code style="font-family:ui-monospace,monospace;">${studentId}</code>) <em>or</em> your <strong>@pvamu.edu email</strong>.`)}
  ${li(`<strong>First time signing in?</strong> Choose <strong>Login</strong> (not account activation) and enter the temporary password below — CourseCollab will prompt you to set a new password immediately.`)}
  ${li(`Temporary password: <strong style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:16px;">${defaultPassword}</strong> (capital letters and punctuation matter).`)}
  ${li(`If you are enrolled in more than one ELEG course, choose the correct course when prompted after sign-in.`)}
</ol>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border-collapse:collapse;">
  <tr>
    <td style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 12px 12px 0;padding:16px 20px;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.04em;">Set your password</p>
      <p style="margin:0;font-size:15px;color:#78350f;line-height:1.6;">After your first successful sign-in, you will be asked to <strong>create a private password</strong>. You can also update it later under <a href="${changePasswordUrl}" style="color:#b45309;font-weight:600;">Settings → Change password</a>. Use <strong>Forgot password?</strong> on the sign-in page if you need a reset.</p>
    </td>
  </tr>
</table>

<p style="margin:0 0 8px;font-size:14px;color:#64748b;"><strong>Note:</strong> The old “pick your name from the roster list” login at <code>/student/login</code> is <em>not</em> used on the web anymore. Always start at the university sign-in link above.</p>

<h2 style="margin:28px 0 12px;font-size:18px;color:#0f172a;font-weight:700;">What CourseCollab includes for ELEG</h2>
<ul style="margin:0 0 20px;padding-left:22px;">
  ${li(`<strong>Lectures &amp; sample practice:</strong> <a href="${lecturesUrl}" style="color:#2563eb;">Learning Center → Lectures</a> — slide decks with in-class practice and step-by-step solutions.`)}
  ${li(`<strong>Practice Hub &amp; flashcards:</strong> topic drills and review cards tied to your course.`)}
  ${li(`<strong>Homework &amp; quizzes:</strong> open <em>Assessments</em> after you sign in for assigned work and deadlines.`)}
  ${li(`<strong>Groups &amp; projects:</strong> form teams, propose projects, and track collaboration in one workspace.`)}
  ${li(`<strong>Cora AI tutor &amp; CodeBench:</strong> guided help and a coding workspace for programming coursework.`)}
  ${li(`<strong>Syllabus &amp; calendar:</strong> <a href="${syllabusUrl}" style="color:#2563eb;">Course Info → Syllabus</a> — policies, schedule, and grading.`)}
</ul>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border-collapse:collapse;">
  <tr>
    <td style="background:linear-gradient(135deg,#faf5ff 0%,#f3e8ff 100%);border-radius:14px;padding:18px 22px;border:1px solid #e9d5ff;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#6b21a8;text-transform:uppercase;letter-spacing:0.04em;">Recommended for the semester</p>
      <p style="margin:0 0 10px;color:#581c87;font-size:15px;line-height:1.65;">For the <strong>best experience</strong> — full Cora AI, unlimited Playground, extra quiz attempts, save-and-finish-later, and priority support — we recommend the <strong>Trailblazer</strong> package for the semester.</p>
      <p style="margin:0;font-size:15px;line-height:1.6;"><a href="${membershipUrl}" style="color:#7c3aed;font-weight:600;">View membership plans →</a></p>
    </td>
  </tr>
</table>

<p style="margin:24px 0 0;text-align:center;">
  <a href="${authUniversityUrl}" style="display:inline-block;padding:14px 28px;background:#4f46e5;color:#ffffff !important;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">Sign in to CourseCollab</a>
</p>

${p(
  `Questions? Contact ${instructorName} at <a href="mailto:${instructorEmail}" style="color:#2563eb;">${instructorEmail}</a> or reply to this email.`,
)}

${p(`See you soon!<br/><strong>${instructorName}</strong><br/>CourseCollab · ${courseCode} · ${term}`)}
`.trim()
}

export const ELEG_FALL2026_WELCOME_EMAIL_SUBJECT =
  "Welcome to CourseCollab — Fall 2026 ELEG sign-in & getting started"

export const ELEG_FALL2026_WELCOME_CORRECTION_SUBJECT =
  "CORRECTION — CourseCollab sign-in instructions (Fall 2026 ELEG)"

export { studentFirstNameFromFullName }
