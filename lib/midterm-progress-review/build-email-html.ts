import { escapeHtmlForEmail } from "@/lib/email/emailTemplates"
import type { ProgressReviewSections, StudentProgressData } from "./types"

function p(text: string): string {
  return `<p class="email-pr-p" style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.65;">${escapeHtmlForEmail(text)}</p>`
}

function h3(title: string): string {
  return `<h3 class="email-pr-h3" style="margin:24px 0 10px;color:#0f172a;font-size:16px;font-weight:700;border-bottom:2px solid #e2e8f0;padding-bottom:6px;">${escapeHtmlForEmail(title)}</h3>`
}

function bulletList(items: string[]): string {
  if (items.length === 0) return ""
  const lis = items
    .map(
      (line) =>
        `<li class="email-pr-li" style="margin:8px 0;color:#334155;">${escapeHtmlForEmail(line)}</li>`,
    )
    .join("")
  return `<ul class="email-pr-ul" style="margin:0 0 18px;padding-left:20px;color:#334155;font-size:15px;line-height:1.55;">${lis}</ul>`
}

function scoreCard(data: StudentProgressData): string {
  const gb = data.gradebook
  if (!gb) return ""

  const formatValue = (
    label: string,
    status: "scored" | "pending" | undefined,
    score: number,
  ): { text: string; pending: boolean } => {
    if (status === "pending") return { text: "Pending", pending: true }
    if (label === "Practice") return { text: `${score.toFixed(0)} cr`, pending: false }
    return { text: `${score.toFixed(1)}%`, pending: false }
  }

  const rows: Array<[string, number, "scored" | "pending" | undefined]> = [
    ["Quiz", gb.quizScore, gb.categoryStatus?.quiz],
    ["Homework", gb.homeworkScore, gb.categoryStatus?.homework],
    ["Midterm", gb.midtermScore, gb.categoryStatus?.midterm],
    ["Attendance", gb.attendanceScore, gb.categoryStatus?.attendance],
    ["Classroom", gb.classroomScore, gb.categoryStatus?.classroom],
    ["Practice", gb.engagementCredits, gb.categoryStatus?.engagement],
  ]

  const statusBadge = gb.letterGrade
    ? `<span class="email-pr-badge-letter" style="display:inline-block;padding:5px 12px;background:#582c83;color:#ffffff;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:0.02em;">${escapeHtmlForEmail(gb.letterGrade)}</span>`
    : gb.gradeIsProvisional
      ? `<span class="email-pr-badge-provisional" style="display:inline-block;padding:5px 12px;background:#e2e8f0;color:#475569;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">In progress</span>`
      : ""

  const pendingNote =
    gb.gradeIsProvisional && gb.pendingCategories.length > 0
      ? `<p class="email-pr-pending-note" style="margin:0;padding:10px 14px;font-size:12px;color:#64748b;line-height:1.5;background:#f8fafc;border-top:1px solid #e2e8f0;">Reflects graded work only. Still pending: ${escapeHtmlForEmail(gb.pendingCategories.join(", "))}.</p>`
      : ""

  const bodyRows = rows
    .map(([label, val, status], idx) => {
      const { text, pending } = formatValue(label, status, val)
      const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc"
      const valueColor = pending ? "#64748b" : "#0f172a"
      const valueStyle = pending ? "font-style:italic;font-weight:600;" : "font-weight:700;"
      return `<tr>
        <td class="email-pr-row-label" bgcolor="${bg}" style="padding:11px 16px;font-size:14px;color:#475569;border-bottom:1px solid #e2e8f0;background-color:${bg};width:58%;">${escapeHtmlForEmail(label)}</td>
        <td class="email-pr-row-value" bgcolor="${bg}" align="right" style="padding:11px 16px;font-size:15px;color:${valueColor};border-bottom:1px solid #e2e8f0;background-color:${bg};width:42%;${valueStyle}">${escapeHtmlForEmail(text)}</td>
      </tr>`
    })
    .join("")

  return `
<div class="email-pr-score-card" style="margin:18px 0 22px;max-width:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 10px;">
    <tr>
      <td style="padding:0;vertical-align:middle;">
        <span class="email-pr-score-heading" style="font-size:12px;font-weight:700;color:#582c83;text-transform:uppercase;letter-spacing:0.08em;">Grade snapshot</span>
      </td>
      <td align="right" style="padding:0;vertical-align:middle;">${statusBadge}</td>
    </tr>
  </table>

  <table class="email-pr-score-table" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    <tr>
      <td colspan="2" class="email-pr-overall-row" bgcolor="#582c83" style="padding:18px 16px;background-color:#582c83;text-align:center;border-bottom:1px solid #4c1d95;">
        <div class="email-pr-score-label" style="font-size:11px;color:#ddd6fe;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;margin-bottom:4px;">Overall (so far)</div>
        <div class="email-pr-overall-value" style="font-size:32px;font-weight:800;color:#ffffff;line-height:1.1;letter-spacing:-0.02em;">${escapeHtmlForEmail(gb.totalScore.toFixed(1))}<span style="font-size:18px;font-weight:600;opacity:0.85;">%</span></div>
      </td>
    </tr>
    ${bodyRows}
  </table>
  ${pendingNote}
</div>`
}

function encouragementBox(text: string): string {
  return `
<div class="email-pr-encourage" style="margin:20px 0;padding:18px 20px;background-color:#f0fdf4;background:linear-gradient(135deg,#f0fdf4 0%,#ecfdf5 100%);border-left:4px solid #16a34a;border-radius:10px;">
  <p class="email-pr-encourage-title" style="margin:0 0 4px;font-size:11px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:0.08em;">Encouragement</p>
  <p class="email-pr-encourage-text" style="margin:0;font-size:15px;color:#166534;line-height:1.6;">${escapeHtmlForEmail(text)}</p>
</div>`
}

export function buildProgressReviewEmailHtml(
  sections: ProgressReviewSections,
  data: StudentProgressData,
): string {
  return (
    scoreCard(data) +
    p(sections.overallSummary) +
    h3("What You're Doing Well") +
    bulletList(sections.strengths) +
    h3("Where to Focus Next") +
    bulletList(sections.areasToImprove) +
    h3("Assessments & Feedback") +
    p(sections.assessmentFeedback) +
    h3("Practice Hub & Lecture Practice") +
    p(sections.practiceFeedback) +
    h3("Attendance") +
    p(sections.attendanceFeedback) +
    h3("Classroom Participation") +
    p(sections.classroomFeedback) +
    h3("Your Action Plan") +
    bulletList(sections.actionPlan) +
    encouragementBox(sections.encouragement)
  )
}

export function buildProgressReviewAnnouncementContent(
  sections: ProgressReviewSections,
  data: StudentProgressData,
): string {
  const fn = data.student.fullName.split(/\s+/)[0] ?? "Student"
  const periodLabel =
    data.reviewPeriod === "final"
      ? "finals progress review"
      : data.reviewPeriod === "custom"
        ? "progress review"
        : "progress review"
  const gb = data.gradebook
  const lines = [
    `Hi ${fn}, your personalized ${periodLabel} is ready.`,
    "",
    sections.overallSummary,
    "",
    "**Strengths**",
    ...sections.strengths.map((s) => `- ${s}`),
    "",
    "**Areas to Improve**",
    ...sections.areasToImprove.map((s) => `- ${s}`),
    "",
    "**Assessments**",
    sections.assessmentFeedback,
    "",
    "**Practice**",
    sections.practiceFeedback,
    "",
    "**Attendance**",
    sections.attendanceFeedback,
    "",
    "**Classroom**",
    sections.classroomFeedback,
    "",
    "**Action Plan**",
    ...sections.actionPlan.map((s) => `- ${s}`),
    "",
    sections.encouragement,
  ]
  if (gb) {
    const overallLine = gb.gradeIsProvisional
      ? `Overall (graded work so far): **${gb.totalScore.toFixed(1)}%** — not a final course grade${gb.pendingCategories.length ? `; pending: ${gb.pendingCategories.join(", ")}` : ""}`
      : `Overall: **${gb.totalScore.toFixed(1)}%**${gb.letterGrade ? ` (${gb.letterGrade})` : ""}`
    lines.splice(2, 0, overallLine, "")
  }
  return lines.join("\n")
}

export function buildNotificationPreview(sections: ProgressReviewSections): string {
  const summary = sections.overallSummary.trim()
  return summary.length > 150 ? `${summary.slice(0, 147)}…` : summary
}
