import { escapeHtmlForEmail } from "@/lib/email/emailTemplates"
import { studentFirstNameFromFullName } from "@/lib/email/rich-announcement-ece2202-welcome"

export const ECE2202_FINALS_WEEK_SCHEDULE_SUBJECT =
  "ECE 2202 — Room 318 this week + LTspice, TA review & final exam schedule"

function scheduleRow(day: string, detail: string, accent: string): string {
  return `
  <tr>
    <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;vertical-align:top;width:38%;font-weight:700;color:${accent};">${day}</td>
    <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;vertical-align:top;color:#334155;line-height:1.55;">${detail}</td>
  </tr>`
}

export function buildEce2202FinalsWeekScheduleEmailHtml(opts: {
  studentFullName: string
  baseUrl: string
  announcementsUrl: string
  instructorName?: string
}): string {
  const firstName = escapeHtmlForEmail(studentFirstNameFromFullName(opts.studentFullName))
  const announcementsUrl = escapeHtmlForEmail(opts.announcementsUrl)
  const instructor = escapeHtmlForEmail(opts.instructorName?.trim() || "Dr. Doe")

  return `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;color:#0f172a;">
  <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">Hi ${firstName},</p>

  <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">
    Quick heads-up for <strong>ECE 2202</strong> finals week. UH Katy has moved our class to a new room while summer camp activities are underway.
  </p>

  <div style="margin:20px 0;padding:16px 18px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;">
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:0.05em;">New classroom</p>
    <p style="margin:0;font-size:18px;font-weight:700;color:#1e3a8a;">Room 318 — UH Katy Campus</p>
    <p style="margin:10px 0 0;font-size:15px;line-height:1.55;color:#1e40af;">
      We previously met in <strong>307E</strong>. Facilities will post a notice on the old room door. Class time stays <strong>10:00 AM–12:00 PM</strong> Tue / Wed / Thu.
    </p>
  </div>

  <p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#0f172a;">This week’s schedule</p>

  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin:0 0 20px;">
    ${scheduleRow(
      "Tuesday<br/><span style=\"font-weight:500;color:#64748b;font-size:14px;\">July 28</span>",
      "<strong>LTspice session.</strong> We will work through simulation examples and tie them to course concepts. Bring your laptop if possible.",
      "#4f46e5",
    )}
    ${scheduleRow(
      "Wednesday<br/><span style=\"font-weight:500;color:#64748b;font-size:14px;\">July 29</span>",
      "<strong>Review with the TA.</strong> Bring questions from lectures, homework, quizzes, and both mid-semester exams.",
      "#0ea5e9",
    )}
    ${scheduleRow(
      "Thursday<br/><span style=\"font-weight:500;color:#64748b;font-size:14px;\">July 30</span>",
      "<strong>Comprehensive final exam</strong> — 10:00 AM–12:00 PM in <strong>Room 318</strong>. Arrive on time with your UH ID.",
      "#dc2626",
    )}
  </table>

  <div style="margin:0 0 20px;padding:14px 16px;background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;">
    <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#92400e;">Before Thursday’s final</p>
    <ul style="margin:0;padding-left:20px;color:#78350f;font-size:15px;line-height:1.6;">
      <li>Exam is <strong>in person</strong> at UH Katy — go to <strong>Room 318</strong>, not 307E.</li>
      <li>Follow syllabus exam rules: no talking or collaboration during the exam.</li>
      <li>Bring a calculator and any materials allowed under course policy.</li>
    </ul>
  </div>

  <div style="margin:24px 0;">
    <a href="${announcementsUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;font-size:15px;">View announcement in CourseCollab</a>
  </div>

  <p style="margin:0;font-size:15px;line-height:1.5;color:#64748b;">
    See you in Room 318.<br/>
    ${instructor}
  </p>
</div>`.trim()
}
