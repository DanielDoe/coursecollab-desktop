/**
 * Rich HTML reminder for ECE 2202 students — homework, Quiz 1, issues/comments, circuit uploads.
 */
import { escapeHtmlForEmail } from "@/lib/email/emailTemplates"

export type Ece2202AssessmentsReminderEmailOpts = {
  studentFirstName: string
  loginUrl: string
  homeworkUrl: string
  quizzesUrl: string
  instructorName?: string
  instructorEmail?: string
  courseCode?: string
  courseTitle?: string
  term?: string
}

export function buildEce2202AssessmentsReminderEmailHtml(
  opts: Ece2202AssessmentsReminderEmailOpts,
): string {
  const name = escapeHtmlForEmail(opts.studentFirstName || "there")
  const loginUrl = escapeHtmlForEmail(opts.loginUrl)
  const homeworkUrl = escapeHtmlForEmail(opts.homeworkUrl)
  const quizzesUrl = escapeHtmlForEmail(opts.quizzesUrl)
  const courseCode = escapeHtmlForEmail(opts.courseCode ?? "ECE 2202")
  const courseTitle = escapeHtmlForEmail(opts.courseTitle ?? "Circuit Analysis II")
  const term = escapeHtmlForEmail(opts.term ?? "Summer 2026")
  const instructorName = escapeHtmlForEmail(opts.instructorName ?? "Daniel Doe")
  const instructorEmail = escapeHtmlForEmail(opts.instructorEmail ?? "dmdoe@pvamu.edu")

  const p = (text: string) =>
    `<p style="margin:0 0 14px;color:#334155;font-size:16px;line-height:1.65;">${text}</p>`
  const li = (text: string) =>
    `<li style="margin:0 0 10px;color:#334155;font-size:15px;line-height:1.6;">${text}</li>`

  return `
${p(`Hi <strong>${name}</strong>,`)}

${p(
  `Your <strong>${courseCode} (${courseTitle})</strong> assessments for <strong>${term}</strong> are ready on <strong>CourseCollab</strong>. Please sign in and complete your assigned <strong>homework</strong> and <strong>Quiz 1</strong> at your earliest convenience.`,
)}

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border-collapse:collapse;">
  <tr>
    <td style="background:linear-gradient(135deg,#ecfdf5 0%,#d1fae5 100%);border-radius:14px;padding:18px 22px;border:1px solid #6ee7b7;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#047857;text-transform:uppercase;letter-spacing:0.04em;">Action items</p>
      <p style="margin:0;color:#064e3b;font-size:16px;line-height:1.6;">Take your homework assignments and <strong>Quiz 1</strong>. Upload worked solutions for circuit questions so we can review your work.</p>
    </td>
  </tr>
</table>

<h2 style="margin:28px 0 12px;font-size:18px;color:#0f172a;font-weight:700;">Where to go</h2>
<ol style="margin:0 0 20px;padding-left:22px;">
  ${li(`Sign in: <a href="${loginUrl}" style="color:#2563eb;font-weight:600;">${loginUrl}</a> — choose <strong>${courseCode}</strong>, then your name.`)}
  ${li(`<strong>Homework:</strong> <a href="${homeworkUrl}" style="color:#2563eb;font-weight:600;">Assessments → Homework</a>`)}
  ${li(`<strong>Quiz 1:</strong> <a href="${quizzesUrl}" style="color:#2563eb;font-weight:600;">Assessments → Quizzes</a>`)}
</ol>

<h2 style="margin:28px 0 12px;font-size:18px;color:#0f172a;font-weight:700;">Circuit solution uploads</h2>
<ul style="margin:0 0 20px;padding-left:22px;">
  ${li(`Section II (circuit) questions include an <strong>optional solution upload</strong>. Attach clear photos or scans of your handwritten work, MATLAB/LTSpice output, or other worked steps.`)}
  ${li(`Uploading helps us review your approach and award upload credit. You may submit MCQ answers without an upload, but upload points require a file.`)}
  ${li(`If you skip the upload, CourseCollab will ask you to confirm before finalizing — you can still submit your selected answers.`)}
</ul>

<h2 style="margin:28px 0 12px;font-size:18px;color:#0f172a;font-weight:700;">Questions or concerns?</h2>
${p(
  `On the <strong>Homework</strong> or <strong>Quizzes</strong> page, use the <strong>Issues &amp; Comments</strong> panel on the right. Click <strong>Report</strong> to describe any problem (wording, diagrams, deadlines, or technical issues). We monitor these reports and will follow up.`,
)}

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border-collapse:collapse;">
  <tr>
    <td style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:0 12px 12px 0;padding:16px 20px;">
      <p style="margin:0;font-size:15px;color:#1e3a8a;line-height:1.6;">Tip: include the assessment name, question number, and a short description so we can help quickly.</p>
    </td>
  </tr>
</table>

${p(
  `If you need direct help, contact ${instructorName} at <a href="mailto:${instructorEmail}" style="color:#2563eb;">${instructorEmail}</a>.`,
)}

${p(`Wishing you all the best this week — you've got this!<br/><br/><strong>${instructorName}</strong><br/>CourseCollab · ${courseCode}`)}
`.trim()
}

export const ECE2202_ASSESSMENTS_REMINDER_EMAIL_SUBJECT =
  "ECE 2202 — Complete Homework & Quiz 1 on CourseCollab"
