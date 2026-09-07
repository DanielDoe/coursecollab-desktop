/**
 * HTML email templates for CourseCollab
 * Branded, responsive templates with dark mode support
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://course-collab.com"

export function escapeHtmlForEmail(text: string): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function escapeHtml(text: string): string {
  return escapeHtmlForEmail(text)
}

const baseStyles = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.6;
  color: #334155;
  max-width: 600px;
  margin: 0 auto;
  -webkit-text-size-adjust: 100%;
`

const buttonStyles = (color = "#3b82f6") => `
  display: inline-block;
  padding: 14px 28px;
  background: ${color};
  color: white !important;
  text-decoration: none;
  border-radius: 10px;
  font-weight: 600;
  margin-top: 20px;
  font-size: 15px;
`

const cardStyles = (accentColor = "#3b82f6") => `
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-left: 4px solid ${accentColor};
  padding: 20px 24px;
  border-radius: 12px;
  margin: 20px 0;
`

const DARK_MODE_STYLES = `
@media (prefers-color-scheme: dark) {
  .email-body { background: #0f172a !important; }
  .email-wrapper { padding: 16px 12px !important; }
  .email-card { background: #1e293b !important; box-shadow: 0 4px 6px rgba(0,0,0,0.3) !important; }
  .email-content { color: #e2e8f0 !important; }
  .email-content h2 { color: #f8fafc !important; }
  .email-content p { color: #cbd5e1 !important; }
  .email-footer { background: #1e293b !important; border-top-color: #334155 !important; }
  .email-footer p, .email-footer a { color: #94a3b8 !important; }
  .email-footer a { color: #60a5fa !important; }
  .email-card-light { background: #334155 !important; }
  .email-table-wrap { background: #1e293b !important; border-color: #334155 !important; }
  .email-table th { background: #334155 !important; color: #f8fafc !important; }
  .email-table td { color: #cbd5e1 !important; border-color: #334155 !important; }
  .email-badge { background: linear-gradient(135deg,#334155 0%,#1e293b 100%) !important; border-color: #475569 !important; }
  .email-badge p { color: #94a3b8 !important; }
  .email-badge .email-badge-pct { color: #f8fafc !important; }
  .email-badge-danger { background: linear-gradient(135deg,#450a0a 0%,#7f1d1d 100%) !important; border-color: #b91c1c !important; }
  .email-badge-danger .badge-title { color: #fca5a5 !important; }
  .email-badge-danger .badge-value { color: #fecaca !important; }
  .email-amount { color: #4ade80 !important; }
  .email-pr-p, .email-pr-li, .email-pr-ul { color: #e2e8f0 !important; }
  .email-pr-h3 { color: #f8fafc !important; border-bottom-color: #475569 !important; }
  .email-pr-score-heading { color: #c4b5fd !important; }
  .email-pr-score-label { color: #94a3b8 !important; }
  .email-pr-score-value { color: #f8fafc !important; }
  .email-pr-row-label { color: #94a3b8 !important; background-color: #1e293b !important; border-color: #334155 !important; }
  .email-pr-row-value { color: #f8fafc !important; background-color: #1e293b !important; border-color: #334155 !important; }
  .email-pr-score-table { border-color: #334155 !important; }
  .email-pr-overall-row { background-color: #4c1d95 !important; border-color: #5b21b6 !important; }
  .email-pr-overall-row .email-pr-score-label { color: #ddd6fe !important; }
  .email-pr-overall-value { color: #ffffff !important; }
  .email-pr-pending-note { color: #94a3b8 !important; background-color: #0f172a !important; border-color: #334155 !important; }
  .email-pr-badge-letter { background: #7c3aed !important; color: #ffffff !important; }
  .email-pr-badge-provisional { background: #475569 !important; color: #f8fafc !important; }
  .email-pr-encourage { background: #14532d !important; background-color: #14532d !important; border-left-color: #22c55e !important; }
  .email-pr-encourage-title { color: #86efac !important; }
  .email-pr-encourage-text { color: #dcfce7 !important; }
  .email-pr-intro { color: #cbd5e1 !important; }
  .email-pr-footer-note { color: #94a3b8 !important; }
  .email-content h2.email-pr-title { color: #f8fafc !important; }
  .email-content p.email-pr-greeting { color: #cbd5e1 !important; }
}
[data-ogsc] .email-pr-p, [data-ogsc] .email-pr-li, [data-ogsc] .email-pr-ul { color: #e2e8f0 !important; }
[data-ogsc] .email-pr-h3 { color: #f8fafc !important; }
[data-ogsc] .email-pr-score-value { color: #f8fafc !important; }
[data-ogsc] .email-pr-row-label, [data-ogsc] .email-pr-row-value { background-color: #1e293b !important; border-color: #334155 !important; }
[data-ogsc] .email-pr-row-label { color: #94a3b8 !important; }
[data-ogsc] .email-pr-row-value { color: #f8fafc !important; }
[data-ogsc] .email-pr-overall-row { background-color: #4c1d95 !important; }
[data-ogsc] .email-pr-overall-value { color: #ffffff !important; }
[data-ogsc] .email-content h2 { color: #f8fafc !important; }
[data-ogsc] .email-content p { color: #cbd5e1 !important; }
@media screen and (max-width: 600px) {
  .email-wrapper { padding: 12px 8px !important; }
  .email-content { padding: 24px 20px !important; }
  .email-footer { padding: 16px 20px !important; }
  .email-header { padding: 24px 20px !important; }
  .email-header h1 { font-size: 20px !important; }
  .email-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .email-table { min-width: 0 !important; font-size: 13px !important; }
  .email-table th, .email-table td { padding: 10px 12px !important; }
}
`

function wrapEmail(content: string, title: string) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>${DARK_MODE_STYLES}</style>
</head>
<body class="email-body" style="margin:0;padding:0;background:#f1f5f9;">
  <div class="email-wrapper" style="padding:24px 16px;max-width:100%;box-sizing:border-box;">
    <div class="email-card" style="max-width:600px;width:100%;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.05);box-sizing:border-box;">
      <div class="email-header" style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:28px 32px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">CourseCollab</h1>
        <p style="margin:8px 0 0;color:#94a3b8;font-size:14px;">${title}</p>
      </div>
      <div class="email-content" style="padding:32px;${baseStyles}">
        ${content}
      </div>
      <div class="email-footer" style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="margin:0;font-size:12px;color:#64748b;">You received this because you're enrolled in CourseCollab.</p>
        <p style="margin:8px 0 0;font-size:12px;color:#64748b;"><a href="${BASE_URL}" style="color:#3b82f6;">Visit CourseCollab</a></p>
      </div>
    </div>
  </div>
</body>
</html>`
}

/** Light-only shell for rich instructor announcements — avoids iOS Mail dark-mode inversion. */
const LIGHT_ONLY_STYLES = `
:root { color-scheme: light only; supported-color-schemes: light; }
body, .email-body { background-color: #f3eef8 !important; }
.email-card { background-color: #ffffff !important; }
.email-content, .email-content p, .email-content li { color: #334155 !important; }
.email-light-panel { background-color: #f8f4fc !important; border-color: #d2c3eb !important; }
.email-light-warn { background-color: #fffbeb !important; border-color: #fde68a !important; }
.email-light-warn, .email-light-warn li { color: #78350f !important; }
@media (prefers-color-scheme: dark) {
  body, .email-body { background-color: #f3eef8 !important; }
  .email-card { background-color: #ffffff !important; }
  .email-content, .email-content p, .email-content li, .email-content strong { color: #334155 !important; }
  .email-header { background: #582c83 !important; }
  .email-footer { background: #f8fafc !important; }
  .email-light-panel { background-color: #f8f4fc !important; }
  .email-light-warn { background-color: #fffbeb !important; }
}
`

function wrapEmailLightOnly(content: string, title: string) {
  return `
<!DOCTYPE html>
<html lang="en" style="color-scheme:light only;">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>${LIGHT_ONLY_STYLES}</style>
</head>
<body class="email-body" style="margin:0;padding:0;background-color:#f3eef8 !important;color:#334155 !important;">
  <div class="email-wrapper" style="padding:24px 16px;max-width:100%;box-sizing:border-box;">
    <div class="email-card" style="max-width:600px;width:100%;margin:0 auto;background-color:#ffffff !important;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(88,44,131,0.08);box-sizing:border-box;">
      <div class="email-header" style="background-color:#582c83 !important;padding:24px 28px;text-align:center;">
        <h1 style="margin:0;color:#ffffff !important;font-size:22px;font-weight:700;">CourseCollab</h1>
        <p style="margin:8px 0 0;color:#e8dcf8 !important;font-size:14px;">${title}</p>
      </div>
      <div class="email-content" style="padding:28px;background-color:#ffffff !important;${baseStyles}color:#334155 !important;">
        ${content}
      </div>
      <div class="email-footer" style="padding:18px 28px;background-color:#f8fafc !important;border-top:1px solid #e2e8f0;text-align:center;">
        <p style="margin:0;font-size:12px;color:#64748b !important;">You received this because you're enrolled in CourseCollab.</p>
        <p style="margin:8px 0 0;font-size:12px;color:#64748b !important;"><a href="${BASE_URL}" style="color:#582c83 !important;">Visit CourseCollab</a></p>
      </div>
    </div>
  </div>
</body>
</html>`
}

export const emailTemplates = {
  account_verification: (name: string, link: string) => ({
    subject: "Verify your CourseCollab account",
    html: wrapEmail(`
      <h2 style="color:#1e293b;margin:0 0 16px;">Welcome, ${name}!</h2>
      <p>Please verify your account by clicking the button below:</p>
      <a href="${link}" style="${buttonStyles("#3b82f6")}">Verify Account</a>
      <p style="margin-top:24px;font-size:14px;color:#64748b;">If you didn't create an account, you can safely ignore this email.</p>
    `, "Account Verification"),
  }),

  password_reset: (link: string) => ({
    subject: "Reset your CourseCollab password",
    html: wrapEmail(`
      <h2 style="color:#1e293b;margin:0 0 16px;">Password Reset</h2>
      <p>You requested a password reset. Click below to set a new password:</p>
      <a href="${link}" style="${buttonStyles("#3b82f6")}">Reset Password</a>
      <p style="margin-top:24px;font-size:14px;color:#64748b;">This link expires in 1 hour.</p>
    `, "Password Reset"),
  }),

  /** Sent when an instructor or admin resets a student password to the default temporary password */
  student_password_reset_by_staff: (name: string, temporaryPassword: string, loginUrl: string) => {
    const n = escapeHtml(name)
    const pw = escapeHtml(temporaryPassword)
    return {
      subject: "Your CourseCollab password was reset — sign in with your temporary password",
      html: wrapEmail(
        `
      <h2 style="color:#1e293b;margin:0 0 12px;">Hi ${n},</h2>
      <p style="margin:0 0 20px;">Your instructor or an administrator reset your <strong>CourseCollab</strong> password. Use the temporary password below <strong>exactly as shown</strong> (capital letters and punctuation matter), then choose a new password right after you sign in.</p>

      <div class="email-card-light" style="${cardStyles("#7c3aed")}">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#5b21b6;text-transform:uppercase;letter-spacing:0.06em;">Temporary password</p>
        <p style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:22px;font-weight:700;color:#1e293b;letter-spacing:0.02em;">${pw}</p>
      </div>

      <a href="${loginUrl}" style="${buttonStyles("#7c3aed")}">Sign in to CourseCollab</a>

      <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e2e8f0;">
        <p style="margin:0 0 10px;font-size:14px;font-weight:600;color:#1e293b;">What to do next</p>
        <ol style="margin:0;padding-left:20px;color:#475569;font-size:14px;line-height:1.7;">
          <li>Open CourseCollab and sign in with your <strong>usual student ID</strong> (or roster login) and the temporary password above.</li>
          <li>You will be prompted to <strong>change your password</strong> — complete that step before doing coursework.</li>
          <li>Keep your new password private; do not share it or forward this email.</li>
        </ol>
      </div>

      <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;line-height:1.5;">
        <strong>Didn’t expect this?</strong> If you didn’t ask for a reset, contact your instructor immediately — someone else may have access to your account until you sign in and set a new password.
      </p>
    `,
        "Password reset by your instructor",
      ),
    }
  },

  quiz_available: (quizTitle: string) => ({
    subject: "New Quiz Available - CourseCollab",
    html: wrapEmail(`
      <h2 style="color:#1e293b;margin:0 0 16px;">New Quiz Posted</h2>
      <p>The quiz <strong>${quizTitle}</strong> is now available.</p>
      <a href="${BASE_URL}/student/dashboard-v2/quizzes" style="${buttonStyles("#3b82f6")}">View Quiz</a>
    `, "New Assessment"),
  }),

  grade_released: (name: string, assessmentTitle: string, score: string) => ({
    subject: "Your grade has been released - CourseCollab",
    html: wrapEmail(`
      <h2 style="color:#1e293b;margin:0 0 16px;">Grade Released</h2>
      <p>Hi ${name},</p>
      <p>Your grade for <strong>${assessmentTitle}</strong> has been released.</p>
      <p><strong>Score: ${score}</strong></p>
      <a href="${BASE_URL}/student/dashboard-v2" style="${buttonStyles("#3b82f6")}">View Results</a>
    `, "Grade Released"),
  }),

  grades_updated: (
    name: string,
    assessmentTitle: string,
    assessmentTypeLabel: string,
    score: string,
    totalPoints: string,
    percentage: string,
    reportLink: string
  ) => {
    const isPassing = parseFloat(percentage) >= 70
    const accentColor = isPassing ? "#22c55e" : "#f59e0b"
    return {
      subject: `📊 Your ${assessmentTypeLabel} grade has been updated - CourseCollab`,
      html: wrapEmail(`
        <div style="text-align:center;margin-bottom:24px;">
          <div class="email-badge" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,${accentColor}22 0%,${accentColor}11 100%);border-radius:16px;border:2px solid ${accentColor};">
            <p style="margin:0;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#64748b;font-weight:600;">Grade Updated</p>
            <p class="email-badge-pct" style="margin:8px 0 0;font-size:32px;font-weight:800;color:${accentColor};">${percentage}%</p>
            <p style="margin:4px 0 0;font-size:14px;color:#64748b;">${score} / ${totalPoints} points</p>
          </div>
        </div>
        <h2 style="color:#1e293b;margin:0 0 16px;">Your ${assessmentTypeLabel} grade has been updated</h2>
        <p>Hi ${name},</p>
        <p>Your instructor has updated your grade for <strong>${assessmentTitle}</strong>. Your revised score is now reflected in the system.</p>
        <div class="email-card-light" style="${cardStyles(accentColor)}">
          <p style="margin:0 0 8px;font-weight:600;font-size:16px;">${assessmentTitle}</p>
          <p style="margin:0;font-size:20px;"><strong>${score} / ${totalPoints}</strong> (${percentage}%)</p>
        </div>
        <p style="margin:20px 0 0;font-size:15px;color:#475569;"><strong>📥 Important:</strong> Please re-download your report to get the latest version with your updated grade and feedback.</p>
        <a href="${reportLink}" style="${buttonStyles(accentColor)}">View Report & Re-Download PDF</a>
        <p style="margin-top:24px;font-size:13px;color:#64748b;">If you have any questions about your grade, please reach out to your instructor.</p>
      `, "Grades Updated"),
    }
  },

  project_invite: (name: string, projectName: string, inviterName: string, link: string) => ({
    subject: `You're invited to join "${projectName}" - CourseCollab`,
    html: wrapEmail(`
      <h2 style="color:#1e293b;margin:0 0 16px;">Project Invitation</h2>
      <p>Hi ${name},</p>
      <p><strong>${inviterName}</strong> has invited you to join <strong>${projectName}</strong>.</p>
      <a href="${link}" style="${buttonStyles("#3b82f6")}">Accept Invitation</a>
    `, "Project Invitation"),
  }),

  announcement: (title: string, message: string, link?: string, messageHtml?: string) => {
    const rich = typeof messageHtml === "string" && messageHtml.trim() !== ""
    const body = rich
      ? messageHtml
      : `<h2 style="color:#1e293b;margin:0 0 16px;">${escapeHtml(title)}</h2>
      <div style="white-space:pre-wrap;">${message}</div>`
    const wrap = rich ? wrapEmailLightOnly : wrapEmail
    return {
      subject: `${title} - CourseCollab`,
      html: wrap(
        `
      ${body}
      ${!rich && link ? `<a href="${escapeHtml(link)}" style="${buttonStyles("#3b82f6")}">View Details</a>` : ""}
    `,
        escapeHtml(title),
      ),
    }
  },

  instructor_broadcast: (subjectLine: string, bodyHtml: string) => ({
    subject: subjectLine.trim(),
    html: wrapEmail(bodyHtml, "Message from your instructor"),
  }),

  assessment_completed: (
    name: string,
    assessmentType: "quiz" | "homework" | "mid-semester" | "final" | "code submission",
    assessmentTitle: string,
    score: string,
    maxScore: string,
    link: string
  ) => {
    const typeLabels: Record<string, string> = {
      quiz: "Quiz",
      homework: "Homework",
      "mid-semester": "Mid-Semester Exam",
      final: "Final Exam",
      "code submission": "Code Submission",
    }
    const label = typeLabels[assessmentType] || assessmentType
    const percent = maxScore ? Math.round((parseFloat(score) / parseFloat(maxScore)) * 100) : 0
    const isPassing = percent >= 70
    return {
      subject: `You completed ${assessmentTitle} - CourseCollab`,
      html: wrapEmail(`
        <h2 style="color:#1e293b;margin:0 0 16px;">Assessment Submitted</h2>
        <p>Hi ${name},</p>
        <p>You've successfully completed your <strong>${label}</strong>:</p>
        <div class="email-card-light" style="${cardStyles(isPassing ? "#22c55e" : "#3b82f6")}">
          <p style="margin:0 0 8px;font-weight:600;">${assessmentTitle}</p>
          <p style="margin:0;font-size:18px;"><strong>${score} / ${maxScore}</strong> (${percent}%)</p>
        </div>
        <a href="${link}" style="${buttonStyles("#22c55e")}">View Details</a>
      `, "Assessment Completed"),
    }
  },

  new_assessment: (
    name: string,
    assessmentType: "quiz" | "homework" | "mid-semester" | "final" | "code submission",
    assessmentTitle: string,
    dueDate: string | null,
    link: string
  ) => {
    const typeLabels: Record<string, string> = {
      quiz: "Quiz",
      homework: "Homework",
      "mid-semester": "Mid-Semester Exam",
      final: "Final Exam",
      "code submission": "Code Submission",
    }
    const label = typeLabels[assessmentType] || assessmentType
    return {
      subject: `New ${label}: ${assessmentTitle} - CourseCollab`,
      html: wrapEmail(`
        <h2 style="color:#1e293b;margin:0 0 16px;">New ${label} Available</h2>
        <p>Hi ${name},</p>
        <p>A new <strong>${label}</strong> has been posted:</p>
        <div class="email-card-light" style="${cardStyles("#3b82f6")}">
          <p style="margin:0 0 8px;font-weight:600;">${assessmentTitle}</p>
          ${dueDate ? `<p style="margin:0;font-size:14px;color:#64748b;">Due: ${dueDate}</p>` : ""}
        </div>
        <a href="${link}" style="${buttonStyles("#3b82f6")}">View & Complete</a>
      `, "New Assessment"),
    }
  },

  payment_success: (
    name: string,
    amount: string,
    description: string,
    link: string
  ) => ({
    subject: "Payment successful - CourseCollab",
    html: wrapEmail(`
      <h2 style="color:#1e293b;margin:0 0 16px;">Payment Received</h2>
      <p>Hi ${name},</p>
      <p>Thank you for your payment. Your transaction was successful.</p>
      <div class="email-card-light" style="${cardStyles("#22c55e")}">
        <p style="margin:0 0 8px;font-weight:600;">${description}</p>
        <p class="email-amount" style="margin:0;font-size:20px;color:#16a34a;"><strong>$${amount}</strong></p>
      </div>
      <a href="${link}" style="${buttonStyles("#22c55e")}">View Membership</a>
    `, "Payment Confirmation"),
  }),

  missed_deadline: (
    name: string,
    assessmentType: string,
    assessmentTitle: string,
    deadline: string,
    link: string
  ) => ({
    subject: `Missed deadline: ${assessmentTitle} - CourseCollab`,
    html: wrapEmail(`
      <h2 style="color:#1e293b;margin:0 0 16px;">Deadline Passed</h2>
      <p>Hi ${name},</p>
      <p>The deadline for the following assessment has passed:</p>
      <div class="email-card-light" style="${cardStyles("#ef4444")}">
        <p style="margin:0 0 8px;font-weight:600;">${assessmentTitle}</p>
        <p style="margin:0;font-size:14px;color:#64748b;">${assessmentType} · Was due: ${deadline}</p>
      </div>
      <p>Contact your instructor if you have extenuating circumstances.</p>
      <a href="${link}" style="${buttonStyles("#64748b")}">View Dashboard</a>
    `, "Missed Deadline"),
  }),

  missed_assessments_summary: (
    name: string,
    assessmentCount: number,
    tableRowsHtml: string,
    dashboardLink: string
  ) => ({
    subject: `📋 Missed Assessments Summary – ${assessmentCount} item${assessmentCount === 1 ? "" : "s"} – CourseCollab`,
    html: wrapEmail(`
      <div style="text-align:center;margin-bottom:24px;">
        <div class="email-badge-danger" style="display:inline-block;padding:16px 28px;background:linear-gradient(135deg,#fef2f2 0%,#fee2e2 100%);border-radius:16px;border:2px solid #ef4444;">
          <p class="badge-title" style="margin:0;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#b91c1c;font-weight:600;">Action Required</p>
          <p class="badge-value" style="margin:8px 0 0;font-size:28px;font-weight:800;color:#dc2626;">${assessmentCount} Missed</p>
          <p style="margin:4px 0 0;font-size:14px;color:#64748b;">assessment${assessmentCount === 1 ? "" : "s"}</p>
        </div>
      </div>
      <h2 style="color:#1e293b;margin:0 0 16px;">Hi ${name},</h2>
      <p style="margin:0 0 20px;">Below is a detailed breakdown of the assessments you missed this semester. Please review and reach out to your instructor if you have extenuating circumstances or questions about makeup options.</p>
      <div class="email-table-wrap" style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;margin:24px 0;">
        <table class="email-table" style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#fff;">
              <th style="padding:14px 16px;text-align:left;font-weight:600;">Type</th>
              <th style="padding:14px 16px;text-align:left;font-weight:600;">Assessment</th>
              <th style="padding:14px 16px;text-align:left;font-weight:600;">Available</th>
              <th style="padding:14px 16px;text-align:left;font-weight:600;">Due</th>
              <th style="padding:14px 16px;text-align:left;font-weight:600;">Score</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </div>
      <p style="margin:20px 0 0;font-size:14px;color:#475569;"><strong>💡 Next steps:</strong> Contact your instructor to discuss makeup options or late submission policies. Check your dashboard regularly for new assignments.</p>
      <a href="${dashboardLink}" style="${buttonStyles("#3b82f6")}">View Dashboard</a>
    `, "Missed Assessments Summary"),
  }),

  trade_center_instructor_alert: (
    title: string,
    bodyHtml: string,
    linkLabel: string,
    linkUrl: string
  ) => ({
    subject: `${title} - CourseCollab`,
    html: wrapEmail(`
      <h2 style="color:#1e293b;margin:0 0 16px;">${title}</h2>
      <div class="email-content">${bodyHtml}</div>
      <a href="${linkUrl}" style="${buttonStyles("#0d9488")}">${linkLabel}</a>
      <p style="margin-top:20px;font-size:14px;color:#64748b;">You can approve or reject pending transfers from the Trade Center.</p>
    `, "Trade Center"),
  }),

  course_exchange_faculty_alert: (
    title: string,
    bodyHtml: string,
    linkLabel: string,
    linkUrl: string,
    footerNote?: string,
  ) => ({
    subject: `${title} - CourseCollab`,
    html: wrapEmail(`
      <h2 style="color:#1e293b;margin:0 0 16px;">${title}</h2>
      <div class="email-content">${bodyHtml}</div>
      <a href="${linkUrl}" style="${buttonStyles("#582c83")}">${linkLabel}</a>
      <p style="margin-top:20px;font-size:14px;color:#64748b;">${
        footerNote ?? "Sign in to CourseCollab to review this Course Exchange request."
      }</p>
    `, "Course Exchange"),
  }),

  trade_center_peer_transfer_done: (name: string, introHtml: string, dashboardLink: string) => ({
    subject: "Peer point transfer completed - CourseCollab",
    html: wrapEmail(`
      <h2 style="color:#1e293b;margin:0 0 16px;">Hi ${name},</h2>
      <div class="email-content">${introHtml}</div>
      <a href="${dashboardLink}" style="${buttonStyles("#6366f1")}">Open Trade Center</a>
    `, "Transfer complete"),
  }),

  recommendation_student_update: (
    studentFirstName: string,
    subjectLine: string,
    title: string,
    bodySectionsHtml: string,
    linkUrl: string,
    linkLabel: string,
  ) => {
    const subj =
      subjectLine.includes("CourseCollab") ? subjectLine : `${subjectLine} — CourseCollab`
    const n = escapeHtml(studentFirstName)
    const ttl = escapeHtml(title)
    return {
      subject: subj,
      html: wrapEmail(`
      <h2 style="color:#1e293b;margin:0 0 14px;font-size:19px;line-height:1.25;">${ttl}</h2>
      <p style="margin:0 0 14px;color:#475569;font-size:15px;">Hi ${n},</p>
      ${bodySectionsHtml}
      <a href="${escapeHtml(linkUrl)}" style="${buttonStyles("#582c83")}">${escapeHtml(linkLabel)}</a>
      <p style="margin:22px 0 0;font-size:13px;color:#64748b;line-height:1.55;">Questions? Reply to your instructor directly &mdash; CourseCollab only sends automated notices for milestones.</p>
    `, "Recommendation letter"),
    }
  },

  recommendation_instructor_update: (
    instructorDisplayName: string,
    subjectLine: string,
    title: string,
    bodySectionsHtml: string,
    linkUrl: string,
    linkLabel: string,
  ) => {
    const subj =
      subjectLine.includes("CourseCollab") ? subjectLine : `${subjectLine} — CourseCollab`
    const n = escapeHtml(instructorDisplayName)
    const ttl = escapeHtml(title)
    return {
      subject: subj,
      html: wrapEmail(`
      <h2 style="color:#1e293b;margin:0 0 14px;font-size:19px;line-height:1.25;">${ttl}</h2>
      <p style="margin:0 0 14px;color:#475569;font-size:15px;">Hi ${n},</p>
      ${bodySectionsHtml}
      <a href="${escapeHtml(linkUrl)}" style="${buttonStyles("#0d9488")}">${escapeHtml(linkLabel)}</a>
      <p style="margin:22px 0 0;font-size:13px;color:#64748b;line-height:1.55;">Students receive their own emails at each milestone. Use CourseCollab to review requests, approve drafts, and finalize the official PDF.</p>
    `, "Recommendation (instructor)"),
    }
  },

  direct_message: (
    recipientName: string,
    senderName: string,
    subject: string,
    bodyPreview: string,
    linkUrl: string,
  ) => ({
    subject: `${subject} — CourseCollab`,
    html: wrapEmail(
      `
      <p style="margin:0 0 12px;color:#334155;">Hi ${escapeHtml(recipientName)},</p>
      <p style="margin:0 0 16px;color:#334155;"><strong>${escapeHtml(senderName)}</strong> sent you a message on CourseCollab.</p>
      <div style="${cardStyles("#582c83")}">
        <p style="margin:0 0 8px;font-weight:600;color:#1e293b;">${escapeHtml(subject)}</p>
        <p style="margin:0;white-space:pre-wrap;color:#475569;">${escapeHtml(bodyPreview)}</p>
      </div>
      <a href="${escapeHtml(linkUrl)}" style="${buttonStyles("#582c83")}">Open Messages</a>
      <p style="margin:20px 0 0;font-size:13px;color:#64748b;">You received this email because messaging notifications are enabled. Reply in CourseCollab to continue the conversation.</p>
    `,
      "New message",
    ),
  }),

  midterm_progress_review: (
    studentFirstName: string,
    subjectLine: string,
    title: string,
    bodySectionsHtml: string,
    linkUrl: string,
    linkLabel: string,
  ) => {
    const subj =
      subjectLine.includes("CourseCollab") ? subjectLine : `${subjectLine} — CourseCollab`
    const n = escapeHtml(studentFirstName)
    const ttl = escapeHtml(title)
    return {
      subject: subj,
      html: wrapEmail(`
      <h2 class="email-pr-title" style="color:#0f172a;margin:0 0 14px;font-size:19px;line-height:1.25;">${ttl}</h2>
      <p class="email-pr-greeting" style="margin:0 0 14px;color:#334155;font-size:15px;">Hi ${n},</p>
      <p class="email-pr-intro" style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.65;">Your instructor prepared this personalized progress review based on your assessments, practice work, classroom participation, and attendance. Use it to plan your next steps in the course.</p>
      ${bodySectionsHtml}
      <a href="${escapeHtml(linkUrl)}" style="${buttonStyles("#2563eb")}">${escapeHtml(linkLabel)}</a>
      <p class="email-pr-footer-note" style="margin:22px 0 0;font-size:13px;color:#64748b;line-height:1.55;">Questions about your review? Reply to your instructor or visit office hours.</p>
    `, "Progress Review"),
    }
  },
}
