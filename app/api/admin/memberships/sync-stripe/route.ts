import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import { stripe, STRIPE_PRODUCTS } from "@/lib/stripe"
import { getSemesterEndDate } from "@/lib/semester-utils"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Process a semester (one-time) membership payment - mirrors webhook logic */
async function processSemesterPayment(
  studentId: number,
  planId: string,
  customerId: string | null,
  billingCadence: "monthly" | "semester",
  studentName: string
) {
  const semesterEndDate = await getSemesterEndDate()
  const expiresAt = semesterEndDate.toISOString()
  const autoRenew = false

  await sql`
    UPDATE students
    SET membership_tier = ${planId}, stripe_customer_id = ${customerId}
    WHERE id = ${studentId}
  `

  const existingMembership = await sql`
    SELECT id FROM memberships WHERE student_id = ${studentId} LIMIT 1
  `

  if (existingMembership.length > 0) {
    await sql`
      UPDATE memberships
      SET tier = ${planId}, plan = ${planId}, stripe_customer_id = ${customerId},
          billing_cadence = ${billingCadence}, status = 'active',
          expires_at = ${expiresAt}::timestamp, end_date = ${expiresAt}::timestamp,
          auto_renew = ${autoRenew}, updated_at = NOW(), deleted_at = NULL
      WHERE student_id = ${studentId}
    `
  } else {
    await sql`
      INSERT INTO memberships (
        student_id, tier, plan, stripe_customer_id, billing_cadence,
        status, expires_at, end_date, auto_renew, start_date
      )
      VALUES (
        ${studentId}, ${planId}, ${planId}, ${customerId},
        ${billingCadence}, 'active', ${expiresAt}::timestamp,
        ${expiresAt}::timestamp, ${autoRenew}, NOW()
      )
    `
  }

  try {
    const { grantMembershipPerks } = await import("@/lib/membership")
    await grantMembershipPerks(studentId, planId as any)
  } catch (perkError) {
    console.error(`[Sync Stripe] Failed to grant perks for ${studentName}:`, perkError)
  }

  console.log(`[Sync Stripe] ✅ Processed semester payment for ${studentName}: ${planId}`)
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    console.log("[Sync Stripe] Starting comprehensive membership sync from Stripe...")
    
    // Step 1: Get all students with Stripe customer IDs
    const studentsWithStripe = await sql`
      SELECT id, student_id, full_name, email, stripe_customer_id, membership_tier
      FROM students
      WHERE stripe_customer_id IS NOT NULL
    `
    
    console.log(`[Sync Stripe] Found ${studentsWithStripe.length} students with Stripe customer IDs`)
    
    // Step 2: Also check for students who might have subscriptions but no customer ID saved
    // Get all active subscriptions from Stripe and match by email
    console.log("[Sync Stripe] Checking for students with subscriptions but missing customer IDs...")
    const allSubscriptions = await stripe.subscriptions.list({
      status: 'all',
      limit: 100
    })
    
    const activeSubscriptions = allSubscriptions.data.filter(sub => 
      sub.status === 'active' || sub.status === 'trialing'
    )
    
    console.log(`[Sync Stripe] Found ${activeSubscriptions.length} active subscriptions in Stripe`)
    
    // For each active subscription, find the student by customer email
    const studentsToProcess = new Map<number, any>()
    
    // Add students with customer IDs
    for (const student of studentsWithStripe) {
      studentsToProcess.set(student.id, student)
    }
    
    // Find students by customer email for subscriptions without matched customer IDs
    for (const sub of activeSubscriptions) {
      const customerId = sub.customer as string
      try {
        const customer = await stripe.customers.retrieve(customerId)
        if (customer.email) {
          // Check if we already have this customer ID
          const existingStudent = studentsWithStripe.find(s => s.stripe_customer_id === customerId)
          if (!existingStudent) {
            // Try to find student by email
            const studentByEmail = await sql`
              SELECT id, student_id, full_name, email, stripe_customer_id, membership_tier
              FROM students
              WHERE email = ${customer.email}
              LIMIT 1
            `
            
            if (studentByEmail.length > 0) {
              const student = studentByEmail[0]
              // Update student with customer ID if missing
              if (!student.stripe_customer_id) {
                await sql`
                  UPDATE students
                  SET stripe_customer_id = ${customerId}
                  WHERE id = ${student.id}
                `
                console.log(`[Sync Stripe] ✅ Linked customer ${customerId} to student ${student.full_name} (${student.email})`)
              }
              studentsToProcess.set(student.id, { ...student, stripe_customer_id: customerId })
            } else {
              console.log(`[Sync Stripe] ⚠️ No student found for customer ${customerId} (${customer.email})`)
            }
          }
        }
      } catch (error: any) {
        console.error(`[Sync Stripe] Error processing subscription ${sub.id}:`, error.message)
      }
    }
    
    console.log(`[Sync Stripe] Processing ${studentsToProcess.size} students total`)

    const results = {
      processed: 0,
      updated: 0,
      created: 0,
      errors: [] as string[],
      details: [] as any[]
    }

    // Step 3: Process one-time payments (semester plans) - these don't create subscriptions!
    // Catches students like Jayvon Hammonds who purchased semester Trailblazer
    console.log("[Sync Stripe] Checking for semester (one-time) membership payments...")
    {
      try {
        const sessions = await stripe.checkout.sessions.list({
          status: "complete",
          limit: 100,
        })

        const membershipSessions = sessions.data.filter(
          (s) =>
            s.mode === "payment" &&
            s.metadata?.studentId &&
            (s.metadata?.planId === "Trailblazer" || s.metadata?.planId === "Explorer")
        )

        console.log(`[Sync Stripe] Found ${membershipSessions.length} completed semester checkout sessions`)

        for (const session of membershipSessions) {
          const studentId = parseInt(session.metadata!.studentId!, 10)
          const planId = session.metadata!.planId!
          const billingCadence = (session.metadata!.billingCadence as "monthly" | "semester") || "semester"
          const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null

          if (isNaN(studentId) || !planId) continue

          try {
            const studentRows = await sql`
              SELECT id, full_name FROM students WHERE id = ${studentId} LIMIT 1
            `
            if (studentRows.length === 0) {
              console.log(`[Sync Stripe] ⚠️ Student ID ${studentId} not found, skipping session ${session.id}`)
              continue
            }

            const studentName = studentRows[0].full_name

            // Check if membership already correct (avoid redundant updates)
            const currentMembership = await sql`
              SELECT tier, plan, expires_at FROM memberships
              WHERE student_id = ${studentId} AND status = 'active'
              LIMIT 1
            `
            if (
              currentMembership.length > 0 &&
              (currentMembership[0].tier === planId || currentMembership[0].plan === planId)
            ) {
              const expiresAt = currentMembership[0].expires_at
              if (expiresAt && new Date(expiresAt) > new Date()) {
                // Already has active membership - ensure perks are granted (handles webhook-perks-failed edge case)
                try {
                  const { grantMembershipPerks } = await import("@/lib/membership")
                  await grantMembershipPerks(studentId, planId as any)
                } catch (perkError) {
                  console.error(`[Sync Stripe] Failed to sync perks for ${studentName}:`, perkError)
                }
                continue
              }
            }

            await processSemesterPayment(studentId, planId, customerId, billingCadence, studentName)

            if (currentMembership.length === 0) {
              results.created++
            } else {
              results.updated++
            }
            results.details.push({
              student: studentName,
              action: currentMembership.length === 0 ? "created" : "updated",
              tier: planId,
              source: "semester_payment",
            })
          } catch (err: any) {
            console.error(`[Sync Stripe] Error processing session ${session.id}:`, err.message)
            results.errors.push(`Session ${session.id}: ${err.message}`)
          }
        }
      } catch (err: any) {
        console.error("[Sync Stripe] Error listing checkout sessions:", err.message)
        results.errors.push(`Checkout sessions: ${err.message}`)
      }
    }
    
    // Process all students (those with customer IDs and those found by email)
    for (const student of studentsToProcess.values()) {
      try {
        const customerId = student.stripe_customer_id
        
        if (!customerId) {
          console.log(`[Sync Stripe] ⚠️ Skipping ${student.full_name} - no customer ID`)
          continue
        }
        
        // Get all active subscriptions for this customer
        const subscriptions = await stripe.subscriptions.list({
          customer: customerId,
          status: 'all',
          limit: 100
        })
        
        const activeSubs = subscriptions.data.filter(sub => 
          sub.status === 'active' || sub.status === 'trialing'
        )
        
        if (activeSubs.length === 0) {
          // No active subscriptions - check for one-time (semester) payments before downgrading
          // Semester Trailblazer/Explorer purchasers have NO subscription, only PaymentIntent
          let hasSemesterPayment = false
          try {
            const paymentIntents = await stripe.paymentIntents.list({
              customer: customerId,
              limit: 20,
            })
            const membershipPayments = paymentIntents.data.filter(
              (pi) =>
                pi.status === "succeeded" &&
                pi.metadata?.studentId &&
                (pi.metadata?.planId === "Trailblazer" || pi.metadata?.planId === "Explorer")
            )
            if (membershipPayments.length > 0) {
              const latest = membershipPayments[0]
              const sid = parseInt(latest.metadata!.studentId!, 10)
              const planId = latest.metadata!.planId!
              const cadence = (latest.metadata!.billingCadence as "monthly" | "semester") || "semester"
              await processSemesterPayment(sid, planId, customerId, cadence, student.full_name)
              hasSemesterPayment = true
              results.updated++
              results.details.push({
                student: student.full_name,
                action: "updated",
                tier: planId,
                source: "semester_payment_fallback",
              })
            }
          } catch (piErr: any) {
            console.error(`[Sync Stripe] Error checking PaymentIntents for ${student.full_name}:`, piErr.message)
          }

          if (!hasSemesterPayment) {
            // No subscriptions AND no semester payment - downgrade if they had paid tier
            const currentMembership = await sql`
              SELECT id, tier, plan, status FROM memberships
              WHERE student_id = ${student.id}
              LIMIT 1
            `
            if (currentMembership.length > 0 && currentMembership[0].status === "active" &&
                (currentMembership[0].tier !== "Scholar" || currentMembership[0].plan !== "Scholar")) {
              await sql`
                UPDATE students SET membership_tier = 'Scholar' WHERE id = ${student.id}
              `
              await sql`
                UPDATE memberships
                SET tier = 'Scholar', plan = 'Scholar', status = 'canceled', updated_at = NOW()
                WHERE student_id = ${student.id}
              `
              try {
                const { grantMembershipPerks } = await import("@/lib/membership")
                await grantMembershipPerks(student.id, "Scholar")
              } catch (perkError) {
                console.error(`[Sync Stripe] Failed to grant Scholar perks for ${student.full_name}:`, perkError)
              }
              results.updated++
              results.details.push({
                student: student.full_name,
                action: "downgraded",
                from: currentMembership[0].tier || currentMembership[0].plan,
                to: "Scholar",
              })
            }
          }
          continue
        }
        
        // Determine highest tier from active subscriptions (use subscription's period_end for expires_at)
        let highestTier = 'Scholar'
        let subscriptionId: string | null = null
        let periodEnd: number | null = null
        
        for (const sub of activeSubs) {
          const priceId = sub.items.data[0]?.price.id
          if (priceId === STRIPE_PRODUCTS.Trailblazer) {
            highestTier = 'Trailblazer'
            subscriptionId = sub.id
            periodEnd = sub.cancel_at ?? sub.current_period_end
            break // Trailblazer is highest
          } else if (priceId === STRIPE_PRODUCTS.Explorer && highestTier !== 'Trailblazer') {
            highestTier = 'Explorer'
            subscriptionId = sub.id
            periodEnd = sub.cancel_at ?? sub.current_period_end
          }
        }

        // Set cancel_at to semester end on subscriptions that don't have it (monthly ends at semester)
        if (subscriptionId) {
          try {
            const sub = activeSubs.find((s) => s.id === subscriptionId)
            if (sub && !sub.cancel_at) {
              const semesterEnd = await getSemesterEndDate()
              const cancelAt = Math.floor(semesterEnd.getTime() / 1000)
              await stripe.subscriptions.update(subscriptionId, { cancel_at: cancelAt })
              periodEnd = cancelAt
            }
          } catch (e) {
            console.warn(`[Sync] Failed to set cancel_at on ${subscriptionId}:`, (e as Error)?.message)
          }
        }

        const expiresAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : null
        
        // Update student membership tier
        await sql`
          UPDATE students
          SET 
            membership_tier = ${highestTier},
            stripe_subscription_id = ${subscriptionId}
          WHERE id = ${student.id}
        `
        
        // Check if membership record exists
        const existingMembership = await sql`
          SELECT id, tier, plan, status FROM memberships
          WHERE student_id = ${student.id}
          LIMIT 1
        `
        
        if (existingMembership.length > 0) {
          // Update existing membership (use Stripe period_end for expires_at)
          await sql`
            UPDATE memberships
            SET
              tier = ${highestTier},
              plan = ${highestTier},
              stripe_subscription_id = ${subscriptionId},
              status = 'active',
              expires_at = ${expiresAt}::timestamp,
              end_date = ${expiresAt}::timestamp,
              auto_renew = false,
              updated_at = NOW()
            WHERE student_id = ${student.id}
          `
          results.updated++
          results.details.push({
            student: student.full_name,
            action: 'updated',
            tier: highestTier,
            subscriptionId
          })
        } else {
          // Create new membership (use Stripe period_end for expires_at)
          await sql`
            INSERT INTO memberships (
              student_id, tier, plan, stripe_customer_id, stripe_subscription_id, 
              status, expires_at, end_date, auto_renew, start_date
            )
            VALUES (
              ${student.id},
              ${highestTier},
              ${highestTier},
              ${customerId},
              ${subscriptionId},
              'active',
              ${expiresAt}::timestamp,
              ${expiresAt}::timestamp,
              false,
              NOW()
            )
          `
          results.created++
          results.details.push({
            student: student.full_name,
            action: 'created',
            tier: highestTier,
            subscriptionId
          })
        }
        
        // Grant perks
        try {
          const { grantMembershipPerks } = await import("@/lib/membership")
          await grantMembershipPerks(student.id, highestTier as any)
        } catch (perkError) {
          console.error(`[Sync Stripe] Failed to grant perks for ${student.full_name}:`, perkError)
        }
        
        results.processed++
      } catch (error: any) {
        const errorMsg = `Error processing ${student.full_name}: ${error.message}`
        console.error(`[Sync Stripe] ${errorMsg}`)
        results.errors.push(errorMsg)
      }
    }
    
    // Final pass: Downgrade memberships that have expired (expires_at < NOW) but status still 'active'
    // Handles missed webhooks and expired one-time payments
    const expiredActive = await sql`
      SELECT m.id, m.student_id, m.tier, m.plan, s.full_name
      FROM memberships m
      JOIN students s ON m.student_id = s.id
      WHERE m.status = 'active'
        AND m.expires_at IS NOT NULL
        AND m.expires_at < NOW()
        AND (m.tier != 'Scholar' OR m.plan != 'Scholar')
    `
    for (const row of expiredActive) {
      await sql`UPDATE students SET membership_tier = 'Scholar' WHERE id = ${row.student_id}`
      await sql`
        UPDATE memberships
        SET tier = 'Scholar', plan = 'Scholar', status = 'canceled', updated_at = NOW()
        WHERE student_id = ${row.student_id}
      `
      try {
        const { grantMembershipPerks } = await import("@/lib/membership")
        await grantMembershipPerks(row.student_id, "Scholar")
      } catch (perkError) {
        console.error(`[Sync Stripe] Failed to grant Scholar perks for ${row.full_name}:`, perkError)
      }
      results.updated++
      results.details.push({
        student: row.full_name,
        action: "downgraded_expired",
        from: row.tier || row.plan,
        to: "Scholar",
      })
    }
    if (expiredActive.length > 0) {
      console.log(`[Sync Stripe] Downgraded ${expiredActive.length} expired memberships`)
    }
    
    console.log(`[Sync Stripe] Sync complete: ${results.processed} processed, ${results.updated} updated, ${results.created} created`)
    
    return NextResponse.json({
      success: true,
      summary: {
        processed: results.processed,
        updated: results.updated,
        created: results.created,
        errors: results.errors.length
      },
      details: results.details,
      errors: results.errors
    })
  } catch (error: any) {
    console.error("[Sync Stripe] Sync failed:", error)
    return NextResponse.json(
      { error: "Sync failed", details: error.message },
      { status: 500 }
    )
  }
}

