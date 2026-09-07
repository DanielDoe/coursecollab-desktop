export const ELEG1301P02_CODEBLOCKS_SETUP_TITLE =
  "Install Code::Blocks or Xcode before Thursday + Week 2 sample practice"

const CODEBLOCKS_URL = "https://www.codeblocks.org/downloads/binaries/"

export function eleg1301p02CodeblocksSetupAnnouncementHtml(lecturesUrl: string): string {
  const lectures = lecturesUrl.replace(/"/g, "&quot;")
  const codeblocks = CODEBLOCKS_URL.replace(/"/g, "&quot;")
  return `<p>Good evening, ELEG 1301 P02,</p>

<p>For this evening’s class assignment, please <strong>download and install your C++ development tools</strong> before we meet again on <strong>Thursday</strong>. We will walk through installation, setup, and troubleshooting together in class.</p>

<h3 style="margin:20px 0 10px;font-size:16px;">Windows (recommended)</h3>
<p>Download and run <strong><code>codeblocks-25.03mingw-setup.exe</code></strong> from the official Code::Blocks binaries page. This installer includes the IDE <em>and</em> the MinGW compiler — use this file, not the IDE-only build.</p>
<p><a href="${codeblocks}"><strong>Code::Blocks downloads (binaries)</strong></a></p>

<h3 style="margin:20px 0 10px;font-size:16px;">macOS</h3>
<p>Install <strong>Xcode</strong> from the <strong>Mac App Store</strong> (Apple’s official IDE and toolchain). After installation, open Xcode once to accept the license and finish setup.</p>

<h3 style="margin:20px 0 10px;font-size:16px;">CourseCollab — Week 2 sample practice</h3>
<p>In the meantime, please also complete the <strong>Sample Practice</strong> problems for <strong>Week 2</strong> (Lecture 2 — Introduction to Programming Concepts) on CourseCollab.</p>
<p><a href="${lectures}"><strong>Open Lectures on CourseCollab</strong></a> → select Lecture 2 → use the <strong>Sample Practice</strong> button on the slide deck.</p>

<p>See you Thursday — bring your laptop if you can, and note any install errors so we can fix them together.</p>

<p>Best,<br/>Daniel Doe</p>`
}
