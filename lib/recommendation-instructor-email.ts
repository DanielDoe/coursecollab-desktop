/**
 * Sends transactional emails to instructors for recommendation-letter milestones driven by students.
 */

import { sendEmail } from "@/lib/email/sendEmail"
import { escapeHtmlForEmail } from "@/lib/email/emailTemplates"
import { letterPurposeLineDisplay } from "@/lib/recommendation-letters-shared"
import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"

const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "")

export type RecommendationInstructorNotifyKind =
  | "new_request"
  | "letter_submitted_for_review"
  | "letter_auto_finalized"
  | "request_details_updated"
  | "questionnaire_submitted"
  | "student_withdrew"
  | "intake_lane_selected"
  | "ai_drafts_generated"

export function recommendationInstructorRequestUrl(requestId: number): string {
  const path = `/instructor/dashboard-v2/recommendations/${requestId}`
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

function formatDeadline(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = String(raw).trim()
  const d = s.includes("T") ? new Date(s) : new Date(`${s}T12:00:00`)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

type ReqContext = {
  instructor_email: string | null
  instructor_name: string | null
  student_name: string | null
  course_code: string | null
  purpose: string | null
  purpose_other_detail: string | null
  deadline: string | null
}

async function fetchContext(requestId: number): Promise<ReqContext | null> {
  const rows = sqlRows<ReqContext>(
    await sql`
      SELECT i.email AS instructor_email,
             i.name AS instructor_name,
             s.full_name AS student_name,
             sess.code AS course_code,
             r.purpose,
             r.purpose_other_detail,
             r.deadline
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

/** "Hi …," line — use full `instructors.name` (e.g. "Dr. Daniel Doe"). Do not take only the first token or "Dr." breaks the salutation. */
function instructorGreetingName(full: string | null | undefined): string {
  const s = String(full ?? "")
    .trim()
    .replace(/\s+/g, " ")
  return s || "there"
}

function studentDisplayName(full: string | null | undefined): string {
  const s = String(full ?? "").trim()
  return s || "A student"
}

/** Fire-and-log; callers should catch so API responses stay successful if email infra is down. */
export async function notifyRecommendationInstructor(
  requestId: number,
  kind: RecommendationInstructorNotifyKind,
  extras?: {
    repliedToInfoRequest?: boolean
    previousStatus?: string | null
    intakeMode?: string | null
  },
): Promise<{ sent: boolean; skipReason?: string }> {
  const ctx = await fetchContext(requestId)
  const emailRaw = String(ctx?.instructor_email ?? "").trim()
  if (!ctx || !emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    const reason = !ctx ? "request_not_found" : !emailRaw ? "empty_instructor_email" : "invalid_instructor_email"
    console.warn("[recommendation instructor email] Skipped:", reason, "request", requestId, "kind", kind)
    return { sent: false, skipReason: reason === "request_not_found" ? "no_row" : "no_instructor_email" }
  }

  const purposeLine = letterPurposeLineDisplay(ctx.purpose, ctx.purpose_other_detail)
  const coursePart = ctx.course_code?.trim() ? ` · ${ctx.course_code.trim()}` : ""
  const requestSummary = `${purposeLine}${coursePart}`
  const link = recommendationInstructorRequestUrl(requestId)
  const infn = instructorGreetingName(ctx.instructor_name)
  const stu = studentDisplayName(ctx.student_name)

  let subject = ""
  let title = ""
  let sections = ""

  if (kind === "new_request") {
    subject = `New recommendation request (#${requestId})`
    title = "A student submitted a recommendation request"
    const due = formatDeadline(ctx.deadline)
    sections =
      pBlock(`${stu} submitted a new recommendation request (${requestSummary}).`) +
      bulletList([
        ...(due ? [`They listed a suggested deadline of ${due}.`] : []),
        "Approve, reject, or ask for more information from the request page.",
      ])
  } else if (kind === "letter_submitted_for_review") {
    subject = `Letter submitted for your review (#${requestId})`
    title = "A student finalized their draft — review when you can"
    sections =
      pBlock(
        `${stu} submitted their recommendation letter for ${requestSummary}. Final instructor review is required before graduation-quality PDF is available.`,
      ) +
      bulletList([
        "Open the request, read the letter, and finalize or request edits.",
        "After you finalize, the student is emailed and can download the official PDF.",
      ])
  } else if (kind === "letter_auto_finalized") {
    subject = `Recommendation letter finalized automatically (#${requestId})`
    title = "No final review required — student has access"
    sections =
      pBlock(
        `${stu}'s recommendation for ${requestSummary} was finalized automatically because your settings do not require a final instructor review.`,
      ) +
      bulletList([
        "You can still open the request if you want to spot-check wording or letterhead output.",
        "Adjust “require final review” in recommendation settings if you want sign-off on every letter.",
      ])
  } else if (kind === "request_details_updated") {
    subject = `Student updated request details (#${requestId})`
    title = "Recipient, deadline, or notes may have changed"
    sections =
      pBlock(
        `${stu} updated the details on recommendation request #${requestId} (${requestSummary}) — for example recipient, program, deadline, or their note to you.`,
      ) +
      bulletList(["Their approval status was not reset.", "Review the request if you need the latest specifics for the letter."])
  } else if (kind === "questionnaire_submitted") {
    const replied = Boolean(extras?.repliedToInfoRequest)
    subject = replied
      ? `Student replied to your information request (#${requestId})`
      : `Student completed the recommendation questionnaire (#${requestId})`
    title = replied ? "They saved answers after you asked for more detail" : "Questionnaire saved — they can continue their letter"
    sections =
      pBlock(
        replied
          ? `${stu} updated their questionnaire and request for ${requestSummary}. You can review progress or wait for them to submit a draft for review.`
          : `${stu} saved their recommendation questionnaire for ${requestSummary}. They can continue drafting or generating options depending on your class settings.`,
      ) +
      bulletList(["Open the request to see their answers and attachments.", "No action is required unless you had asked them for a specific follow-up."])
  } else if (kind === "student_withdrew") {
    const prev = String(extras?.previousStatus ?? "").trim() || "in progress"
    subject = `Student withdrew recommendation request (#${requestId})`
    title = "This request was withdrawn by the student"
    sections =
      pBlock(`${stu} withdrew recommendation request #${requestId} (${requestSummary}). It was removed from your queue.`) +
      pBlock(`Previous status: ${prev}.`) +
      bulletList(["If they still need a letter, they can submit a new request when your policy allows."])
  } else if (kind === "intake_lane_selected") {
    const mode = String(extras?.intakeMode ?? "").trim()
    const isAi = mode === "questionnaire_ai"
    subject = `Student started their letter workflow (#${requestId})`
    title = isAi ? "They chose AI-assisted drafting" : "They chose to bring their own draft"
    sections =
      pBlock(
        `${stu} selected ${isAi ? "the questionnaire + AI draft path" : "the bring-your-own-draft path"} for ${requestSummary}.`,
      ) +
      bulletList([
        isAi
          ? "They will answer prompts and may generate drafts next — you may get another message when drafts are ready or when they submit for review."
          : "They will work from your template and paste their own letter text when ready.",
      ])
  } else if (kind === "ai_drafts_generated") {
    subject = `Student generated AI letter drafts (#${requestId})`
    title = "New draft versions are available on the request"
    sections =
      pBlock(
        `${stu} generated AI-assisted draft options for ${requestSummary}. They can read and pick one, then submit for your review if your settings require it.`,
      ) +
      bulletList(["Open the request to see draft text if you want to preview before they choose.", "No action is required until they submit for final review."])
  }

  if (!subject.trim() || !sections.trim()) {
    console.error("[recommendation instructor email] Missing template content for kind", kind, "request", requestId)
    return { sent: false, skipReason: "unknown_or_empty_kind" }
  }

  const res = await sendEmail("recommendation_instructor_update", emailRaw, {
    instructorDisplayName: infn,
    subject,
    title,
    bodySectionsHtml: sections,
    linkUrl: link,
    linkLabel: "Open recommendation request",
  })

  if (!res.success) {
    console.error("[recommendation instructor email] send failed", requestId, kind, res.error)
    return { sent: false, skipReason: res.error }
  }
  return { sent: true }
}
