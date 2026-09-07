/**
 * Rich HTML email — ECE 2202 Homework 4, Mid-Semester Exam 1, Classroom Points.
 */
import { escapeHtmlForEmail } from "@/lib/email/emailTemplates"
import {
  ECE2202_CH4_CLASSROOM_POINTS_DEADLINE_LABEL,
  ECE2202_HW4_DEADLINE_LABEL,
  ECE2202_MIDSEM_EXAM_1_DATE_LABEL,
  ECE2202_MIDSEM_EXAM_1_TIME_LABEL,
  ECE2202_MIDSEM_EXAM_2_DATE_LABEL,
} from "@/lib/ece2202-hw4-midsem-announcement"

export type Ece2202Hw4MidsemEmailOpts = {
  studentFirstName: string
  loginUrl: string
  homeworkUrl: string
  classroomPointsUrl: string
  practiceHubUrl: string
  announcementsUrl: string
  instructorName?: string
  instructorEmail?: string
}

export function buildEce2202Hw4MidsemEmailHtml(opts: Ece2202Hw4MidsemEmailOpts): string {
  const name = escapeHtmlForEmail(opts.studentFirstName || "there")
  const loginUrl = escapeHtmlForEmail(opts.loginUrl)
  const homeworkUrl = escapeHtmlForEmail(opts.homeworkUrl)
  const classroomPointsUrl = escapeHtmlForEmail(opts.classroomPointsUrl)
  const practiceHubUrl = escapeHtmlForEmail(opts.practiceHubUrl)
  const announcementsUrl = escapeHtmlForEmail(opts.announcementsUrl)
  const instructorName = escapeHtmlForEmail(opts.instructorName ?? "Daniel Doe")
  const instructorEmail = escapeHtmlForEmail(opts.instructorEmail ?? "dmdoe@pvamu.edu")

  const p = (text: string) =>
    `<p style="margin:0 0 14px;color:#334155;font-size:16px;line-height:1.65;">${text}</p>`
  const li = (text: string) =>
    `<li style="margin:0 0 10px;color:#334155;font-size:15px;line-height:1.6;">${text}</li>`
  const h2 = (text: string) =>
    `<h2 style="margin:28px 0 12px;font-size:18px;color:#0f172a;font-weight:700;">${text}</h2>`

  return `
${p(`Hi <strong>${name}</strong>,`)}

${p(
  `Three priorities before our mid-semester exam: complete <strong>Homework 4</strong>, prepare for <strong>Mid-Semester Exam 1</strong> on <strong>${escapeHtmlForEmail(ECE2202_MIDSEM_EXAM_1_DATE_LABEL)}</strong>, and finish any open <strong>Classroom Points</strong> submissions from Chapters 1–4.`,
)}

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border-collapse:collapse;">
  <tr>
    <td style="background:linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%);border-radius:14px;padding:18px 22px;border:1px solid #93c5fd;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:0.04em;">Mid-Semester Exam 1</p>
      <p style="margin:0;color:#1e3a8a;font-size:16px;line-height:1.6;"><strong>${escapeHtmlForEmail(ECE2202_MIDSEM_EXAM_1_DATE_LABEL)}</strong> · ${escapeHtmlForEmail(ECE2202_MIDSEM_EXAM_1_TIME_LABEL)} · in class on CourseCollab</p>
    </td>
  </tr>
</table>

${h2("Homework 4 — due " + escapeHtmlForEmail(ECE2202_HW4_DEADLINE_LABEL))}
<ul style="margin:0 0 20px;padding-left:22px;">
  ${li(`<strong>Section I (20%):</strong> 10 Chapter 4 conceptual questions`)}
  ${li(`<strong>Section II (80%):</strong> 4 circuit submissions — <strong>P4.9, P4.11, P4.14, P4.15</strong> (upload worked solutions)`)}
  ${li(`Open: <a href="${homeworkUrl}" style="color:#2563eb;font-weight:600;">Assessments → Homework</a>`)}
</ul>

${h2("Mid-Semester Exam 1 structure")}
${p(`The exam covers <strong>Chapters 1–4</strong>. Section II problems match the style of our <strong>Practice Hub / Classroom Points circuit submission</strong> questions — review those worked problems carefully.`)}

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;border-collapse:collapse;font-size:14px;">
  <tr style="background:#f8fafc;">
    <td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:600;">Section I (10%)</td>
    <td style="padding:10px 12px;border:1px solid #e2e8f0;">10 MCQ / True-False / Select All — individual timers</td>
  </tr>
  <tr>
    <td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:600;">Section II (90%)</td>
    <td style="padding:10px 12px;border:1px solid #e2e8f0;"><strong>6 circuit submission problems</strong> · <strong>60-minute pooled timer</strong> for the whole section</td>
  </tr>
</table>

<ul style="margin:0 0 20px;padding-left:22px;">
  ${li(`<strong>In-person only:</strong> you must attend class and be checked in before starting.`)}
  ${li(`Upload a complete worked solution for <strong>each</strong> Section II problem before time expires.`)}
  ${li(`<strong>Mid-Semester Exam 2 (Form B)</strong> uses the same format on <strong>${escapeHtmlForEmail(ECE2202_MIDSEM_EXAM_2_DATE_LABEL)}</strong>.`)}
</ul>

${h2("Classroom Points — finish Chapters 1–4")}
<ul style="margin:0 0 20px;padding-left:22px;">
  ${li(`Submit any missing circuit practice work in <a href="${classroomPointsUrl}" style="color:#2563eb;font-weight:600;">Classroom Points</a>.`)}
  ${li(`Chapter 4 op-amp circuits due <strong>${escapeHtmlForEmail(ECE2202_CH4_CLASSROOM_POINTS_DEADLINE_LABEL)}</strong>.`)}
  ${li(`Also review <a href="${practiceHubUrl}" style="color:#2563eb;font-weight:600;">Practice Hub</a> circuit submissions from Chapters 1–4.`)}
</ul>

${h2("Quick links")}
<ol style="margin:0 0 20px;padding-left:22px;">
  ${li(`Sign in: <a href="${loginUrl}" style="color:#2563eb;font-weight:600;">${loginUrl}</a>`)}
  ${li(`Full announcement: <a href="${announcementsUrl}" style="color:#2563eb;font-weight:600;">Dashboard → Announcements</a>`)}
</ol>

${p(`Questions? Email <a href="mailto:${instructorEmail}" style="color:#2563eb;">${instructorEmail}</a> or use Issues &amp; Comments on CourseCollab.`)}

${p(`See you in class,<br/><br/><strong>${instructorName}</strong><br/>ECE 2202 · CourseCollab`)}
`.trim()
}

export const ECE2202_HW4_MIDSEM_EMAIL_SUBJECT =
  "ECE 2202 — Homework 4, Mid-Semester Exam 1 (July 1), & Classroom Points"
