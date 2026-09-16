export const ELEG1301P01_CLASSROOM_ASSIGNMENTS_TITLE =
  "Submit your in-class C++ practice assignments (due Friday, Sep 11)"

export function eleg1301p01ClassroomAssignmentsAnnouncementHtml(classroomPointsUrl: string): string {
  const link = classroomPointsUrl.replace(/"/g, "&quot;")
  return `<p>Hi ELEG 1301 P01,</p>

<p>We posted <strong>six classroom code assignments</strong> on CourseCollab from our in-class practice. If you have not submitted yet, please finish them before the deadline.</p>

<h3 style="margin:20px 0 10px;font-size:16px;">Where to submit</h3>
<p><a href="${link}"><strong>Dashboard → Classroom Points → Code assignments</strong></a></p>
<ol style="margin:0 0 16px;padding-left:22px;">
  <li>Select the assignment from the dropdown (or use <strong>Missing Submissions</strong> if needed).</li>
  <li>Paste or write your C++ solution in the editor.</li>
  <li>Click <strong>Submit Assignment</strong> — each counts toward classroom points after review.</li>
</ol>

<h3 style="margin:20px 0 10px;font-size:16px;">Open assignments</h3>
<ul style="margin:0 0 16px;padding-left:22px;">
  <li>Area of a Circle</li>
  <li>Perimeter of a Rectangle</li>
  <li>Ohm's Law</li>
  <li>Total Purchase Cost</li>
  <li>Engineering Challenge — Kinetic Energy</li>
  <li>Celsius to Fahrenheit</li>
</ul>

<p><strong>Due:</strong> Friday, September 11, 2026 at <strong>11:59 PM Central</strong>.</p>

<p>If the assignment dropdown looks empty, refresh the page — a fix is live. You can also pick the assignment under <strong>Missing Submissions</strong>. Reply here or email me if anything still will not submit.</p>

<p>Best,<br/>Daniel Doe</p>`
}
