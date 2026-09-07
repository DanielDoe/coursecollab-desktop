import { NextRequest, NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/compliance/cron-auth"
import { sql } from "@/lib/db"
import { grantMembershipPerks } from "@/lib/membership"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * Downgrade students whose membership has expired (expires_at < NOW).
 * Runs daily to ensure students who stopped paying don't continue to enjoy perks.
 * Handles missed Stripe webhooks and expired one-time (semester) payments.
 */
export async function GET(request: NextRequest) {
  try {
    const cron = requireCronAuth(request)
    if (!cron.ok) return cron.response

    const expiredActive = await sql`
      SELECT m.id, m.student_id, m.tier, m.plan, s.full_name
      FROM memberships m
      JOIN students s ON m.student_id = s.id
      WHERE m.status = 'active'
        AND m.expires_at IS NOT NULL
        AND m.expires_at < NOW()
        AND (COALESCE(m.tier, m.plan) != 'Scholar')
    `

    const downgraded: { student: string; from: string }[] = []

    for (const row of expiredActive) {
      await sql`
        UPDATE students
        SET membership_tier = 'Scholar'
        WHERE id = ${row.student_id}
      `
      await sql`
        UPDATE memberships
        SET tier = 'Scholar', plan = 'Scholar', status = 'expired', auto_renew = false, updated_at = CURRENT_TIMESTAMP
        WHERE student_id = ${row.student_id}
      `
      try {
        await grantMembershipPerks(row.student_id, "Scholar")
      } catch (perkError) {
        console.error(`[Cron] Failed to grant Scholar perks for ${row.full_name}:`, perkError)
      }
      downgraded.push({
        student: row.full_name,
        from: row.tier || row.plan || "unknown",
      })
    }

    return NextResponse.json({
      ok: true,
      downgraded: downgraded.length,
      details: downgraded,
    })
  } catch (error) {
    console.error("[Cron] Downgrade expired memberships failed:", error)
    return NextResponse.json(
      { error: "Failed to downgrade expired memberships", details: String(error) },
      { status: 500 }
    )
  }
}
