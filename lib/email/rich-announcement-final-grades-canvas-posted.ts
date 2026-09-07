/**
 * Rich HTML for “final grades posted on Canvas” (email-safe inline styles, ASCII + numeric entities).
 */
export function buildFinalGradesCanvasPostedRichHtml(): string {
  const p = (text: string) =>
    `<p style="margin:0 0 18px;color:#334155;font-size:16px;line-height:1.68;">${text}</p>`

  return `
<p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Dear Students,</p>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 26px;border-collapse:collapse;">
  <tr>
    <td style="background:linear-gradient(135deg,#fefce8 0%,#fef9c3 100%);border-radius:16px;padding:22px 24px;border:1px solid #fde047;">
      <p style="margin:0;font-size:18px;font-weight:700;color:#854d0e;line-height:1.45;">Thank you for a great semester</p>
      <p style="margin:10px 0 0;font-size:15px;color:#713f12;line-height:1.62;font-weight:500;">It was a pleasure having you in the course. I truly appreciate your effort, participation, and growth throughout the semester.</p>
    </td>
  </tr>
</table>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;border-collapse:collapse;">
  <tr>
    <td style="background:linear-gradient(135deg,#eef2ff 0%,#e0e7ff 100%);border-radius:16px;padding:20px 24px;border:1px solid #c7d2fe;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:800;color:#4338ca;text-transform:uppercase;letter-spacing:0.08em;">&#128203; Grades on Canvas</p>
      <p style="margin:0;font-size:16px;color:#312e81;line-height:1.65;"><strong>Your final grades are now posted on Canvas.</strong> Please review your grade carefully. If you have any concerns or questions, reach out to me <strong>as soon as possible</strong>.</p>
    </td>
  </tr>
</table>

${p("Otherwise, I wish you all the best as you move forward in your academic journey.")}

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 28px;border-collapse:collapse;">
  <tr>
    <td style="background:#f8fafc;border-radius:14px;padding:18px 22px;border:1px solid #e2e8f0;">
      <p style="margin:0;font-size:15px;color:#475569;line-height:1.62;">I also encourage you to leave a <strong>review of your class experience</strong>. Your feedback helps improve the course for future students.</p>
    </td>
  </tr>
</table>

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 0;border-collapse:collapse;border-top:1px solid #e2e8f0;padding-top:20px;">
  <tr>
    <td style="padding-top:20px;">
      <p style="margin:0;color:#0f172a;font-size:16px;line-height:1.65;"><strong>Best regards,</strong></p>
      <p style="margin:14px 0 0;font-size:16px;color:#1e293b;line-height:1.55;"><strong>Dr. Daniel M. Doe</strong><br/>
      <span style="color:#475569;font-size:15px;font-weight:500;">Assistant Professor, Electrical &amp; Computer Engineering</span><br/>
      <span style="color:#475569;font-size:15px;font-weight:500;">Prairie View A&amp;M University</span></p>
      <p style="margin:12px 0 0;font-size:14px;line-height:1.7;">
        <a href="mailto:dmdoe@pvamu.edu" style="color:#4f46e5;text-decoration:none;font-weight:600;">dmdoe@pvamu.edu</a>
        <span style="color:#94a3b8;"> &nbsp;|&nbsp; </span>
        <span style="color:#334155;">936-261-9980</span>
      </p>
    </td>
  </tr>
</table>
`.trim()
}
