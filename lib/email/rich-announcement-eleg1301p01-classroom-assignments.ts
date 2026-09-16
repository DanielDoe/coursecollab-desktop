/**
 * ELEG 1301 P01 Fall 2026 — in-class classroom code assignments reminder.
 */
import { escapeHtmlForEmail } from "@/lib/email/emailTemplates"
import { studentFirstNameFromFullName } from "@/lib/email/rich-announcement-ece2202-welcome"

export type Eleg1301p01ClassroomAssignmentsEmailOpts = {
  studentFirstName: string
  classroomPointsUrl: string
  instructorName?: string
  instructorEmail?: string
}

export const ELEG1301P01_CLASSROOM_ASSIGNMENTS_SUBJECT =
  "ELEG 1301 P01 — Submit your classroom C++ assignments (due Fri Sep 11)"

export function buildEleg1301p01ClassroomAssignmentsEmailHtml(
  opts: Eleg1301p01ClassroomAssignmentsEmailOpts,
): string {
  const name = escapeHtmlForEmail(opts.studentFirstName || "there")
  const classroomPointsUrl = escapeHtmlForEmail(opts.classroomPointsUrl)
  const instructorName = escapeHtmlForEmail(opts.instructorName ?? "Daniel Doe")
  const instructorEmail = escapeHtmlForEmail(opts.instructorEmail ?? "dmdoe@pvamu.edu")

  const p = (text: string) =>
    `<p style="margin:0 0 14px;color:#334155;font-size:16px;line-height:1.65;">${text}</p>`
  const li = (text: string) =>
    `<li style="margin:0 0 10px;color:#334155;font-size:15px;line-height:1.6;">${text}</li>`

  return `
${p(`Hi <strong>${name}</strong>,`)}

${p(
  `We posted <strong>six in-class C++ practice assignments</strong> on CourseCollab. If you have not submitted yet, please complete them before <strong>Friday, September 11 at 11:59 PM Central</strong>.`,
)}

<h2 style="margin:24px 0 12px;font-size:18px;color:#0f172a;font-weight:700;">How to submit</h2>
<ol style="margin:0 0 20px;padding-left:22px;">
  ${li(`Open <a href="${classroomPointsUrl}" style="color:#2563eb;font-weight:600;">Classroom Points</a> on CourseCollab.`)}
  ${li(`Go to the <strong>Code assignments</strong> tab.`)}
  ${li(`Select the assignment from the dropdown, enter your C++ solution, and click <strong>Submit Assignment</strong>.`)}
  ${li(`If the main dropdown is empty after refresh, use <strong>Missing Submissions</strong> instead.`)}
</ol>

<h2 style="margin:24px 0 12px;font-size:18px;color:#0f172a;font-weight:700;">Assignments</h2>
<ul style="margin:0 0 20px;padding-left:22px;">
  ${li("Area of a Circle")}
  ${li("Perimeter of a Rectangle")}
  ${li("Ohm's Law")}
  ${li("Total Purchase Cost")}
  ${li("Engineering Challenge — Kinetic Energy")}
  ${li("Celsius to Fahrenheit")}
</ul>

<p style="margin:24px 0 0;text-align:center;">
  <a href="${classroomPointsUrl}" style="display:inline-block;padding:14px 28px;background:#4f46e5;color:#ffffff !important;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">Open Classroom Points</a>
</p>

${p(`Reply to this email or post on the announcement if you run into trouble submitting.`)}

${p(`Best,<br/><strong>${instructorName}</strong><br/>ELEG 1301 P01 · Fall 2026`)}

${p(`Questions? Contact ${instructorName} at <a href="mailto:${instructorEmail}" style="color:#2563eb;">${instructorEmail}</a>.`)}
`.trim()
}

export { studentFirstNameFromFullName }
