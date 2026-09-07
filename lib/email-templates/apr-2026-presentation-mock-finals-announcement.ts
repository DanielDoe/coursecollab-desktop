/**
 * Rich HTML body for bulk email: project presentations (Apr 20) + mock finals practice.
 * Used with sendEmail("announcement", ...) and messageHtml (trusted instructor-generated markup).
 */

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export const APR_2026_PRESENTATION_MOCK_FINALS_SUBJECT =
  "Project presentations start today (Apr 20) — schedule your slot & practice mock finals"

const card = (border: string, bg: string, inner: string) => `
  <div style="border-left:4px solid ${border};background:${bg};border-radius:12px;padding:18px 22px;margin:0 0 20px;">
    ${inner}
  </div>
`

export function apr2026PresentationMockFinalsMessageHtml(opts: {
  instructorName: string
  contactEmail: string
  projectsUrl: string
  dashboardUrl: string
  finalExamsUrl: string
}): string {
  const { instructorName, contactEmail, projectsUrl, dashboardUrl, finalExamsUrl } = opts
  const name = esc(instructorName)
  const email = esc(contactEmail)

  return `
  <p style="margin:0 0 20px;font-size:16px;line-height:1.65;color:#334155;">Hello,</p>

  <div style="text-align:center;margin:0 0 24px;">
    <span style="display:inline-block;padding:10px 18px;border-radius:999px;background:linear-gradient(135deg,#1d4ed8 0%,#0ea5e9 100%);color:#fff;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Starts today</span>
  </div>

  <h2 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#0f172a;font-weight:800;">Project presentations are underway</h2>
  <p style="margin:0 0 22px;font-size:16px;line-height:1.65;color:#475569;">We begin <strong style="color:#0f172a;">project presentations today — Monday, April 20</strong>. Please read everything below so you are ready to present and to practice for finals.</p>

  ${card(
    "#f59e0b",
    "linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%)",
    `
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#b45309;">Action required</p>
    <p style="margin:0;font-size:17px;line-height:1.55;color:#78350f;font-weight:700;">Schedule your presentation time on CourseCollab</p>
    <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#92400e;">In your <strong>Projects</strong> area, book the presentation time slots your team agreed on. The semester is almost over — <strong>students who miss scheduling or miss their assigned slot will not be allowed to present later</strong>, so treat this as a hard requirement.</p>
  `,
  )}

  ${card(
    "#3b82f6",
    "linear-gradient(135deg,#eff6ff 0%,#f0f9ff 100%)",
    `
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#1d4ed8;">Web apps</p>
    <p style="margin:0;font-size:15px;line-height:1.65;color:#1e3a8a;">Publish your app to a public URL (for example Vercel, Netlify, or your host of choice) and <strong>paste the live link in your project details</strong> on CourseCollab so the class can open it during your presentation.</p>
  `,
  )}

  ${card(
    "#7c3aed",
    "linear-gradient(135deg,#f5f3ff 0%,#faf5ff 100%)",
    `
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6d28d9;">Code / non-web projects</p>
    <p style="margin:0;font-size:15px;line-height:1.65;color:#4c1d95;">Send your code or materials to <strong>${name}</strong> at <a href="mailto:${email}" style="color:#5b21b6;font-weight:600;">${email}</a> so they can be shared with the class for demo day.</p>
  `,
  )}

  ${card(
    "#059669",
    "linear-gradient(135deg,#ecfdf5 0%,#d1fae5 100%)",
    `
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#047857;">Mock finals</p>
    <p style="margin:0;font-size:15px;line-height:1.65;color:#064e3b;"><strong>Mock finals are now open</strong> for you to practice toward the real finals. Use them to get comfortable with timing, navigation, and question styles before exam week.</p>
  `,
  )}

  <p style="margin:24px 0 0;font-size:15px;line-height:1.6;color:#64748b;">Questions? Reply to this email or write to <a href="mailto:${email}" style="color:#2563eb;font-weight:600;">${email}</a>.</p>
  <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#334155;">— ${name}</p>

  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:28px 0 0;border-collapse:collapse;">
    <tr>
      <td style="padding:8px 8px 8px 0;vertical-align:middle;">
        <a href="${esc(projectsUrl)}" style="display:block;text-align:center;padding:14px 16px;background:#0ea5e9;color:#fff !important;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">Projects — schedule slot</a>
      </td>
      <td style="padding:8px 0 8px 8px;vertical-align:middle;">
        <a href="${esc(finalExamsUrl)}" style="display:block;text-align:center;padding:14px 16px;background:#059669;color:#fff !important;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">Mock finals</a>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="padding:8px 0 0;">
        <a href="${esc(dashboardUrl)}" style="display:block;text-align:center;padding:12px 16px;background:#f1f5f9;color:#0f172a !important;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;border:1px solid #e2e8f0;">Student dashboard</a>
      </td>
    </tr>
  </table>
  `
}
