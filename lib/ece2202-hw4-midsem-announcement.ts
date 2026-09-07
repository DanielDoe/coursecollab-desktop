/**
 * ECE 2202 — Homework 4 reminder, Mid-Semester Exam 1 (July 1), Classroom Points.
 */

export const ECE2202_HW4_MIDSEM_COURSE_CODE = "ECE2202"

export const ECE2202_HW4_MIDSEM_ANNOUNCEMENT_TITLE =
  "ECE 2202 — Homework 4, Mid-Semester Exam 1 (July 1), & Classroom Points"

export const ECE2202_MIDSEM_EXAM_1_DATE_LABEL = "Wednesday, July 1, 2026"
export const ECE2202_MIDSEM_EXAM_1_TIME_LABEL = "10:00 AM–12:00 PM CT (regular class period, UH Katy Campus)"
export const ECE2202_MIDSEM_EXAM_2_DATE_LABEL = "Thursday, July 16, 2026"
export const ECE2202_HW4_DEADLINE_LABEL = "Sunday, July 6, 2026 at 11:59 PM CT"
export const ECE2202_CH4_CLASSROOM_POINTS_DEADLINE_LABEL = "Monday, June 29, 2026 at 11:59 PM CT"

export function buildEce2202Hw4MidsemAnnouncementContent(): string {
  return `<p><strong>ECE 2202 students</strong> — please read this carefully. There are three priorities before our mid-semester exam:</p>

<h3>1. Complete Homework 4 (Chapter 4 — Operational Amplifiers)</h3>
<p><strong>Homework 4</strong> is live on CourseCollab. Due <strong>${ECE2202_HW4_DEADLINE_LABEL}</strong>.</p>
<ul>
  <li><strong>Section I (20%):</strong> 10 hard conceptual questions on Chapter 4 op-amps (MCQ, True/False, Select All).</li>
  <li><strong>Section II (80%):</strong> 4 circuit submission problems — upload complete worked solutions for <strong>P4.9, P4.11, P4.14, and P4.15</strong>.</li>
  <li>Section II uses a <strong>pooled section timer</strong> (one clock for the whole circuit section). Upload clear photos or scans of your work.</li>
</ul>
<p>Go to <strong>Assessments → Homework → ECE 2202 - Homework 4</strong>.</p>

<h3>2. Mid-Semester Exam 1 — ${ECE2202_MIDSEM_EXAM_1_DATE_LABEL}</h3>
<p>Our first mid-semester exam is <strong>in class</strong> on <strong>${ECE2202_MIDSEM_EXAM_1_DATE_LABEL}</strong>, ${ECE2202_MIDSEM_EXAM_1_TIME_LABEL}.</p>
<p><strong>What to study:</strong> The exam draws from the same style of material as our <strong>Practice Hub / Classroom Points circuit submission problems from Chapters 1–4</strong>. Review your worked solutions and practice problems from:</p>
<ul>
  <li>Chapter 1 — Circuit Terminology</li>
  <li>Chapter 2 — Resistive Circuits</li>
  <li>Chapter 3 — Analysis Techniques</li>
  <li>Chapter 4 — Operational Amplifiers</li>
</ul>

<p><strong>Exam structure (16 questions total):</strong></p>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:640px;">
  <thead>
    <tr>
      <th align="left">Section</th>
      <th align="left">Weight</th>
      <th align="left">Format</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Section I</strong> — Chapters 1–4 conceptual</td>
      <td>10%</td>
      <td>10 questions (MCQ, True/False, Select All) with individual timers</td>
    </tr>
    <tr>
      <td><strong>Section II</strong> — Chapters 1–4 circuit submissions</td>
      <td>90%</td>
      <td><strong>6 circuit submission problems</strong> with one <strong>60-minute pooled timer</strong> for the entire section</td>
    </tr>
  </tbody>
</table>

<p><strong>Important exam-day notes:</strong></p>
<ul>
  <li>This is an <strong>in-person exam</strong>. You must attend class and be <strong>checked in</strong> before you can start on CourseCollab.</li>
  <li>Bring your laptop (charged), charger, and any permitted calculator/notes sheet if announced.</li>
  <li>For Section II, upload a complete worked solution for <strong>every</strong> circuit problem before time expires.</li>
  <li><strong>Mid-Semester Exam 2 (Form B)</strong> follows the same structure and is scheduled for <strong>${ECE2202_MIDSEM_EXAM_2_DATE_LABEL}</strong> in class.</li>
</ul>

<h3>3. Finish Classroom Points (Chapters 1–4)</h3>
<p>If you have not submitted all open <strong>Classroom Points</strong> circuit practice assignments, do that now — they are the best preparation for Section II of the mid-semester exam.</p>
<ul>
  <li>Chapter 4 op-amp circuit submissions are due <strong>${ECE2202_CH4_CLASSROOM_POINTS_DEADLINE_LABEL}</strong>.</li>
  <li>Check <strong>Classroom Points</strong> for any missing Chapter 1–3 submissions as well.</li>
</ul>

<p>Questions? Use <strong>Issues &amp; Comments</strong> on the relevant assessment in CourseCollab, or email <a href="mailto:dmdoe@pvamu.edu">dmdoe@pvamu.edu</a>.</p>

<p>— Daniel Doe<br/>ECE 2202 · Summer 2026</p>`
}
