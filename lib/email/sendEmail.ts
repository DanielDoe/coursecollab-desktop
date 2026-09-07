import { transporter } from "./transporter"
import { emailTemplates } from "./emailTemplates"
import type { EmailType } from "./emailTypes"

/** Params for each email type - ensure keys match template parameter order */
export type EmailParams = {
  account_verification: { name: string; link: string }
  password_reset: { link: string }
  student_password_reset_by_staff: {
    name: string
    temporaryPassword: string
    loginUrl: string
  }
  quiz_available: { quizTitle: string }
  grade_released: { name: string; assessmentTitle: string; score: string }
  grades_updated: {
    name: string
    assessmentTitle: string
    assessmentTypeLabel: string
    score: string
    totalPoints: string
    percentage: string
    reportLink: string
  }
  project_invite: { name: string; projectName: string; inviterName: string; link: string }
  announcement: {
    title: string
    message: string
    link?: string
    /** When set, rendered as trusted HTML instead of plain `message` (pre-wrap). */
    messageHtml?: string
  }
  /** Plain subject line + pre-built HTML body (paragraphs); used for instructor-wide emails */
  instructor_broadcast: { subject: string; bodyHtml: string }
  assessment_completed: {
    name: string
    assessmentType: "quiz" | "homework" | "mid-semester" | "final" | "code submission"
    assessmentTitle: string
    score: string
    maxScore: string
    link: string
  }
  new_assessment: {
    name: string
    assessmentType: "quiz" | "homework" | "mid-semester" | "final" | "code submission"
    assessmentTitle: string
    dueDate: string | null
    link: string
  }
  payment_success: { name: string; amount: string; description: string; link: string }
  missed_deadline: {
    name: string
    assessmentType: string
    assessmentTitle: string
    deadline: string
    link: string
  }
  missed_assessments_summary: {
    name: string
    assessmentCount: number
    tableRowsHtml: string
    dashboardLink: string
  }
  trade_center_instructor_alert: {
    title: string
    bodyHtml: string
    linkLabel: string
    linkUrl: string
  }
  course_exchange_faculty_alert: {
    title: string
    bodyHtml: string
    linkLabel: string
    linkUrl: string
    footerNote?: string
  }
  trade_center_peer_transfer_done: {
    name: string
    introHtml: string
    dashboardLink: string
  }
  recommendation_student_update: {
    studentFirstName: string
    subject: string
    title: string
    bodySectionsHtml: string
    linkUrl: string
    linkLabel: string
  }
  recommendation_instructor_update: {
    instructorDisplayName: string
    subject: string
    title: string
    bodySectionsHtml: string
    linkUrl: string
    linkLabel: string
  }
  midterm_progress_review: {
    studentFirstName: string
    subject: string
    title: string
    bodySectionsHtml: string
    linkUrl: string
    linkLabel: string
  }
  direct_message: {
    recipientName: string
    senderName: string
    subject: string
    bodyPreview: string
    linkUrl: string
  }
}

function parseSender(fromStr: string): { name: string; email: string } {
  const match = fromStr.match(/^(.+?)\s*<([^>]+)>$/)
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() }
  }
  return { name: "CourseCollab", email: fromStr.trim() }
}

/**
 * Send via Brevo Transactional API (bypasses SMTP activation)
 */
async function sendViaBrevoApi(
  sender: { name: string; email: string },
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) return { success: false, error: "BREVO_API_KEY not set" }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { name: sender.name, email: sender.email },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = err?.message || res.statusText || `HTTP ${res.status}`
    return { success: false, error: msg }
  }

  return { success: true }
}

/**
 * Send an email using the specified template
 * Uses Brevo API when BREVO_API_KEY is set, otherwise SMTP
 * @param type - Email template type
 * @param to - Recipient email address
 * @param params - Template parameters (order of Object.values must match template args)
 */
export async function sendEmail<T extends EmailType>(
  type: T,
  to: string,
  params: EmailParams[T]
): Promise<{ success: boolean; error?: string }> {
  const fromStr = process.env.EMAIL_FROM || "danieldoe@course-collab.com"
  const sender = parseSender(fromStr)

  const hasApiKey = !!process.env.BREVO_API_KEY
  const hasSmtp =
    process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS

  if (!hasApiKey && !hasSmtp) {
    console.error("[Email] Missing BREVO_API_KEY or SMTP credentials")
    return { success: false, error: "Email service not configured" }
  }

  try {
    const templateFn = emailTemplates[type]
    if (!templateFn) {
      console.error("[Email] Unknown template type:", type)
      return { success: false, error: `Unknown template: ${type}` }
    }

    /** Positional args must match template signatures — do not use `Object.values` here. */
    let template: { subject: string; html: string }
    if (type === "recommendation_student_update") {
      const p = params as EmailParams["recommendation_student_update"]
      template = emailTemplates.recommendation_student_update(
        p.studentFirstName,
        p.subject,
        p.title,
        p.bodySectionsHtml,
        p.linkUrl,
        p.linkLabel,
      )
    } else if (type === "recommendation_instructor_update") {
      const p = params as EmailParams["recommendation_instructor_update"]
      template = emailTemplates.recommendation_instructor_update(
        p.instructorDisplayName,
        p.subject,
        p.title,
        p.bodySectionsHtml,
        p.linkUrl,
        p.linkLabel,
      )
    } else if (type === "course_exchange_faculty_alert") {
      const p = params as EmailParams["course_exchange_faculty_alert"]
      template = emailTemplates.course_exchange_faculty_alert(
        p.title,
        p.bodyHtml,
        p.linkLabel,
        p.linkUrl,
        p.footerNote,
      )
    } else if (type === "direct_message") {
      const p = params as EmailParams["direct_message"]
      template = emailTemplates.direct_message(
        p.recipientName,
        p.senderName,
        p.subject,
        p.bodyPreview,
        p.linkUrl,
      )
    } else if (type === "midterm_progress_review") {
      const p = params as EmailParams["midterm_progress_review"]
      template = emailTemplates.midterm_progress_review(
        p.studentFirstName,
        p.subject,
        p.title,
        p.bodySectionsHtml,
        p.linkUrl,
        p.linkLabel,
      )
    } else {
      template = templateFn(...(Object.values(params) as unknown[]))
    }

    if (!template?.subject || !template?.html) {
      console.error("[Email] Template returned invalid subject/html")
      return { success: false, error: "Invalid template output" }
    }

    if (hasApiKey) {
      const result = await sendViaBrevoApi(
        sender,
        to,
        template.subject,
        template.html
      )
      if (result.success) {
        console.log("[Email] Sent via Brevo API to:", to, "| type:", type)
      }
      return result
    }

    await transporter.sendMail({
      from: fromStr,
      to,
      subject: template.subject,
      html: template.html,
    })

    console.log("[Email] Sent via SMTP to:", to, "| type:", type)
    return { success: true }
  } catch (err) {
    console.error("[Email] Error sending to", to, "| type:", type, "| error:", err)
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
