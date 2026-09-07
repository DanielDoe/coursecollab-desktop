export const ECE2202_FINALS_WEEK_SCHEDULE_TITLE =
  "ECE 2202 — Room change to 318 & finals week schedule (Jul 28–30)"

export function ece2202FinalsWeekScheduleAnnouncementHtml(): string {
  return `<p><strong>ECE 2202 students — important update for finals week.</strong></p>

<p>Due to summer camp scheduling at UH Katy, our classroom has been moved for the remainder of the term:</p>

<div style="margin:16px 0;padding:14px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;">
  <p style="margin:0;"><strong>New location:</strong> Room <strong>318</strong>, UH Katy Campus</p>
  <p style="margin:8px 0 0;"><strong>Previous room:</strong> 307E — a notice will be posted there as well.</p>
  <p style="margin:8px 0 0;"><strong>Class time (unchanged):</strong> Tuesday, Wednesday &amp; Thursday, 10:00 AM–12:00 PM</p>
</div>

<p><strong>This week’s plan:</strong></p>
<ul>
<li><strong>Tuesday, July 28</strong> — <strong>LTspice</strong> instructional session (simulation &amp; review activities). Bring a laptop if you have one; we will work through examples together.</li>
<li><strong>Wednesday, July 29</strong> — <strong>Review with the TA</strong>. Come prepared with questions from Lectures 1–8, homework, quizzes, and mid-semester topics.</li>
<li><strong>Thursday, July 30</strong> — <strong>Comprehensive final exam</strong> (10:00 AM–12:00 PM, Room 318). Arrive on time with your UH ID and approved materials only.</li>
</ul>

<p><strong>Final exam reminders:</strong></p>
<ul>
<li>The exam is <strong>in person</strong> at UH Katy — use Room <strong>318</strong>, not 307E.</li>
<li>Review the syllabus exam policies: no communication with other students during the exam.</li>
<li>Bring a calculator and any notes/materials permitted per course policy.</li>
<li>Questions? Reply on this announcement or ask during class.</li>
</ul>

<p>See you in Room 318.</p>
<p>— Dr. Doe</p>`
}

export function ece2202FinalsWeekSchedulePlainPreview(maxLen = 150): string {
  const plain =
    "ECE 2202: classroom moved to Room 318 at UH Katy for finals week. Tue Jul 28 LTspice, Wed Jul 29 TA review, Thu Jul 30 comprehensive final (10 AM–12 PM)."
  return plain.length > maxLen ? `${plain.slice(0, maxLen - 3)}...` : plain
}
