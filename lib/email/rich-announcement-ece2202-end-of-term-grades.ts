import { escapeHtmlForEmail } from "@/lib/email/emailTemplates"
import { studentFirstNameFromFullName } from "@/lib/email/rich-announcement-ece2202-welcome"

export const ECE2202_END_OF_TERM_GRADES_SUBJECT =
  "ECE 2202 — Your grades are on Canvas + report card on CourseCollab"

export function buildEce2202EndOfTermGradesAnnouncementHtml(): string {
  return `<p><strong>ECE 2202 — your final grades are posted.</strong></p>

<p>Your official grades are now on <strong>Canvas</strong>. Your detailed <strong>CourseCollab report card</strong> is also ready for you to review.</p>

<p><strong>Where to look</strong></p>
<ul>
<li><strong>Canvas</strong> — official semester grades</li>
<li><strong>CourseCollab</strong> — open <strong>Assessments → Grades</strong> for your full report card and breakdown</li>
</ul>

<p>If anything looks incorrect or you have questions about your grade, please contact me as soon as possible so we can review it together.</p>

<p><strong>One last favor</strong></p>
<p>Please complete your <strong>course evaluation</strong> on CourseCollab if you have not already — it includes your feedback on the course and on the CourseCollab platform, which helps us improve for future classes.</p>

<p>It has been a pleasure teaching you this semester. Thank you for your hard work, curiosity, and engagement throughout ECE 2202. I wish you all the very best in your continued studies and future endeavors.</p>

<p>With gratitude,<br/>Dr. Doe · ECE 2202</p>`
}

/** Light-only inline styles — paired with wrapEmailLightOnly shell for iOS Mail. */
export function buildEce2202EndOfTermGradesEmailHtml(opts: {
  studentFullName: string
  gradesUrl: string
  evaluationUrl: string
  announcementsUrl: string
  instructorName?: string
}): string {
  const firstName = escapeHtmlForEmail(studentFirstNameFromFullName(opts.studentFullName))
  const gradesUrl = escapeHtmlForEmail(opts.gradesUrl)
  const evaluationUrl = escapeHtmlForEmail(opts.evaluationUrl)
  const announcementsUrl = escapeHtmlForEmail(opts.announcementsUrl)
  const instructor = escapeHtmlForEmail(opts.instructorName?.trim() || "Dr. Doe")

  return `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;background-color:#ffffff !important;color:#334155 !important;">
  <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155 !important;">Hi ${firstName},</p>

  <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155 !important;">
    Your <strong style="color:#334155 !important;">final grades</strong> are now posted on
    <strong style="color:#334155 !important;">Canvas</strong>, and your detailed
    <strong style="color:#334155 !important;">report card</strong> is available on CourseCollab.
  </p>

  <div class="email-light-panel" style="margin:20px 0;padding:18px 20px;background-color:#f8f4fc !important;border:1px solid #d2c3eb;border-radius:12px;">
    <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#582c83 !important;text-transform:uppercase;letter-spacing:0.06em;">Where to review</p>
    <ul style="margin:0;padding-left:20px;font-size:15px;line-height:1.65;color:#475569 !important;">
      <li><strong style="color:#334155 !important;">Canvas</strong> — official semester grades</li>
      <li><strong style="color:#334155 !important;">CourseCollab</strong> — Assessments → Grades for your full report card</li>
    </ul>
  </div>

  <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#475569 !important;">
    If anything looks incorrect or you have any questions, please reach out to me right away so we can take a look together.
  </p>

  <div class="email-light-warn" style="margin:0 0 20px;padding:16px 18px;background-color:#fffbeb !important;border:1px solid #fde68a;border-radius:12px;">
    <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#92400e !important;">Help us improve</p>
    <p style="margin:0;font-size:15px;line-height:1.65;color:#78350f !important;">
      Please do not forget to leave your <strong style="color:#78350f !important;">course evaluation</strong> on CourseCollab —
      your feedback on the course and on the platform helps us keep improving CourseCollab for future students.
    </p>
  </div>

  <div style="margin:24px 0;">
    <a href="${gradesUrl}" style="display:inline-block;background-color:#582c83 !important;color:#ffffff !important;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;font-size:15px;margin-right:10px;margin-bottom:10px;">View Report Card</a>
    <a href="${evaluationUrl}" style="display:inline-block;background-color:#582c83 !important;color:#ffffff !important;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;font-size:15px;margin-right:10px;margin-bottom:10px;">Course Evaluation</a>
    <a href="${announcementsUrl}" style="display:inline-block;background-color:#ffffff !important;color:#582c83 !important;text-decoration:none;padding:11px 18px;border-radius:10px;font-weight:600;font-size:15px;border:2px solid #582c83;">View announcement</a>
  </div>

  <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#475569 !important;">
    It has been a genuine pleasure teaching you this semester. Thank you for your hard work, curiosity, and engagement —
    I truly enjoyed having you in ECE 2202. Wishing you all the very best in everything ahead.
  </p>

  <p style="margin:0;font-size:15px;line-height:1.5;color:#64748b !important;border-top:1px solid #e2e8f0;padding-top:16px;">
    With gratitude,<br/>
    ${instructor} · ECE 2202
  </p>
</div>`.trim()
}
