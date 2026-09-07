/**
 * ECE 2202 — Course progress, upcoming topics, and student feedback.
 */

export const ECE2202_COURSE_PROGRESS_ANNOUNCEMENT_TITLE =
  "Course Progress, Upcoming Topics, and Student Feedback"

export const ECE2202_COURSE_PROGRESS_COURSE_CODE = "ECE2202"

export const ECE2202_COURSE_PROGRESS_ATTACHMENT_NAME =
  "Circuit-Analysis-Design-II-Textbook-Table-of-Contents.pdf"

export function buildEce2202CourseProgressAnnouncementContent(): string {
  return `<p>Hi everyone,</p>

<p>I wanted to take a moment to address something that some of you may already be thinking about regarding the <strong>pace and content</strong> of the course.</p>

<p>So far, many of the topics we have been covering overlap with concepts introduced previously in <strong>Circuits I</strong>. I understand that some of you may feel that much of the material is familiar, and <strong>I share that observation as well</strong>.</p>

<h3>Why the early chapters feel familiar</h3>
<p>According to our <strong>course syllabus</strong> and <strong>textbook sequence</strong>, our planned coverage for this semester spans <strong>Chapters 1 through 8</strong> of <em>Circuit Analysis and Design II</em>. The early chapters focus heavily on strengthening the analytical foundations of circuit analysis, but we are <strong>gradually transitioning into more advanced material</strong>.</p>

<p>We are currently working through <strong>Chapter 5</strong>. Upcoming chapters will introduce topics such as:</p>
<ul>
  <li><strong>RLC Circuits</strong> (Second-Order Circuits)</li>
  <li><strong>AC Circuit Analysis</strong></li>
  <li><strong>Phasors and Complex Impedance</strong></li>
  <li><strong>AC Power Analysis</strong></li>
  <li><strong>Frequency Response</strong> and more advanced circuit behavior</li>
</ul>

<p>These later chapters are typically where the course begins connecting more directly with concepts you will encounter in <strong>junior-level electrical engineering courses</strong>, so the material will become increasingly advanced as we move forward.</p>

<h3>Your feedback matters</h3>
<p>I also want to emphasize that I value your feedback. If there are specific topics, applications, or concepts <strong>beyond the scheduled chapters</strong> that you feel would be helpful for your learning or future coursework, please feel free to let me know — reply on this announcement, use <strong>Issues &amp; Comments</strong> on CourseCollab, or speak with me after class. I will do my best to incorporate additional discussions where time permits.</p>

<h3>Textbook roadmap (attached)</h3>
<p>For your reference, I have attached the <strong>textbook table of contents</strong> so you can see the overall roadmap of topics we will be covering this semester and better understand where we are headed. Tap <strong>Preview</strong> or <strong>Download</strong> on the attachment below.</p>

<p>I appreciate your engagement so far, and I encourage you to continue asking questions and sharing suggestions throughout the semester.</p>

<p>Best regards,<br/><strong>Daniel Doe</strong><br/>ECE 2202 · Summer 2026</p>`
}

export function ece2202CourseProgressPlainPreview(maxLen = 160): string {
  const plain =
    "Course progress update: early chapters review Circuits I foundations; we are on Ch. 5 and heading into RLC, AC analysis, phasors, power, and frequency response. Download the attached textbook table of contents. Feedback welcome."
  return plain.length > maxLen ? `${plain.slice(0, maxLen - 3)}...` : plain
}
