import { sql } from "@/lib/db"
import { sendEmail } from "@/lib/email/sendEmail"
import { CLASSROOM_POINTS_FOR_FULL_GRADE } from "@/lib/classroom-points-grade-scale"
import { classroomPointsSessionKeys, resolveClassroomPointsStorageSession, resolveTradeSessionForStudent } from "@/lib/trade-center-student-access"
import { recalculateAndSaveGrade } from "@/lib/grades"

/** Approved classroom total must stay at or above this after a peer transfer out. */
export const MIN_CLASSROOM_PEER_RESERVE = CLASSROOM_POINTS_FOR_FULL_GRADE

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export async function getClassroomApprovedTotal(studentId: number, session: string): Promise<number> {
  const sessionKeys = await classroomPointsSessionKeys(session)
  if (sessionKeys.length === 0) return 0
  const rows = await sql`
    SELECT COALESCE(SUM(points), 0)::numeric AS total
    FROM classroom_points
    WHERE student_id = ${studentId}
      AND session = ANY(${sessionKeys})
      AND (status = 'approved' OR status IS NULL)
  `
  const raw = Number(rows[0]?.total ?? 0)
  return Math.round(raw * 100) / 100
}

export function getClassroomTradableAmount(approvedTotal: number): number {
  return Math.max(0, Math.floor(approvedTotal) - MIN_CLASSROOM_PEER_RESERVE)
}

export async function resolveInstructorIdForTransfer(preferredId: number | null | undefined): Promise<number> {
  if (preferredId != null && !Number.isNaN(preferredId) && Number(preferredId) > 0) {
    const r = await sql`SELECT id FROM instructors WHERE id = ${preferredId} LIMIT 1`
    if (r.length > 0) return preferredId
  }
  throw new Error(
    "Trade transfer requires a valid instructor. Refusing to default to the first instructor row.",
  )
}

export function tradeCenterBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "https://course-collab.com"
  )
}

export async function getInstructorEmailsForSection(session: string): Promise<{ email: string; name: string }[]> {
  try {
    const fromAttendance = await sql`
      SELECT DISTINCT i.email, i.name
      FROM attendance_sessions a
      INNER JOIN instructors i ON i.id = a.instructor_id
      WHERE a.section = ${session}
        AND i.email IS NOT NULL
        AND TRIM(i.email) <> ''
    `
    if (fromAttendance.length > 0) {
      return fromAttendance as { email: string; name: string }[]
    }
  } catch {
    // table may be missing in some environments
  }
  const fallback = await sql`
    SELECT email, name FROM instructors
    WHERE email IS NOT NULL AND TRIM(email) <> ''
    ORDER BY id ASC
    LIMIT 8
  `
  return (fallback || []) as { email: string; name: string }[]
}

export type PeerTransferNotifyKind = "donation_pending" | "point_request_peer" | "point_request_instructor"

export function notifyInstructorsPeerTransferInitiated(options: {
  session: string
  kind: PeerTransferNotifyKind
  summaryLines: string[]
}): void {
  const link = `${tradeCenterBaseUrl()}/instructor/dashboard-v2/students/trade-center`
  const title =
    options.kind === "donation_pending"
      ? "Trade Center: donation awaiting your approval"
      : options.kind === "point_request_peer"
        ? "Trade Center: new peer point request"
        : "Trade Center: point transfer ready for your approval"

  const bodyHtml = `
    ${options.summaryLines.map((l) => `<p style="margin:10px 0;">${escapeHtml(l)}</p>`).join("")}
    <p style="margin:14px 0 0;"><strong>Section:</strong> ${escapeHtml(options.session)}</p>
  `

  void (async () => {
    try {
      const recipients = await getInstructorEmailsForSection(options.session)
      for (const r of recipients) {
        if (!r.email?.trim()) continue
        const res = await sendEmail("trade_center_instructor_alert", r.email.trim(), {
          title,
          bodyHtml,
          linkLabel: "Open Trade Center",
          linkUrl: link,
        })
        if (!res.success) console.warn("[Trade Center] Instructor email skipped:", r.email, res.error)
      }
    } catch (e) {
      console.error("[Trade Center] notifyInstructorsPeerTransferInitiated failed", e)
    }
  })()
}

export function peerTransferSourceLabel(source: string): string {
  switch (source) {
    case "practice":
      return "Practice Hub"
    case "playground":
      return "Playground"
    case "reading":
      return "Lecture Reading"
    case "total":
      return "Total (activity)"
    case "classroom":
      return "Classroom"
    default:
      return source
  }
}

export function sendPeerTransferCompletionEmails(options: {
  kind: "donation" | "point_request"
  source: string
  points: number
  fromStudent: { full_name: string; email: string | null }
  toStudent: { full_name: string; email: string | null }
}): void {
  const sourceLabel = peerTransferSourceLabel(options.source)
  const dashboardLink = `${tradeCenterBaseUrl()}/student/dashboard-v2/trade-center`
  const a = escapeHtml(options.fromStudent.full_name)
  const b = escapeHtml(options.toStudent.full_name)
  const pts = options.points

  const payloads: { email: string; name: string; introHtml: string }[] = []

  if (options.kind === "donation") {
    if (options.fromStudent.email?.trim()) {
      payloads.push({
        email: options.fromStudent.email.trim(),
        name: options.fromStudent.full_name,
        introHtml: `Your instructor approved your donation of <strong>${pts}</strong> ${sourceLabel} points to <strong>${b}</strong>. The transfer has been applied.`,
      })
    }
    if (options.toStudent.email?.trim()) {
      payloads.push({
        email: options.toStudent.email.trim(),
        name: options.toStudent.full_name,
        introHtml: `You received <strong>${pts}</strong> ${sourceLabel} points from <strong>${a}</strong> (peer exchange approved by your instructor).`,
      })
    }
  } else {
    if (options.fromStudent.email?.trim()) {
      payloads.push({
        email: options.fromStudent.email.trim(),
        name: options.fromStudent.full_name,
        introHtml: `Your instructor approved transferring <strong>${pts}</strong> ${sourceLabel} points to <strong>${b}</strong>. Points have been moved as requested.`,
      })
    }
    if (options.toStudent.email?.trim()) {
      payloads.push({
        email: options.toStudent.email.trim(),
        name: options.toStudent.full_name,
        introHtml: `You received <strong>${pts}</strong> ${sourceLabel} points from <strong>${a}</strong> (peer request approved by your instructor).`,
      })
    }
  }

  void (async () => {
    for (const p of payloads) {
      try {
        const res = await sendEmail("trade_center_peer_transfer_done", p.email, {
          name: p.name,
          introHtml: p.introHtml,
          dashboardLink,
        })
        if (!res.success) console.warn("[Trade Center] Student completion email:", p.email, res.error)
      } catch (e) {
        console.error("[Trade Center] sendPeerTransferCompletionEmails", e)
      }
    }
  })()
}

/** Recompute grades after classroom peer points move (donation / point-request approval). */
export async function syncGradesAfterClassroomPeerTransfer(
  donorOrRequesteeId: number,
  recipientOrRequesterId: number,
  sessionFragment: string,
): Promise<void> {
  try {
    for (const studentId of [donorOrRequesteeId, recipientOrRequesterId]) {
      const session = await resolveTradeSessionForStudent(sessionFragment, studentId)
      await recalculateAndSaveGrade(studentId, session)
    }
  } catch (e) {
    console.error("[Trade Center] grade sync after classroom peer transfer", e)
  }
}
