import { sendEmail } from "@/lib/email/sendEmail"
import { sql } from "@/lib/db"
import { tradeCenterBaseUrl } from "@/lib/trade-center-peer-transfer"

export async function sendEcTradeSuccessEmail(options: {
  studentId: number
  pointsTraded: number
  creditsGained: number
  totalEc: number
}): Promise<void> {
  try {
    const rows = await sql`
      SELECT full_name, email FROM students WHERE id = ${options.studentId} LIMIT 1
    `
    const row = rows[0] as { full_name?: string; email?: string | null } | undefined
    const email = row?.email?.trim()
    if (!email) return

    const name = row?.full_name?.trim() || "there"
    const dashboardLink = `${tradeCenterBaseUrl()}/student/dashboard-v2/trade-center`
    const introHtml = `
      <p style="margin:0 0 12px;">You traded <strong>${options.pointsTraded}</strong> activity points for
      <strong>${options.creditsGained}</strong> Engagement Credit${options.creditsGained === 1 ? "" : "s"}.</p>
      <p style="margin:0;">Your total EC this week is now <strong>${options.totalEc}</strong>.</p>
    `

    const res = await sendEmail("trade_center_peer_transfer_done", email, {
      name,
      introHtml,
      dashboardLink,
    })
    if (!res.success) {
      console.warn("[Trade Center] EC trade email skipped:", email, res.error)
    }
  } catch (e) {
    console.error("[Trade Center] sendEcTradeSuccessEmail", e)
  }
}
