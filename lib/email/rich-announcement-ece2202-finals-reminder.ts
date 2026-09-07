import { escapeHtmlForEmail } from "@/lib/email/emailTemplates"
import { studentFirstNameFromFullName } from "@/lib/email/rich-announcement-ece2202-welcome"

export const ECE2202_FINALS_REMINDER_SUBJECT =
  "ECE 2202 — Final exam tomorrow (Thu Jul 30) + grades ready by Friday"

/** Light-only inline styles — paired with wrapEmailLightOnly shell for iOS Mail. */
export function buildEce2202FinalsReminderEmailHtml(opts: {
  studentFullName: string
  baseUrl: string
  announcementsUrl: string
  finalExamsUrl: string
  instructorName?: string
}): string {
  const firstName = escapeHtmlForEmail(studentFirstNameFromFullName(opts.studentFullName))
  const announcementsUrl = escapeHtmlForEmail(opts.announcementsUrl)
  const finalExamsUrl = escapeHtmlForEmail(opts.finalExamsUrl)
  const instructor = escapeHtmlForEmail(opts.instructorName?.trim() || "Dr. Doe")

  return `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;background-color:#ffffff !important;color:#334155 !important;">
  <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155 !important;">Hi ${firstName},</p>

  <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#334155 !important;">
    Friendly reminder: your <strong style="color:#334155 !important;">ECE 2202 comprehensive final</strong> is
    <strong style="color:#334155 !important;">tomorrow, Thursday, July 30</strong>.
  </p>

  <div class="email-light-panel" style="margin:20px 0;padding:18px 20px;background-color:#f8f4fc !important;border:1px solid #d2c3eb;border-radius:12px;">
    <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#582c83 !important;text-transform:uppercase;letter-spacing:0.06em;">Final exam</p>
    <p style="margin:0 0 4px;font-size:17px;font-weight:700;color:#1e293b !important;">Thursday, July 30 · 10:00 AM–12:00 PM</p>
    <p style="margin:0;font-size:15px;line-height:1.55;color:#475569 !important;">
      <strong style="color:#334155 !important;">Room 318</strong>, UH Katy Campus · bring UH ID &amp; calculator · in person
    </p>
  </div>

  <div class="email-light-warn" style="margin:0 0 20px;padding:16px 18px;background-color:#fffbeb !important;border:1px solid #fde68a;border-radius:12px;">
    <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#92400e !important;">Before you arrive</p>
    <ul style="margin:0;padding-left:20px;font-size:15px;line-height:1.65;color:#78350f !important;">
      <li>Use <strong style="color:#78350f !important;">Room 318</strong>, not our usual 307E.</li>
      <li>Review key topics from Lectures 1–8, homework, and quizzes tonight.</li>
      <li>Follow exam rules — no talking or collaboration during the test.</li>
    </ul>
  </div>

  <p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#1e293b !important;">Grades update</p>
  <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#475569 !important;">
    I am working through remaining <strong style="color:#334155 !important;">homework</strong> and <strong style="color:#334155 !important;">quiz</strong> grading now so your
    CourseCollab record is up to date. I expect everything to be posted for you to review by
    <strong style="color:#334155 !important;">Friday, August 1</strong>.
  </p>
  <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#64748b !important;">
    If a score still looks wrong after Friday, reply here or email me with the assignment name.
  </p>

  <div style="margin:24px 0;">
    <a href="${finalExamsUrl}" style="display:inline-block;background-color:#582c83 !important;color:#ffffff !important;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;font-size:15px;margin-right:10px;margin-bottom:10px;">Open Final Exams</a>
    <a href="${announcementsUrl}" style="display:inline-block;background-color:#ffffff !important;color:#582c83 !important;text-decoration:none;padding:11px 18px;border-radius:10px;font-weight:600;font-size:15px;border:2px solid #582c83;">View announcement</a>
  </div>

  <p style="margin:0;font-size:15px;line-height:1.5;color:#64748b !important;border-top:1px solid #e2e8f0;padding-top:16px;">
    Good luck tomorrow.<br/>
    ${instructor}
  </p>
</div>`.trim()
}
