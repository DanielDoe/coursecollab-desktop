import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAuthenticatedStudentFromRequest } from "@/lib/trade-center-student-access"

export const dynamic = "force-dynamic"

function peerSourceLabel(source: string | null) {
  if (!source) return ""
  const m: Record<string, string> = {
    practice: "Practice Hub",
    playground: "Playground",
    reading: "Lecture Reading",
    total: "Activity total",
    classroom: "Classroom",
  }
  return m[source] || source
}

/**
 * GET ?studentId= — activity trades (EC), donations logged in trade_transactions, rollover trades, peer request rows
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const limit = Math.min(200, Math.max(10, parseInt(searchParams.get("limit") || "80", 10)))

    const resolved = await requireAuthenticatedStudentFromRequest(request, studentId)
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    }
    const sid = resolved.studentId

    const transactions = await sql`
      SELECT
        tt.id,
        tt.student_id,
        tt.session,
        tt.transaction_type,
        tt.points_used,
        tt.credits_gained,
        tt.recipient_id,
        tt.donation_pool_type,
        tt.created_at,
        donor.full_name as donor_name,
        recip.full_name as recipient_name
      FROM trade_transactions tt
      LEFT JOIN students donor ON donor.id = tt.student_id
      LEFT JOIN students recip ON recip.id = tt.recipient_id
      WHERE tt.student_id = ${sid} OR tt.recipient_id = ${sid}
      ORDER BY tt.id DESC
      LIMIT ${limit}
    `

    const enriched = (transactions as Record<string, unknown>[]).map((row) => {
      const studentIdRow = Number(row.student_id)
      const recipientId = row.recipient_id != null ? Number(row.recipient_id) : null
      const ttype = String(row.transaction_type || "")
      let role: string
      let summary: string
      if (ttype === "TRADE") {
        role = "ec_trade"
        summary = `Traded ${row.points_used} activity pts → ${row.credits_gained ?? 0} EC`
      } else if (ttype === "DONATION") {
        if (recipientId && recipientId === sid) {
          role = "peer_in"
          summary = `Received ${row.points_used} pts from ${row.donor_name || "peer"}`
        } else if (String(row.donation_pool_type) === "COMMUNITY") {
          role = "community_out"
          summary = `Donated ${row.points_used} pts to community pool`
        } else {
          role = "peer_out"
          summary = `Sent ${row.points_used} pts to ${row.recipient_name || "peer"}`
        }
      } else {
        role = "other"
        summary = `${ttype}: ${row.points_used} pts`
      }
      return { ...row, role, summary }
    })

    const rollovers = await sql`
      SELECT
        grt.id,
        grt.student_id,
        grt.session,
        grt.quiz_id,
        grt.hours,
        grt.points_cost,
        grt.points_deducted,
        grt.source_category,
        COALESCE(q.title, 'Assessment') as quiz_title,
        sar.applied_at,
        sar.expires_at
      FROM grade_rollover_trades grt
      LEFT JOIN quizzes q ON q.id = grt.quiz_id
      LEFT JOIN student_assessment_rollovers sar
        ON sar.student_id = grt.student_id AND sar.quiz_id = grt.quiz_id
      WHERE grt.student_id = ${sid}
      ORDER BY sar.applied_at DESC NULLS LAST, grt.id DESC
      LIMIT ${limit}
    `

    const rolloverEnriched = (rollovers as Record<string, unknown>[]).map((r) => ({
      ...r,
      role: "rollover",
      summary: `Rollover: −${r.points_deducted ?? r.points_cost} from ${String(r.source_category || "category")} on 100% scale → “${r.quiz_title}” (${r.hours}h window)`,
    }))

    let extraAttemptsEnriched: Record<string, unknown>[] = []
    try {
      const extraAttempts = await sql`
        SELECT
          geat.id,
          geat.student_id,
          geat.session,
          geat.quiz_id,
          geat.additional_attempts,
          geat.points_cost,
          geat.points_deducted,
          geat.source_category,
          geat.created_at,
          COALESCE(q.title, 'Assessment') as quiz_title
        FROM grade_extra_attempt_trades geat
        LEFT JOIN quizzes q ON q.id = geat.quiz_id
        WHERE geat.student_id = ${sid}
        ORDER BY geat.created_at DESC, geat.id DESC
        LIMIT ${limit}
      `
      extraAttemptsEnriched = (extraAttempts as Record<string, unknown>[]).map((r) => ({
        ...r,
        role: "extra_attempts",
        summary: `Extra attempts: −${r.points_deducted ?? r.points_cost} from ${String(r.source_category || "category")} on 100% scale → +${r.additional_attempts} on “${r.quiz_title}”`,
      }))
    } catch {
      extraAttemptsEnriched = []
    }

    const donationRequests = await sql`
      SELECT dr.*,
        d.full_name as donor_name, d.student_id as donor_student_id,
        r.full_name as recipient_name, r.student_id as recipient_student_id
      FROM donation_requests dr
      JOIN students d ON dr.donor_id = d.id
      JOIN students r ON dr.recipient_id = r.id
      WHERE dr.donor_id = ${sid} OR dr.recipient_id = ${sid}
      ORDER BY dr.created_at DESC
      LIMIT ${limit}
    `

    const drEnriched = (donationRequests as Record<string, unknown>[]).map((d) => {
      const donor = Number(d.donor_id)
      const pts = d.points
      const src = peerSourceLabel(String(d.source || ""))
      const isDonor = donor === sid
      return {
        ...d,
        role: "peer_donation_request",
        summary: isDonor
          ? `Donation request: ${pts} ${src} pts → ${d.recipient_name} (${d.status})`
          : `Incoming donation request: ${pts} ${src} pts from ${d.donor_name} (${d.status})`,
      }
    })

    const pointRequestsRaw = await sql`
      SELECT pr.*,
        req.full_name as requester_name, req.student_id as requester_student_id,
        ree.full_name as requestee_name, ree.student_id as requestee_student_id
      FROM point_requests pr
      JOIN students req ON pr.requester_id = req.id
      JOIN students ree ON pr.requestee_id = ree.id
      WHERE pr.requester_id = ${sid} OR pr.requestee_id = ${sid}
      ORDER BY pr.created_at DESC
      LIMIT ${limit}
    `

    const pointRequests = (pointRequestsRaw as Record<string, unknown>[]).map((pr) => {
      const requester = Number(pr.requester_id)
      const pts = pr.points
      const src = peerSourceLabel(String(pr.source || ""))
      const isRequester = requester === sid
      return {
        ...pr,
        role: "peer_point_request",
        summary: isRequester
          ? `Requested ${pts} ${src} pts from ${pr.requestee_name} (${pr.status})`
          : `Request from ${pr.requester_name}: ${pts} ${src} pts (${pr.status})`,
      }
    })

    return NextResponse.json({
      transactions: enriched,
      rollovers: rolloverEnriched,
      extraAttempts: extraAttemptsEnriched,
      donationRequests: drEnriched,
      pointRequests,
    })
  } catch (e) {
    console.error("[my-history]", e)
    return NextResponse.json({ error: "Failed to load trade history" }, { status: 500 })
  }
}
