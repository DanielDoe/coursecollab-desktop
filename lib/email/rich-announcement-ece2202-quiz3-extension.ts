import { escapeHtmlForEmail } from "@/lib/email/emailTemplates"
import { studentFirstNameFromFullName } from "@/lib/email/rich-announcement-ece2202-welcome"

export const ECE2202_QUIZ3_EXTENSION_SUBJECT =
  "ECE 2202 — Quiz 3 is now available for you (24-hour extension)"

export function buildEce2202Quiz3ExtensionHtml(opts: {
  studentFullName: string
  baseUrl: string
  extensionExpiresLabel: string
  instructorName?: string
}): string {
  const firstName = escapeHtmlForEmail(studentFirstNameFromFullName(opts.studentFullName))
  const base = opts.baseUrl.replace(/\/$/, "")
  const quizzesUrl = `${base}/student/dashboard-v2/quizzes`
  const instructor = escapeHtmlForEmail(opts.instructorName?.trim() || "Dr. Doe")
  const expires = escapeHtmlForEmail(opts.extensionExpiresLabel)

  return `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;color:#0f172a;">
  <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">Hi ${firstName},</p>

  <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">
    You now have access to <strong>ECE 2202 - Quiz 3</strong> on CourseCollab. I have granted you a
    <strong>24-hour extension</strong> to complete it.
  </p>

  <div style="margin:20px 0;padding:16px 18px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;">
    <p style="margin:0;font-size:15px;line-height:1.55;color:#1e3a8a;">
      <strong>Complete Quiz 3 by:</strong> ${expires}
    </p>
  </div>

  <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">
    Open the <strong>Quizzes</strong> page, find <strong>Quiz 3</strong>, and select <strong>Start Quiz</strong>
    (or <strong>Open Quiz</strong> if you already began). Section II includes circuit submission problems — upload your worked solutions.
  </p>

  <div style="margin:24px 0;">
    <a href="${quizzesUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;font-size:15px;">Open Quizzes</a>
  </div>

  <p style="margin:0;font-size:15px;line-height:1.5;color:#64748b;">
    If Quiz 3 does not appear right away, refresh the page or sign out and back in once.<br/>
    ${instructor}
  </p>
</div>`.trim()
}
