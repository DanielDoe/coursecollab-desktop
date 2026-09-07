import { CLASSROOM_JUNE18_HANDOUT_SECTIONS } from "@/lib/classroom-june18-handout-sections"

export const ECE2202_CLASSROOM_JUNE18_UPLOAD_TITLE =
  "Upload your classroom point solutions — June 18 handout (updated PDF attached)"

export function ece2202ClassroomJune18UploadAnnouncementHtml(): string {
  const problemList = CLASSROOM_JUNE18_HANDOUT_SECTIONS.map(
    (s) => `<li><strong>${s.title}</strong></li>`,
  ).join("\n")

  return `<p><strong>ECE 2202 students — please upload your worked solutions for the June 18 classroom point exercises.</strong></p>
<p>Each exercise is listed under <strong>Classroom Points</strong> in your dashboard. For every problem you attempt, attach clear photos or a PDF of your handwritten work (setup, equations, and final answer). Incomplete or blank uploads cannot earn credit.</p>
<ol>
<li>Open <strong>Classroom Points</strong> from your CourseCollab dashboard.</li>
<li>Select the exercise you worked on.</li>
<li>Upload your solution file(s) and submit for instructor review.</li>
<li>Check back for feedback — resubmit if your work needs correction.</li>
</ol>
<p>The attached PDF is the <strong>updated June 18 handout</strong> with all problem statements and figures. Use <strong>Preview</strong> or <strong>Download</strong> on the attachment below.</p>
<p><strong>Exercises on this handout:</strong></p>
<ul>
${problemList}
</ul>
<p>Questions? Reply on this announcement or ask during class.</p>`
}

export function ece2202ClassroomJune18UploadPlainPreview(maxLen = 150): string {
  const plain =
    "ECE 2202: upload worked solutions for the June 18 classroom point exercises. Open Classroom Points on your dashboard, attach photos or PDF of your work for each problem, and use the updated handout PDF attached here."
  return plain.length > maxLen ? `${plain.slice(0, maxLen - 3)}...` : plain
}
