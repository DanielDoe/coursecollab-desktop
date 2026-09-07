/**
 * Sends transactional emails to students for recommendation-letter milestones.
 */

import { sendEmail } from "@/lib/email/sendEmail"
import { escapeHtmlForEmail } from "@/lib/email/emailTemplates"
import { letterPurposeLineDisplay } from "@/lib/recommendation-letters-shared"
import { recommendationStudentRequestPath } from "@/lib/recommendation-request-transitions"
import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"

const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "")

export type RecommendationStudentNotifyKind =
  | "created"
  | "approved"
  | "rejected"
  | "info_requested"
  | "finalized"
  | "revision_requested"
  | "letter_queued_for_review"
  | "letter_ready_for_student_review"

export function recommendationStudentPageUrl(requestId: number, isPlatformGuest = false): string {
  const path = recommendationStudentRequestPath(requestId, isPlatformGuest)
  if (!BASE_URL) return path
  return `${BASE_URL}${path}`
}

function pBlock(text: string): string {
  return `<p style="margin:0 0 14px;color:#475569;font-size:15px;line-height:1.65;">${escapeHtmlForEmail(text)}</p>`
}

function bulletList(lines: string[]): string {
  if (lines.length === 0) return ""
  const items = lines.map((line) => `<li style="margin:8px 0;">${escapeHtmlForEmail(line)}</li>`).join("")
  return `<ul style="margin:0 0 18px;padding-left:20px;color:#475569;font-size:15px;line-height:1.55;">${items}</ul>`
}

function instructorNote(note: string | null | undefined): string {
  const t = String(note ?? "").trim()
  if (!t) return ""
  return `
<div style="margin:14px 0 18px;padding:14px 16px;background:#f8fafc;border-left:4px solid #582c83;border-radius:8px;">
  <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#582c83;text-transform:uppercase;letter-spacing:0.08em;">From your instructor</p>
  <p style="margin:0;font-size:14px;color:#334155;line-height:1.55;white-space:pre-wrap;">${escapeHtmlForEmail(t)}</p>
</div>`
}

function formatDeadline(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = String(raw).trim()
  const d = s.includes("T") ? new Date(s) : new Date(`${s}T12:00:00`)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

type ReqContext = {
  student_email: string | null
  student_name: string | null
  course_code: string | null
  instructor_name: string | null
  purpose: string | null
  purpose_other_detail: string | null
  deadline: string | null
  is_platform_guest: boolean | null
}

async function fetchContext(requestId: number): Promise<ReqContext | null> {
  const rows = sqlRows<ReqContext>(
    await sql`
      SELECT s.email AS student_email,
             s.full_name AS student_name,
             sess.code AS course_code,
             i.name AS instructor_name,
             r.purpose,
             r.purpose_other_detail,
             r.deadline,
             COALESCE(s.is_platform_guest, false) AS is_platform_guest
      FROM recommendation_requests r
      JOIN students s ON s.id = r.student_id
      JOIN sessions sess ON sess.id = r.course_id
      JOIN instructors i ON i.id = r.instructor_id
      WHERE r.id = ${requestId}
      LIMIT 1
    `,
  )
  return rows[0] ?? null
}

function firstName(full: string | null | undefined): string {
  const s = String(full ?? "").trim()
  if (!s) return "Student"
  return s.split(/\s+/)[0] ?? "Student"
}

/** Fire-and-log; callers should catch so API responses stay successful if email infra is down. */
export async function notifyRecommendationStudent(
  requestId: number,
  kind: RecommendationStudentNotifyKind,
  extras?: { note?: string | null; reason?: string | null },
): Promise<{ sent: boolean; skipReason?: string }> {
  const ctx = await fetchContext(requestId)
  const emailRaw = String(ctx?.student_email ?? "").trim()
  if (!ctx || !emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    const reason = !ctx ? "request_not_found" : !emailRaw ? "empty_student_email" : "invalid_student_email"
    console.warn("[recommendation student email] Skipped:", reason, "request", requestId, "kind", kind)
    return { sent: false, skipReason: reason === "request_not_found" ? "no_row" : "no_student_email" }
  }

  const purposeLine = letterPurposeLineDisplay(ctx.purpose, ctx.purpose_other_detail)
  const coursePart = ctx.course_code?.trim() ? ` · ${ctx.course_code.trim()}` : ""
  const requestSummary = `${purposeLine}${coursePart}`
  const link = recommendationStudentPageUrl(requestId, Boolean(ctx.is_platform_guest))
  const fn = firstName(ctx.student_name)

  let subject = ""
  let title = ""
  let sections = ""

  if (kind === "created") {
    subject = `Recommendation request logged (#${requestId})`
    title = "We received your recommendation request"
    const due = formatDeadline(ctx.deadline)
    sections =
      pBlock(
        `You're all set — we logged your recommendation request (${requestSummary}).`,
      ) +
      bulletList([
        `${ctx.instructor_name ?? "Your instructor"} was notified.`,
        ...(due ? [`Suggested deadline shown in CourseCollab: ${due}.`] : []),
        "Next — wait while your instructor reviews the request.",
        "When they approve it, we'll email you and you can finish the questionnaire / letter steps on the same page.",
      ])
    sections += pBlock(`Request ID ${requestId} — keep this email until your letter is done.`)
  } else if (kind === "approved") {
    subject = `Recommendation request approved (#${requestId})`
    title = "Your instructor approved this request"
    sections =
      pBlock(`${ctx.instructor_name ?? "Your instructor"} approved your recommendation request (${requestSummary}).`) +
      bulletList([
        "Open CourseCollab and go to Recommendations.",
        "Complete any intake questionnaire and choose AI-assisted drafting or paste your own letter, depending on your class settings.",
        "Submit drafts for review — your instructor approves before the official PDF unlocks.",
      ])
  } else if (kind === "rejected") {
    subject = `Recommendation request closed (#${requestId})`
    title = "This recommendation request won’t proceed"
    const note = extras?.reason?.trim()
    sections =
      pBlock(
        `${ctx.instructor_name ?? "Your instructor"} did not approve this recommendation request (${requestSummary}).`,
      ) +
      (note ? pBlock(note) + "" : "") +
      bulletList([
        "If this was unexpected, reply to them directly or attend office hours.",
        "You can open CourseCollab to read any notes tied to your request.",
      ])
  } else if (kind === "info_requested") {
    subject = `Action needed — instructor question (#${requestId})`
    title = "Your instructor needs more information"
    sections =
      pBlock(
        `Before you can continue, ${ctx.instructor_name ?? "your instructor"} asked for an update on your recommendation request (${requestSummary}).`,
      ) +
      instructorNote(extras?.note) +
      bulletList([
        "Open the request in CourseCollab and reply or update the fields they asked about.",
        "After you save, they’ll move you forward on the same request — you don’t need a new submission.",
      ])
  } else if (kind === "finalized") {
    subject = `Official recommendation PDF ready (#${requestId})`
    title = "Your letter is finalized — download when you need it"
    sections =
      pBlock(
        `Your recommendation for ${requestSummary} is ready on official letterhead. Open CourseCollab to download the PDF from this request.`,
      ) +
      bulletList([
        "Download from the request page when you’re ready to submit to programs or employers.",
        "If something looks wrong, contact your instructor before using the letter externally.",
      ])
  } else if (kind === "revision_requested") {
    subject = `Revise your recommendation draft (#${requestId})`
    title = "Your instructor asked for changes"
    sections =
      pBlock(
        `Before final approval, ${ctx.instructor_name ?? "your instructor"} needs you to revise your letter draft (${requestSummary}).`,
      ) +
      instructorNote(extras?.note) +
      bulletList([
        "Open the request, read their note, and update your letter text as needed.",
        "Resubmit for another review pass — you’ll get another email when the PDF is ready.",
      ])
  } else if (kind === "letter_queued_for_review") {
    subject = `Letter submitted for instructor review (#${requestId})`
    title = "We received your letter draft"
    sections =
      pBlock(
        `Your letter for ${requestSummary} was submitted to ${ctx.instructor_name ?? "your instructor"} for review and sign-off.`,
      ) +
      bulletList([
        "No action needed right now unless they message you with questions.",
        "You’ll get another email when the official PDF is ready to download (or if they request edits).",
      ])
  } else if (kind === "letter_ready_for_student_review") {
    subject = `Your recommendation letter is ready (#${requestId})`
    title = "Review and download your letter"
    sections =
      pBlock(
        `${ctx.instructor_name ?? "Your instructor"} prepared your recommendation letter for ${requestSummary} and released it on CourseCollab.`,
      ) +
      bulletList([
        "Open your request to download the official PDF on letterhead.",
        "Read it carefully before you submit it to programs or employers.",
        "If anything needs to change, reply to your instructor or use the contact options on the request page.",
      ])
  }

  if (!subject.trim() || !sections.trim()) {
    console.error("[recommendation student email] Missing template content for kind", kind, "request", requestId)
    return { sent: false, skipReason: "unknown_or_empty_kind" }
  }

  const res = await sendEmail("recommendation_student_update", emailRaw, {
    studentFirstName: fn,
    subject,
    title,
    bodySectionsHtml: sections,
    linkUrl: link,
    linkLabel: "Open recommendation request",
  })

  if (!res.success) {
    console.error("[recommendation student email] send failed", requestId, kind, res.error)
    return { sent: false, skipReason: res.error }
  }
  return { sent: true }
}
