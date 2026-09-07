/**
 * Rich HTML body for the spring project / final / gradebook announcement (email-safe inline styles).
 * Emojis as &#...; entities so source files stay ASCII-safe.
 */
export function buildProjectFinalExamRichAnnouncementHtml(): string {
  const p = (text: string) =>
    `<p style="margin:0 0 14px;color:#334155;font-size:16px;line-height:1.65;">${text}</p>`
  const li = (text: string) =>
    `<li style="margin:0 0 8px;color:#334155;font-size:15px;line-height:1.55;">${text}</li>`

  return `
${p("Hello everyone &#128075;")}

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border-collapse:collapse;">
  <tr>
    <td style="background:linear-gradient(135deg,#eef2ff 0%,#e0e7ff 100%);border-radius:14px;padding:18px 22px;border:1px solid #c7d2fe;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#3730a3;text-transform:uppercase;letter-spacing:0.04em;">&#128204; This week</p>
      <p style="margin:0;color:#312e81;font-size:16px;line-height:1.6;"><strong>No regular class</strong> &mdash; use this time to <strong>finalize your projects</strong>.</p>
    </td>
  </tr>
</table>

<h2 style="margin:28px 0 12px;font-size:18px;color:#0f172a;font-weight:700;">&#128197; Project presentations</h2>
${p("Presentation days are locked in. Mark your calendar:")}
<ul style="margin:0 0 16px;padding-left:22px;">
  ${li("<strong>April 20</strong>, <strong>22</strong>, <strong>27</strong>, and <strong>29</strong>")}
</ul>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border-collapse:collapse;">
  <tr>
    <td style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 12px 12px 0;padding:14px 18px;">
      <p style="margin:0;font-size:15px;color:#92400e;line-height:1.55;"><strong>&#9889; Action required:</strong> If you are a <strong>project leader</strong>, book your team&apos;s presentation time slot <strong>immediately</strong>.</p>
    </td>
  </tr>
</table>

<h2 style="margin:28px 0 12px;font-size:18px;color:#0f172a;font-weight:700;">&#128221; Final exam &mdash; in person</h2>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:12px 0 18px;border-collapse:collapse;">
  <tr>
    <td style="background:linear-gradient(135deg,#fef2f2 0%,#ffe4e6 100%);border-radius:14px;padding:18px 22px;border:1px solid #fecaca;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.04em;">&#128198; Key date</p>
      <p style="margin:0;font-size:22px;font-weight:800;color:#b91c1c;line-height:1.3;">Monday, May 4</p>
      <p style="margin:8px 0 0;font-size:15px;color:#7f1d1d;">In-person final exam</p>
    </td>
  </tr>
</table>

${p("<strong>&#128203; Mock exams on Canvas:</strong> You&apos;ll see <strong>3 sections</strong> &mdash; they&apos;re there to help you prepare. On the <strong>actual final</strong>:")}
<ul style="margin:0 0 16px;padding-left:22px;">
  ${li("<strong>Section I:</strong> 20 questions &mdash; <strong>10</strong> drawn from the mock")}
  ${li("<strong>Section II:</strong> 5 questions (from mock pools)")}
  ${li("<strong>Section III:</strong> 5 questions (from mock pools)")}
</ul>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border-collapse:collapse;">
  <tr>
    <td style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:0 12px 12px 0;padding:14px 18px;">
      <p style="margin:0;font-size:15px;color:#14532d;line-height:1.55;"><strong>&#9989; Allowed:</strong> <strong>One cheat sheet only</strong> (handwritten or printed &mdash; your choice).</p>
      <p style="margin:10px 0 0;font-size:15px;color:#166534;line-height:1.55;"><strong>&#128683; Not allowed:</strong> No other reference materials, devices, or notes beyond that single sheet.</p>
    </td>
  </tr>
</table>

<h2 style="margin:28px 0 12px;font-size:18px;color:#0f172a;font-weight:700;">&#128202; Gradebook &mdash; quick heads-up</h2>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border-collapse:collapse;">
  <tr>
    <td style="background:#f8fafc;border-radius:14px;padding:18px 22px;border:1px solid #e2e8f0;">
      <p style="margin:0 0 10px;font-size:15px;color:#334155;line-height:1.6;">You might see <strong>temporary zeros</strong> for the <strong>Final Exam</strong> and <strong>Project</strong>. Those are <strong>placeholders only</strong> &mdash; nothing is wrong with your record.</p>
      <p style="margin:0;font-size:15px;color:#475569;line-height:1.6;">They&apos;re there so you can see how much those items count toward your overall grade. When grading is finished, they&apos;ll show your <strong>real scores</strong>. &#127919;</p>
    </td>
  </tr>
</table>

${p("Please use this time wisely, finish strong, and reach out if you have questions &#128170;")}
<p style="margin:24px 0 0;color:#334155;font-size:16px;line-height:1.6;">Best regards,<br/><strong>Dr. Daniel Doe</strong></p>
`.trim()
}
