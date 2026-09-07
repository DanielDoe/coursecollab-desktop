/**
 * Rich HTML: semester assessments closed; focus on project + final (email-safe inline styles).
 * Emoji as &#...; entities so source stays ASCII-safe.
 */
export function buildAssessmentsClosedRichAnnouncementHtml(): string {
  const p = (text: string) =>
    `<p style="margin:0 0 14px;color:#334155;font-size:16px;line-height:1.65;">${text}</p>`

  return `
${p("Dear Students,")}

${p("I have received a number of messages asking whether <strong>quizzes</strong>, <strong>homework</strong>, and <strong>mid-semester assessments</strong> can be reopened. I understand that this has been a very busy and demanding semester for many of you, and I appreciate your honesty in reaching out.")}

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border-collapse:collapse;">
  <tr>
    <td style="background:linear-gradient(135deg,#fef2f2 0%,#ffe4e6 100%);border-radius:14px;padding:18px 22px;border:1px solid #fecaca;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.04em;">&#9888; Important &mdash; please read carefully</p>
      <p style="margin:0 0 12px;font-size:15px;color:#7f1d1d;line-height:1.6;"><strong>All quizzes, all homework, and all mid-semester assessments are now closed for the semester.</strong> They <strong>will not be reopened</strong> for any student.</p>
      <p style="margin:0;font-size:15px;color:#7f1d1d;line-height:1.6;">Deadlines were <strong>applied consistently</strong> throughout the term. At this stage, <strong>I am not able to make exceptions</strong> &mdash; my hands are tied by the same rules and timelines that applied to everyone from the first week forward. This decision is <strong>final and not negotiable</strong>, and I ask that we all respect that boundary so we can move ahead constructively.</p>
    </td>
  </tr>
</table>

${p("I say this with respect and empathy; I know it may be disappointing to hear. The goal now is to channel your effort where it can still make the largest difference to your course outcome.")}

<h2 style="margin:28px 0 12px;font-size:18px;color:#0f172a;font-weight:700;">&#127919; Where your focus should be now</h2>
${p("The remaining graded work is substantial. Please treat these as your <strong>top priority</strong> for the rest of the semester:")}

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:12px 0 22px;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
  <tr>
    <td style="background:#f8fafc;padding:14px 18px;font-size:14px;font-weight:700;color:#0f172a;border-bottom:1px solid #e2e8f0;">Component</td>
    <td style="background:#f8fafc;padding:14px 18px;font-size:14px;font-weight:700;color:#0f172a;border-bottom:1px solid #e2e8f0;text-align:right;">Weight</td>
  </tr>
  <tr>
    <td style="padding:14px 18px;font-size:15px;color:#334155;border-bottom:1px solid #e2e8f0;"><strong>Course project</strong></td>
    <td style="padding:14px 18px;font-size:15px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:right;"><strong>40%</strong> of final grade</td>
  </tr>
  <tr>
    <td style="padding:14px 18px;font-size:15px;color:#334155;border-bottom:1px solid #e2e8f0;"><strong>Final exam</strong></td>
    <td style="padding:14px 18px;font-size:15px;color:#334155;border-bottom:1px solid #e2e8f0;text-align:right;"><strong>20%</strong> of final grade</td>
  </tr>
  <tr>
    <td style="padding:14px 18px;font-size:15px;color:#0f172a;"><strong>Together</strong></td>
    <td style="padding:14px 18px;font-size:16px;color:#1e40af;text-align:right;"><strong>60%</strong> of your overall grade</td>
  </tr>
</table>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border-collapse:collapse;">
  <tr>
    <td style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:0 12px 12px 0;padding:14px 18px;">
      <p style="margin:0;font-size:15px;color:#14532d;line-height:1.55;"><strong>&#9989; Finish strong:</strong> There is still a meaningful opportunity to improve your overall standing by doing excellent work on the <strong>project</strong> and preparing thoroughly for the <strong>final exam</strong>. Use your time deliberately, ask questions early, and give these assessments the attention they deserve.</p>
    </td>
  </tr>
</table>

${p("Thank you for your understanding and for the effort you have brought to the course so far.")}

<p style="margin:24px 0 0;color:#334155;font-size:16px;line-height:1.6;">Best regards,<br/><strong>Dr. Doe</strong></p>
`.trim()
}
