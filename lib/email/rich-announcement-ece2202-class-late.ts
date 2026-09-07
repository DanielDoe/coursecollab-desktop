import { escapeHtmlForEmail } from "@/lib/email/emailTemplates"

export const ECE2202_CLASS_LATE_SUBJECT =
  "ECE 2202 — class will start ~10–15 minutes late today"

export function buildEce2202ClassLateAnnouncementHtml(opts: {
  baseUrl: string
  instructorName?: string
}): string {
  const base = opts.baseUrl.replace(/\/$/, "")
  const instructor = escapeHtmlForEmail(opts.instructorName?.trim() || "Dr. Doe")
  const lecturesUrl = `${base}/student/dashboard-v2/lectures`
  const classroomUrl = `${base}/student/dashboard-v2/classroom-points`

  return `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;color:#0f172a;">
  <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">Hello ECE 2202 students,</p>

  <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">
    I will be <strong>about 10–15 minutes late</strong> for class today. I apologize for the inconvenience.
  </p>

  <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">
    While you wait, please use the time productively:
  </p>

  <ul style="margin:0 0 20px;padding-left:22px;line-height:1.6;color:#334155;font-size:16px;">
    <li style="margin-bottom:8px;">Review <strong>Lecture 6</strong> materials in CourseCollab</li>
    <li style="margin-bottom:8px;">Work on any open <strong>Classroom Points</strong> submissions</li>
  </ul>

  <div style="margin:24px 0;display:flex;flex-wrap:wrap;gap:12px;">
    <a href="${lecturesUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;font-size:15px;">Open Lectures</a>
    <a href="${classroomUrl}" style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;font-size:15px;">Classroom Points</a>
  </div>

  <p style="margin:0;font-size:15px;line-height:1.5;color:#64748b;">
    Thank you for your patience — see you shortly.<br/>
    ${instructor}
  </p>
</div>`.trim()
}
