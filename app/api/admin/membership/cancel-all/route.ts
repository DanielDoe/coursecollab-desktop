import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import { stripe } from "@/lib/stripe"

export const dynamic = "force-dynamic"

type CancelResult = {
  studentId: number
  studentName: string
  subscriptionId: string
  status: "success" | "error"
  message: string
}

/**
 * POST /api/admin/membership/cancel-all
 * Cancels every Stripe subscription referenced in `students` or `memberships`, clears refs,
 * and turns off auto_renew on all membership rows. By default also downgrades affected
 * students to Scholar (semester ended).
 *
 * Body (optional JSON): `{ "downgradeToScholar": true }` (default true). Set false to only
 * stop Stripe charges and clear subscription IDs without changing tiers.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminId(request)
    if (!admin.ok) return admin.response

    if (!stripe) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 })
    }

    let downgradeToScholar = true
    try {
      const contentType = request.headers.get("content-type") || ""
      if (contentType.includes("application/json")) {
        const body = (await request.json()) as { downgradeToScholar?: boolean }
        if (typeof body?.downgradeToScholar === "boolean") {
          downgradeToScholar = body.downgradeToScholar
        }
      }
    } catch {
      // no / invalid JSON body — keep default
    }

    const subscriptionRows = await sql`
      SELECT stripe_subscription_id
      FROM (
        SELECT stripe_subscription_id FROM students WHERE stripe_subscription_id IS NOT NULL
        UNION
        SELECT stripe_subscription_id FROM memberships WHERE stripe_subscription_id IS NOT NULL
      ) u
      WHERE stripe_subscription_id IS NOT NULL
      ORDER BY stripe_subscription_id
    ` as { stripe_subscription_id: string }[]

    await sql`
      UPDATE memberships
      SET auto_renew = false, updated_at = CURRENT_TIMESTAMP
      WHERE auto_renew IS DISTINCT FROM false
    `

    if (subscriptionRows.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No Stripe subscription IDs in database; auto_renew disabled for memberships.",
        canceledCount: 0,
        downgradeToScholar,
        results: [] as CancelResult[],
      })
    }

    console.log(`[Cancel All] Found ${subscriptionRows.length} distinct subscription id(s)`)

    const results: CancelResult[] = []
    let subscriptionsOk = 0
    let subscriptionsErrored = 0

    const { grantMembershipPerks } = await import("@/lib/membership")

    for (const row of subscriptionRows) {
      const subId = row.stripe_subscription_id

      try {
        try {
          const subscription = await stripe.subscriptions.retrieve(subId)

          if (subscription.status === "canceled" || subscription.status === "incomplete_expired") {
            console.log(`[Cancel All] Subscription ${subId} already canceled in Stripe`)
          } else {
            await stripe.subscriptions.cancel(subId)
            console.log(`[Cancel All] Canceled subscription ${subId} in Stripe`)
          }
        } catch (stripeError: unknown) {
          const code = (stripeError as { code?: string })?.code
          if (code === "resource_missing") {
            console.log(`[Cancel All] Subscription ${subId} not found in Stripe`)
          } else {
            throw stripeError
          }
        }

        const affectedStudents = await sql`
          SELECT DISTINCT id, full_name FROM students WHERE stripe_subscription_id = ${subId}
          UNION
          SELECT DISTINCT s.id, s.full_name
          FROM memberships m
          JOIN students s ON m.student_id = s.id
          WHERE m.stripe_subscription_id = ${subId}
        ` as { id: number; full_name: string }[]

        for (const st of affectedStudents) {
          if (downgradeToScholar) {
            await sql`
              UPDATE students
              SET membership_tier = 'Scholar', stripe_subscription_id = NULL
              WHERE id = ${st.id}
            `
          } else {
            await sql`
              UPDATE students
              SET stripe_subscription_id = NULL
              WHERE id = ${st.id} AND stripe_subscription_id = ${subId}
            `
          }
        }

        if (downgradeToScholar) {
          await sql`
            UPDATE memberships
            SET
              status = 'canceled',
              plan = 'Scholar',
              tier = 'Scholar',
              stripe_subscription_id = NULL,
              end_date = CURRENT_TIMESTAMP,
              auto_renew = false,
              updated_at = CURRENT_TIMESTAMP
            WHERE stripe_subscription_id = ${subId}
          `
        } else {
          await sql`
            UPDATE memberships
            SET
              stripe_subscription_id = NULL,
              auto_renew = false,
              updated_at = CURRENT_TIMESTAMP
            WHERE stripe_subscription_id = ${subId}
          `
        }

        for (const st of affectedStudents) {
          if (downgradeToScholar) {
            try {
              await grantMembershipPerks(st.id, "Scholar")
            } catch (perkError) {
              console.error(`[Cancel All] Failed to grant Scholar perks for student ${st.id}:`, perkError)
            }
          }

          results.push({
            studentId: st.id,
            studentName: st.full_name,
            subscriptionId: subId,
            status: "success",
            message: downgradeToScholar
              ? "Subscription canceled and downgraded to Scholar"
              : "Subscription canceled; tiers unchanged",
          })
        }

        if (affectedStudents.length === 0) {
          results.push({
            studentId: 0,
            studentName: "(no matching student row)",
            subscriptionId: subId,
            status: "success",
            message: "Stripe subscription canceled; no student/membership link found in DB",
          })
        }

        subscriptionsOk++
      } catch (error: unknown) {
        subscriptionsErrored++
        const message = error instanceof Error ? error.message : "Unknown error"
        console.error(`[Cancel All] Error processing subscription ${subId}:`, error)
        results.push({
          studentId: 0,
          studentName: "",
          subscriptionId: subId,
          status: "error",
          message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${subscriptionRows.length} subscription(s). ${subscriptionsOk} succeeded, ${subscriptionsErrored} failed.`,
      canceledCount: subscriptionsOk,
      errorCount: subscriptionsErrored,
      totalSubscriptions: subscriptionRows.length,
      downgradeToScholar,
      results,
    })
  } catch (error: unknown) {
    console.error("[Cancel All] Fatal error:", error)
    const details = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        error: "Failed to cancel all subscriptions",
        details,
      },
      { status: 500 },
    )
  }
}
