/**
 * Copy for instructor-wide email: Spring regular coursework deadline (Apr 11, 2026 CT).
 * Send via Brevo/SMTP or your admin tool; replace CONTACT_EMAIL / INSTRUCTOR_NAME in HTML.
 */

export const SPRING_2026_REGULAR_DEADLINE_SUBJECT =
  "Important: Deadline for quizzes, homework & mid-semesters — April 11, 2026"

export function spring2026RegularDeadlinePlainText(opts: {
  instructorName: string
  contactEmail: string
  courseName?: string
}): string {
  const { instructorName, contactEmail, courseName = "the course" } = opts
  return [
    `Hello,`,
    ``,
    `This is a reminder about an important deadline for ${courseName}.`,
    ``,
    `All quizzes, homework assignments, and mid-semester exams must be completed, submitted, and — if your instructor allows retakes — finished by:`,
    ``,
    `  Saturday, April 11, 2026`,
    `  11:59 p.m. Central Time (CDT)`,
    ``,
    `After that time, the system will close access to those assessment types for everyone (including all membership tiers). That includes starting new attempts, finishing older ones, retakes, and rollover extensions tied to that work. Final exams will follow the separate schedule your instructor announces.`,
    ``,
    `Plan ahead: don’t wait until the last minute. If you hit a technical problem, illness, or other barrier, reach out as soon as you can.`,
    ``,
    `Questions or need help? Contact ${instructorName} at ${contactEmail}.`,
    ``,
    `— ${instructorName}`,
  ].join("\n")
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function spring2026RegularDeadlineHtml(opts: {
  instructorName: string
  contactEmail: string
  courseName?: string
}): string {
  const { instructorName, contactEmail, courseName = "this course" } = opts
  const courseEsc = escHtml(courseName)
  const emailEsc = escHtml(contactEmail)
  const nameEsc = escHtml(instructorName)
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Assessment deadline reminder</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:#0f172a;color:#f8fafc;padding:28px 32px;">
              <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.85;font-family:system-ui,sans-serif;">Course notice</p>
              <h1 style="margin:0;font-size:22px;line-height:1.35;font-weight:600;font-family:system-ui,sans-serif;">Deadline: quizzes, homework &amp; mid-semesters</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;color:#334155;font-size:16px;line-height:1.65;">
              <p style="margin:0 0 16px;">Hello,</p>
              <p style="margin:0 0 16px;">Please read this carefully so nothing catches you off guard for <strong>${courseEsc}</strong>.</p>
              <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:18px 20px;margin:20px 0;">
                <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#92400e;font-family:system-ui,sans-serif;text-transform:uppercase;letter-spacing:0.06em;">Hard deadline (Central Time)</p>
                <p style="margin:0;font-size:18px;color:#78350f;font-weight:600;">Saturday, April 11, 2026 · 11:59 p.m. CDT</p>
              </div>
              <p style="margin:0 0 16px;">By that time you should have <strong>taken, submitted, and (if retakes apply) finished all attempts</strong> for:</p>
              <ul style="margin:0 0 20px;padding-left:1.25em;">
                <li style="margin-bottom:8px;">Quizzes</li>
                <li style="margin-bottom:8px;">Homework</li>
                <li style="margin-bottom:8px;">Mid-semester exams</li>
              </ul>
              <p style="margin:0 0 16px;">After the deadline, access for those items ends for <strong>everyone</strong> on the platform for this term—including retakes and rollover-style extensions on that work. <strong>Final exams</strong> are separate and will follow the schedule I give you in class and on CourseCollab.</p>
              <p style="margin:0 0 16px;">If something goes wrong (login issues, illness, etc.), <strong>email me as early as you can</strong>—waiting until after the deadline usually limits what we can do.</p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
              <p style="margin:0;font-size:15px;">
                <strong>Contact:</strong><br />
                ${nameEsc}<br />
                <a href="mailto:${emailEsc}" style="color:#0ea5e9;">${emailEsc}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 28px;color:#94a3b8;font-size:12px;font-family:system-ui,sans-serif;">
              You’re receiving this because you’re enrolled in ${courseEsc}.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
