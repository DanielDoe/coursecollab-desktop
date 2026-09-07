/**
 * Send a one-off HTML email to many students (Brevo API or SMTP via sendEmail).
 */
import { sql } from "@/lib/db"
import { sendEmail } from "@/lib/email/sendEmail"
import { isValidStudentEmail } from "@/lib/email/send-notification-email"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { escapeHtmlForEmail } from "@/lib/email/emailTemplates"

/** `"all"` → null (entire roster). One code or comma-separated codes → merged SQL match variants. */
export function expandBroadcastSectionVariants(sectionFilter: string): string[] | null {
  const sf = sectionFilter.trim()
  if (sf.toLowerCase() === "all") return null
  const parts = sf.split(",").map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return null
  const set = new Set<string>()
  for (const p of parts) {
    for (const v of normalizedSectionVariantsForSql(p)) {
      set.add(v)
    }
  }
  return Array.from(set)
}

/** Turn plain text (paragraphs separated by blank lines) into safe HTML. */
export function plainTextBroadcastToHtml(plain: string): string {
  const chunks = plain.trim().split(/\n\n+/)
  return chunks
    .map((chunk) => {
      const withBreaks = escapeHtmlForEmail(chunk).replace(/\n/g, "<br/>")
      return `<p style="margin:0 0 16px;color:#334155;font-size:16px;">${withBreaks}</p>`
    })
    .join("")
}

export type BroadcastResult = {
  recipients: number
  sent: number
  failed: number
  failedEmails: string[]
}

async function loadBroadcastRecipientRows(sectionFilter: string) {
  const variants = expandBroadcastSectionVariants(sectionFilter)

  if (variants == null || variants.length === 0) {
    return await sql`
      SELECT id, email, full_name
      FROM students
      WHERE email IS NOT NULL
        AND TRIM(email) <> ''
      ORDER BY id ASC
    `
  }
  return await sql`
    SELECT s.id, s.email, s.full_name
    FROM students s
    LEFT JOIN sessions sess ON sess.id = s.session_id
    WHERE s.email IS NOT NULL
      AND TRIM(s.email) <> ''
      AND (
        TRIM(s.section) = ANY(${variants}::text[])
        OR EXISTS (
          SELECT 1 FROM sessions sess_f
          WHERE sess_f.id = s.session_id
            AND TRIM(sess_f.code) = ANY(${variants}::text[])
        )
      )
    ORDER BY s.id ASC
  `
}

/** Unique valid recipient emails for preview / dry run. */
export async function countInstructorBroadcastRecipients(sectionFilter = "all"): Promise<number> {
  const rows = await loadBroadcastRecipientRows(sectionFilter)
  const seen = new Set<string>()
  let n = 0
  for (const r of rows as { email: string | null }[]) {
    if (!isValidStudentEmail(r.email)) continue
    const key = r.email!.trim().toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    n++
  }
  return n
}

/**
 * @param sectionFilter - `"all"` for every student with a real email; else section code(s), comma-separated (e.g. `ELEG1301P01,ELEG1304P01`).
 * @param delayMs - pause between sends to reduce provider rate limits
 * @param bodyHtml - optional pre-built HTML; if omitted, `bodyPlain` is converted to paragraphs
 */
export async function sendInstructorBroadcastEmails(opts: {
  subject: string
  bodyPlain?: string
  bodyHtml?: string
  sectionFilter?: string
  delayMs?: number
}): Promise<BroadcastResult> {
  const sectionFilter = (opts.sectionFilter ?? "all").trim()
  const rows = await loadBroadcastRecipientRows(sectionFilter)

  const bodyHtml =
    opts.bodyHtml?.trim() ||
    (opts.bodyPlain != null ? plainTextBroadcastToHtml(opts.bodyPlain) : "")
  if (!bodyHtml) {
    throw new Error("sendInstructorBroadcastEmails: provide bodyHtml or bodyPlain")
  }
  const delayMs = opts.delayMs ?? 75

  const seen = new Set<string>()
  const targets: { email: string }[] = []
  for (const r of rows as { email: string | null }[]) {
    if (!isValidStudentEmail(r.email)) continue
    const key = r.email!.trim().toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    targets.push({ email: r.email!.trim() })
  }

  let sent = 0
  let failed = 0
  const failedEmails: string[] = []

  for (const t of targets) {
    const result = await sendEmail("instructor_broadcast", t.email, {
      subject: opts.subject,
      bodyHtml,
    })
    if (result.success) sent++
    else {
      failed++
      failedEmails.push(t.email)
    }
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))
  }

  return {
    recipients: targets.length,
    sent,
    failed,
    failedEmails,
  }
}
