/**
 * ECE 2202 — Tuesday June 23 class cancellation (24-hour announcement + dashboard banner).
 *
 * Override expiry for testing: ECE2202_CLASS_CANCEL_EXPIRES_ISO (ISO-8601).
 */

export const ECE2202_CLASS_CANCEL_ANNOUNCEMENT_TITLE =
  "ECE 2202 — No class Tuesday, June 23 · Op-Amps self-study"

export const ECE2202_CLASS_CANCEL_CLASS_DATE_LABEL = "Tuesday, June 23, 2026"

export const ECE2202_CLASS_CANCEL_RECORDED_LECTURE_URL =
  "https://youtu.be/e5Xt_lXvDdg?is=xnE6KHDVbGrajHK_"

export const ECE2202_CLASS_CANCEL_COURSE_CODE = "ECE2202"

/** Bump when re-seeding so banner dismiss resets. */
export const ECE2202_CLASS_CANCEL_BANNER_DISMISS_KEY =
  "cc_dismiss_banner_ece2202_class_cancel_june23_v1"

const DEFAULT_DURATION_MS = 24 * 60 * 60 * 1000

/** Campaign start (Central). Override: ECE2202_CLASS_CANCEL_PUBLISHED_ISO */
export const ECE2202_CLASS_CANCEL_ANNOUNCEMENT_PUBLISHED_AT = (() => {
  const raw = process.env.ECE2202_CLASS_CANCEL_PUBLISHED_ISO?.trim()
  if (raw) {
    const d = new Date(raw)
    if (Number.isFinite(d.getTime())) return d
  }
  return new Date("2026-06-22T23:45:00.000-05:00")
})()

function parseEnvExpiry(): Date | null {
  const raw = process.env.ECE2202_CLASS_CANCEL_EXPIRES_ISO?.trim()
  if (!raw) return null
  const d = new Date(raw)
  return Number.isFinite(d.getTime()) ? d : null
}

/** When the current campaign ends (24h after publish unless overridden). */
export function resolveEce2202ClassCancelExpiresAt(
  publishedAt: Date = ECE2202_CLASS_CANCEL_ANNOUNCEMENT_PUBLISHED_AT,
): Date {
  return parseEnvExpiry() ?? new Date(publishedAt.getTime() + DEFAULT_DURATION_MS)
}

export const ECE2202_CLASS_CANCEL_ANNOUNCEMENT_EXPIRES_AT =
  resolveEce2202ClassCancelExpiresAt(ECE2202_CLASS_CANCEL_ANNOUNCEMENT_PUBLISHED_AT)

export function isEce2202ClassCancelAnnouncementActive(
  at: Date = new Date(),
): boolean {
  return at.getTime() <= ECE2202_CLASS_CANCEL_ANNOUNCEMENT_EXPIRES_AT.getTime()
}

export function isEce2202StudentSection(section: string | null | undefined): boolean {
  const code = String(section ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
  return code === "ECE2202" || code.startsWith("ECE2202")
}

export function buildEce2202ClassCancelAnnouncementContent(): string {
  return `<p>I have an emergency to attend to and will <strong>not be able to make class on ${ECE2202_CLASS_CANCEL_CLASS_DATE_LABEL}</strong>. I sincerely apologize for any inconvenience this may cause.</p>

<p><strong>While I am away, please:</strong></p>
<ul>
  <li>Start <strong>Op-Amps Lecture 4</strong> on CourseCollab.</li>
  <li>Work through the <strong>sample practice problems</strong> on the Lecture 4 slides.</li>
  <li>Watch the recorded op-amp lecture: <a href="${ECE2202_CLASS_CANCEL_RECORDED_LECTURE_URL}" target="_blank" rel="noopener noreferrer">YouTube recording</a>.</li>
</ul>

<p><strong>Coming up:</strong></p>
<ul>
  <li>I will upload the <strong>Classroom Points op-amp questions</strong> tomorrow.</li>
  <li>Our plan is to <strong>finish op-amps this week</strong>.</li>
  <li>Next week we will start <strong>RC and RL first-order circuits</strong> — I will upload that material tomorrow as well.</li>
</ul>

<p>Thank you for your patience and for staying on track with the material.</p>`
}
