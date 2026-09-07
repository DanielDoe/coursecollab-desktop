/**
 * Rich HTML — Fall 2026 ELEG students: submit schedule-adjustment availability.
 */
import { escapeHtmlForEmail } from "@/lib/email/emailTemplates"
import { studentFirstNameFromFullName } from "@/lib/email/rich-announcement-ece2202-welcome"

export type ElegFall2026ScheduleAvailabilityEmailOpts = {
  studentFirstName: string
  sessionCode: string
  courseCode: string
  courseTitle: string
  authUniversityUrl: string
  scheduleAdjustmentUrl: string
  scheduleAdjustmentDirectUrl?: string | null
  pollLabel?: string | null
  pollCount?: number
  deadlineLabel?: string | null
  instructorName?: string
  instructorEmail?: string
  term?: string
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

export function buildElegFall2026ScheduleAvailabilityEmailHtml(
  opts: ElegFall2026ScheduleAvailabilityEmailOpts,
): string {
  const name = escapeHtmlForEmail(opts.studentFirstName || "there")
  const sessionCode = escapeHtmlForEmail(opts.sessionCode)
  const courseCode = escapeHtmlForEmail(formatCourseCode(opts.courseCode))
  const courseTitle = escapeHtmlForEmail(opts.courseTitle)
  const section = escapeHtmlForEmail(sectionLabel(opts.sessionCode))
  const authUniversityUrl = escapeHtmlForEmail(opts.authUniversityUrl)
  const scheduleAdjustmentUrl = escapeHtmlForEmail(
    opts.scheduleAdjustmentDirectUrl?.trim() || opts.scheduleAdjustmentUrl,
  )
  const pollLabel = escapeHtmlForEmail(opts.pollLabel?.trim() || "Schedule adjustment availability poll")
  const pollCount = opts.pollCount ?? 1
  const deadlineLabel = opts.deadlineLabel?.trim()
    ? escapeHtmlForEmail(opts.deadlineLabel)
    : null
  const term = escapeHtmlForEmail(opts.term ?? "Fall 2026")
  const instructorName = escapeHtmlForEmail(opts.instructorName ?? "Daniel Doe")
  const instructorEmail = escapeHtmlForEmail(opts.instructorEmail ?? "dmdoe@pvamu.edu")

  const p = (text: string) =>
    `<p style="margin:0 0 14px;color:#334155;font-size:16px;line-height:1.65;">${text}</p>`
  const li = (text: string) =>
    `<li style="margin:0 0 10px;color:#334155;font-size:15px;line-height:1.6;">${text}</li>`

  const deadlineBlock = deadlineLabel
    ? `<p style="margin:8px 0 0;color:#312e81;font-size:15px;line-height:1.6;">Please respond by <strong>${escapeHtmlForEmail(deadlineLabel)}</strong>.</p>`
    : `<p style="margin:8px 0 0;color:#312e81;font-size:15px;line-height:1.6;">Please respond as soon as possible so we can review options before the department approval step.</p>`

  const multiPollNote =
    pollCount > 1
      ? `<p style="margin:8px 0 0;color:#312e81;font-size:15px;line-height:1.6;">Your section has <strong>${pollCount} active polls</strong> (for example lecture and laboratory). Complete <strong>each one</strong>.</p>`
      : ""

  return `
${p(`Hi <strong>${name}</strong>,`)}

${p(
  `For <strong>${courseCode} (${courseTitle})</strong>, section <strong>${section}</strong> (${sessionCode}), we are exploring a move from <strong>evening/night lab or class times</strong> into <strong>daytime hours (8:00 AM–5:00 PM, Monday–Thursday)</strong>. Your input is required before we can finalize any change.`,
)}

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border-collapse:collapse;">
  <tr>
    <td style="background:linear-gradient(135deg,#ecfeff 0%,#cffafe 100%);border-radius:14px;padding:18px 22px;border:1px solid #67e8f9;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#0e7490;text-transform:uppercase;letter-spacing:0.04em;">Action required</p>
      <p style="margin:0;color:#164e63;font-size:16px;line-height:1.6;">Sign in to CourseCollab and submit your availability in the <strong>${pollLabel}</strong>. Mark every daytime slot when you could attend lab/class, and note any times that absolutely will not work.</p>
      ${multiPollNote}
      ${deadlineBlock}
    </td>
  </tr>
</table>

<h2 style="margin:28px 0 12px;font-size:18px;color:#0f172a;font-weight:700;">How to submit your availability</h2>
<ol style="margin:0 0 20px;padding-left:22px;">
  ${li(`Sign in at <a href="${authUniversityUrl}" style="color:#2563eb;font-weight:600;">${authUniversityUrl}</a> → select <strong>Prairie View A&amp;M University</strong> → <strong>Login</strong> with your Student ID or @pvamu.edu email.`)}
  ${li(`Open <a href="${scheduleAdjustmentUrl}" style="color:#2563eb;font-weight:600;">Schedule Adjustment</a> (Course Info in the student portal).`)}
  ${li(`Open the active poll for your section and tap the time slots when you are <strong>available</strong> during daytime hours.`)}
  ${li(`Submit your responses before the poll closes. If you are enrolled in more than one ELEG section, complete each poll that applies to you.`)}
</ol>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border-collapse:collapse;">
  <tr>
    <td style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:0 12px 12px 0;padding:16px 20px;">
      <p style="margin:0;font-size:15px;color:#1e3a8a;line-height:1.6;">This poll does <strong>not</strong> change your schedule yet — it only collects availability so we can identify feasible daytime options and seek department approval before any final move.</p>
    </td>
  </tr>
</table>

${p(
  `Questions? Reply to this email or contact ${instructorName} at <a href="mailto:${instructorEmail}" style="color:#2563eb;">${instructorEmail}</a>.`,
)}

${p(`Thank you for responding quickly — it helps us find a time that works for the class.<br/><br/><strong>${instructorName}</strong><br/>CourseCollab · ${courseCode} · ${term}`)}
`.trim()
}

export const ELEG_FALL2026_SCHEDULE_AVAILABILITY_SUBJECT =
  "Action needed: submit your class availability on CourseCollab (Fall 2026 ELEG)"

export function buildElegFall2026SchedulePollLiveEmailHtml(
  opts: ElegFall2026ScheduleAvailabilityEmailOpts,
): string {
  const name = escapeHtmlForEmail(opts.studentFirstName || "there")
  const sessionCode = escapeHtmlForEmail(opts.sessionCode)
  const courseCode = escapeHtmlForEmail(formatCourseCode(opts.courseCode))
  const courseTitle = escapeHtmlForEmail(opts.courseTitle)
  const section = escapeHtmlForEmail(sectionLabel(opts.sessionCode))
  const authUniversityUrl = escapeHtmlForEmail(opts.authUniversityUrl)
  const scheduleAdjustmentUrl = escapeHtmlForEmail(opts.scheduleAdjustmentUrl)
  const pollCount = opts.pollCount ?? 1
  const deadlineLabel = opts.deadlineLabel?.trim()
    ? escapeHtmlForEmail(opts.deadlineLabel)
    : null
  const term = escapeHtmlForEmail(opts.term ?? "Fall 2026")
  const instructorName = escapeHtmlForEmail(opts.instructorName ?? "Daniel Doe")
  const instructorEmail = escapeHtmlForEmail(opts.instructorEmail ?? "dmdoe@pvamu.edu")

  const p = (text: string) =>
    `<p style="margin:0 0 14px;color:#334155;font-size:16px;line-height:1.65;">${text}</p>`
  const li = (text: string) =>
    `<li style="margin:0 0 10px;color:#334155;font-size:15px;line-height:1.6;">${text}</li>`

  const deadlineLine = deadlineLabel
    ? `Please submit before <strong>${deadlineLabel}</strong>.`
    : "Please submit as soon as you can."

  const multiPollLine =
    pollCount > 1
      ? `<p style="margin:8px 0 0;color:#166534;font-size:15px;line-height:1.6;">Your section has <strong>${pollCount} polls</strong> open — complete <strong>each one</strong> (lecture and laboratory).</p>`
      : ""

  return `
${p(`Hi <strong>${name}</strong>,`)}

${p(
  `Good news: the <strong>Schedule Adjustment</strong> page on CourseCollab is working again. Your <strong>${courseCode}</strong> section <strong>${section}</strong> (${sessionCode}) ${pollCount > 1 ? "polls are" : "poll is"} <strong>open now</strong> so you can mark your daytime availability for moving evening/night class times.`,
)}

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border-collapse:collapse;">
  <tr>
    <td style="background:linear-gradient(135deg,#ecfdf5 0%,#d1fae5 100%);border-radius:14px;padding:18px 22px;border:1px solid #6ee7b7;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#047857;text-transform:uppercase;letter-spacing:0.04em;">Open now</p>
      <p style="margin:0;color:#064e3b;font-size:16px;line-height:1.6;">Sign in and pick the daytime slots (8:00 AM–5:00 PM, Mon–Thu) when you can attend. ${deadlineLine}</p>
      ${multiPollLine}
    </td>
  </tr>
</table>

<h2 style="margin:28px 0 12px;font-size:18px;color:#0f172a;font-weight:700;">What to do</h2>
<ol style="margin:0 0 20px;padding-left:22px;">
  ${li(`Sign in: <a href="${authUniversityUrl}" style="color:#2563eb;font-weight:600;">${authUniversityUrl}</a> → <strong>PVAMU</strong> → Login with Student ID or @pvamu.edu email.`)}
  ${li(`Open <a href="${scheduleAdjustmentUrl}" style="color:#2563eb;font-weight:600;">Schedule Adjustment</a> and tap your available times.`)}
  ${li(`Click <strong>Submit availability</strong> when finished.`)}
</ol>

${p(
  `Questions? Contact ${instructorName} at <a href="mailto:${instructorEmail}" style="color:#2563eb;">${instructorEmail}</a>.`,
)}

${p(`Thank you!<br/><br/><strong>${instructorName}</strong><br/>CourseCollab · ${courseCode} · ${term}`)}
`.trim()
}

export const ELEG_FALL2026_SCHEDULE_POLL_LIVE_SUBJECT =
  "Schedule polls are open now on CourseCollab — submit your availability (Fall 2026 ELEG)"

export { studentFirstNameFromFullName }
