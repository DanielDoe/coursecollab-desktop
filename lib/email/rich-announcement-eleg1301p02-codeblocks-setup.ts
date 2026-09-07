/**
 * ELEG 1301 P02 Fall 2026 — Code::Blocks / Xcode install + Week 2 sample practice.
 */
import { escapeHtmlForEmail } from "@/lib/email/emailTemplates"
import { studentFirstNameFromFullName } from "@/lib/email/rich-announcement-ece2202-welcome"

const CODEBLOCKS_URL = "https://www.codeblocks.org/downloads/binaries/"

export type Eleg1301p02CodeblocksSetupEmailOpts = {
  studentFirstName: string
  lecturesUrl: string
  instructorName?: string
  instructorEmail?: string
}

export const ELEG1301P02_CODEBLOCKS_SETUP_SUBJECT =
  "ELEG 1301 P02 — Install Code::Blocks or Xcode + Week 2 sample practice"

export function buildEleg1301p02CodeblocksSetupEmailHtml(opts: Eleg1301p02CodeblocksSetupEmailOpts): string {
  const name = escapeHtmlForEmail(opts.studentFirstName || "there")
  const lecturesUrl = escapeHtmlForEmail(opts.lecturesUrl)
  const codeblocksUrl = escapeHtmlForEmail(CODEBLOCKS_URL)
  const instructorName = escapeHtmlForEmail(opts.instructorName ?? "Daniel Doe")
  const instructorEmail = escapeHtmlForEmail(opts.instructorEmail ?? "dmdoe@pvamu.edu")

  const p = (text: string) =>
    `<p style="margin:0 0 14px;color:#334155;font-size:16px;line-height:1.65;">${text}</p>`
  const li = (text: string) =>
    `<li style="margin:0 0 10px;color:#334155;font-size:15px;line-height:1.6;">${text}</li>`

  return `
${p(`Hi <strong>${name}</strong>,`)}

${p(
  `For this evening’s class assignment, please <strong>download and install your C++ development tools</strong> before we meet again on <strong>Thursday</strong>. We will review installation steps, setup, and troubleshooting together in class.`,
)}

<h2 style="margin:24px 0 12px;font-size:18px;color:#0f172a;font-weight:700;">Windows (recommended)</h2>
${p(
  `Download and run <strong style="font-family:ui-monospace,Menlo,Consolas,monospace;">codeblocks-25.03mingw-setup.exe</strong> from the official Code::Blocks site. This build includes the IDE <em>and</em> the MinGW compiler (GCC) — do not use the IDE-only installer.`,
)}
<p style="margin:0 0 20px;text-align:center;">
  <a href="${codeblocksUrl}" style="display:inline-block;padding:14px 28px;background:#2563eb;color:#ffffff !important;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">Download Code::Blocks</a>
</p>

<h2 style="margin:24px 0 12px;font-size:18px;color:#0f172a;font-weight:700;">macOS</h2>
${p(
  `Install <strong>Xcode</strong> from the <strong>Mac App Store</strong>. After installation, open Xcode once to accept the license agreement and complete initial setup.`,
)}

<h2 style="margin:24px 0 12px;font-size:18px;color:#0f172a;font-weight:700;">CourseCollab — Week 2 sample practice</h2>
${p(
  `Please also finish the <strong>Sample Practice</strong> problems for <strong>Week 2</strong> (Lecture 2 — Introduction to Programming Concepts) on CourseCollab before Thursday if you have not already.`,
)}
<ol style="margin:0 0 20px;padding-left:22px;">
  ${li(`Open <a href="${lecturesUrl}" style="color:#2563eb;font-weight:600;">Lectures</a> on CourseCollab.`)}
  ${li(`Select <strong>Lecture 2 — Introduction to Programming Concepts</strong>.`)}
  ${li(`Click <strong>Sample Practice</strong> on the slide deck and complete the problems.`)}
</ol>

<p style="margin:24px 0 0;text-align:center;">
  <a href="${lecturesUrl}" style="display:inline-block;padding:14px 28px;background:#4f46e5;color:#ffffff !important;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">Open Lectures</a>
</p>

${p(`See you Thursday — bring your laptop if you can, and note any install errors so we can fix them together.`)}

${p(`Best,<br/><strong>${instructorName}</strong><br/>ELEG 1301 P02 · Fall 2026`)}

${p(`Questions? Contact ${instructorName} at <a href="mailto:${instructorEmail}" style="color:#2563eb;">${instructorEmail}</a>.`)}
`.trim()
}

export { studentFirstNameFromFullName }
