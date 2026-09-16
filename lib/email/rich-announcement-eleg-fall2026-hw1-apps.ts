/**
 * ELEG Fall 2026 — Homework 1 + mobile/desktop apps + classroom points reminder.
 */
import { escapeHtmlForEmail } from "@/lib/email/emailTemplates"
import { studentFirstNameFromFullName } from "@/lib/email/rich-announcement-ece2202-welcome"
import type { ElegFall2026Hw1AppsLinks } from "@/lib/announcements/eleg-fall2026-hw1-apps-upload"

export type ElegFall2026Hw1AppsEmailOpts = {
  studentFirstName: string
  links: ElegFall2026Hw1AppsLinks
  courseLabel?: string
  instructorName?: string
  instructorEmail?: string
}

export const ELEG_FALL2026_HW1_APPS_SUBJECT =
  "ELEG Fall 2026 — Homework 1 open, mobile app, desktop update & classroom points"

export function buildElegFall2026Hw1AppsEmailHtml(opts: ElegFall2026Hw1AppsEmailOpts): string {
  const name = escapeHtmlForEmail(opts.studentFirstName || "there")
  const instructorName = escapeHtmlForEmail(opts.instructorName ?? "Daniel Doe")
  const instructorEmail = escapeHtmlForEmail(opts.instructorEmail ?? "dmdoe@pvamu.edu")
  const courseLabel = escapeHtmlForEmail(opts.courseLabel ?? "ELEG Fall 2026")
  const L = opts.links

  const p = (text: string) =>
    `<p style="margin:0 0 14px;color:#334155;font-size:16px;line-height:1.65;">${text}</p>`
  const link = (href: string, label: string) =>
    `<a href="${escapeHtmlForEmail(href)}" style="color:#2563eb;font-weight:600;">${escapeHtmlForEmail(label)}</a>`
  const li = (text: string) =>
    `<li style="margin:0 0 10px;color:#334155;font-size:15px;line-height:1.6;">${text}</li>`

  return `
${p(`Hi <strong>${name}</strong>,`)}

${p(`Quick CourseCollab updates for <strong>${courseLabel}</strong>:`)}

<ol style="margin:0 0 20px;padding-left:22px;">
  ${li(`<strong>iPhone / iPad:</strong> Download CourseCollab Mobile — ${link(L.iosAppStoreUrl, "App Store")}. Android coming later.`)}
  ${li(`<strong>Classroom points:</strong> Finish any pending classroom code submissions ASAP — ${link(L.classroomPointsUrl, "Classroom Points")}.`)}
  ${li(`<strong>Homework 1 Fall 2026</strong> is available — ${link(L.homeworkUrl, "Open Homework")}.`)}
  ${li(`<strong>Desktop app v${escapeHtmlForEmail(L.desktopVersion)}:</strong> Update for coding class — ${link(L.downloadsPageUrl, "Downloads page")} · ${link(L.macArmUrl, "Mac Apple Silicon")} · ${link(L.macIntelUrl, "Mac Intel")} · ${link(L.winX64Url, "Windows x64")} · ${link(L.winArmUrl, "Windows ARM")}.`)}
</ol>

<p style="margin:20px 0 0;text-align:center;">
  <a href="${escapeHtmlForEmail(L.homeworkUrl)}" style="display:inline-block;padding:12px 22px;background:#4f46e5;color:#ffffff !important;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;margin:0 6px 8px;">Homework 1</a>
  <a href="${escapeHtmlForEmail(L.iosAppStoreUrl)}" style="display:inline-block;padding:12px 22px;background:#0f172a;color:#ffffff !important;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;margin:0 6px 8px;">iOS App</a>
  <a href="${escapeHtmlForEmail(L.downloadsPageUrl)}" style="display:inline-block;padding:12px 22px;background:#0369a1;color:#ffffff !important;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;margin:0 6px 8px;">Desktop Downloads</a>
</p>

${p(`Best,<br/><strong>${instructorName}</strong><br/>${courseLabel}`)}

${p(`Questions? <a href="mailto:${instructorEmail}" style="color:#2563eb;">${instructorEmail}</a>`)}
`.trim()
}

export { studentFirstNameFromFullName }
