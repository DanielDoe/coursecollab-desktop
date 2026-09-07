import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const debugFinancials = process.env.DEBUG_FINANCIALS === "1"

// Get stripe instance safely (may be null if not configured)
async function getStripe() {
  try {
    if (process.env.STRIPE_SECRET_KEY) {
      const stripeModule = await import("@/lib/stripe")
      return stripeModule.stripe
    }
  } catch (error) {
    console.error("[Financials] Stripe not available:", error)
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    /** When false (default), membership revenue uses DB (payments table + fallbacks) — no per-membership Stripe invoice.list calls. */
    const syncStripe = searchParams.get("syncStripe") === "true"

    const admin = await requireAdminId(request)
    if (!admin.ok) return admin.response

    // Check if deleted_at column exists (handle gracefully if migration hasn't run)
    let hasDeletedAtColumn = false
    try {
      const columnCheck = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'donations' AND column_name = 'deleted_at'
      `
      hasDeletedAtColumn = columnCheck.length > 0
    } catch (error) {
      console.log("[Financials] Could not check for deleted_at column, assuming it doesn't exist")
    }

    // Get all donations (excluding soft deleted if column exists)
    const donations = hasDeletedAtColumn
      ? await sql`
          SELECT 
            d.id,
            d.amount,
            d.donor_name,
            d.donor_email,
            d.message,
            d.is_anonymous,
            d.status,
            d.created_at,
            d.transaction_id,
            s.full_name as student_name,
            s.student_id as student_number
          FROM donations d
          LEFT JOIN students s ON d.student_id = s.id
          WHERE d.deleted_at IS NULL
          ORDER BY d.created_at DESC
        `
      : await sql`
          SELECT 
            d.id,
            d.amount,
            d.donor_name,
            d.donor_email,
            d.message,
            d.is_anonymous,
            d.status,
            d.created_at,
            d.transaction_id,
            s.full_name as student_name,
            s.student_id as student_number
          FROM donations d
          LEFT JOIN students s ON d.student_id = s.id
          ORDER BY d.created_at DESC
        `

    // Get all memberships with revenue (excluding soft deleted if column exists)
    // Use COALESCE to handle both tier and plan columns (for backward compatibility)
    const memberships = hasDeletedAtColumn
      ? await sql`
          SELECT 
            m.id,
            m.student_id,
            COALESCE(m.tier, m.plan) as tier,
            m.status,
            COALESCE(m.expires_at, m.end_date) as expires_at,
            COALESCE(m.auto_renew, false) as auto_renew,
            m.created_at,
            m.updated_at,
            m.stripe_customer_id,
            m.stripe_subscription_id,
            s.full_name as student_name,
            s.student_id as student_number,
            CASE 
              WHEN COALESCE(m.tier, m.plan) = 'Scholar' THEN 0
              WHEN COALESCE(m.tier, m.plan) = 'Explorer' THEN 5.99
              WHEN COALESCE(m.tier, m.plan) = 'Trailblazer' THEN 9.99
              ELSE 0
            END as monthly_price
          FROM memberships m
          JOIN students s ON m.student_id = s.id
          WHERE m.status = 'active'
            AND m.deleted_at IS NULL
          ORDER BY m.created_at DESC
        `
      : await sql`
          SELECT 
            m.id,
            m.student_id,
            COALESCE(m.tier, m.plan) as tier,
            m.status,
            COALESCE(m.expires_at, m.end_date) as expires_at,
            COALESCE(m.auto_renew, false) as auto_renew,
            m.created_at,
            m.updated_at,
            m.stripe_customer_id,
            m.stripe_subscription_id,
            s.full_name as student_name,
            s.student_id as student_number,
            CASE 
              WHEN COALESCE(m.tier, m.plan) = 'Scholar' THEN 0
              WHEN COALESCE(m.tier, m.plan) = 'Explorer' THEN 5.99
              WHEN COALESCE(m.tier, m.plan) = 'Trailblazer' THEN 9.99
              ELSE 0
            END as monthly_price
          FROM memberships m
          JOIN students s ON m.student_id = s.id
          WHERE m.status = 'active'
          ORDER BY m.created_at DESC
        `
    
    // Get deleted donations (only if column exists)
    const deletedDonations = hasDeletedAtColumn
      ? await sql`
          SELECT 
            d.id,
            d.amount,
            d.donor_name,
            d.donor_email,
            d.status,
            d.created_at,
            d.deleted_at,
            s.full_name as student_name,
            s.student_id as student_number
          FROM donations d
          LEFT JOIN students s ON d.student_id = s.id
          WHERE d.deleted_at IS NOT NULL
          ORDER BY d.deleted_at DESC
        `
      : []
    
    // Get deleted memberships (only if column exists)
    const deletedMemberships = hasDeletedAtColumn
      ? await sql`
          SELECT 
            m.id,
            m.student_id,
            COALESCE(m.tier, m.plan) as tier,
            m.status,
            m.created_at,
            m.deleted_at,
            s.full_name as student_name,
            s.student_id as student_number
          FROM memberships m
          JOIN students s ON m.student_id = s.id
          WHERE m.deleted_at IS NOT NULL
          ORDER BY m.deleted_at DESC
        `
      : []

    // Calculate totals - only count completed donations
    const completedDonations = donations.filter((d: any) => d.status === 'completed')
    const totalDonations = completedDonations.reduce((sum: number, d: any) => {
      return sum + parseFloat(d.amount || 0)
    }, 0)

    // Calculate actual membership revenue from Stripe payments
    // Use actual payments made, not calculated months
    let totalMembershipRevenue = 0
    
    if (debugFinancials) {
      console.log(`[Financials] Calculating membership revenue for ${memberships.length} memberships`)
    }

    // Live Stripe invoice totals only when explicitly requested (slow: N API calls; loads Stripe SDK only then)
    if (syncStripe) {
      const stripe = await getStripe()
      if (debugFinancials) {
        console.log(`[Financials] Stripe available: ${!!stripe}`)
      }
      if (stripe) {
      for (const membership of memberships) {
        if (membership.tier === 'Scholar') {
          if (debugFinancials) {
            console.log(`[Financials] Skipping Scholar tier for ${membership.student_name}`)
          }
          continue // Free tier
        }

        if (debugFinancials) {
          console.log(`[Financials] Processing ${membership.student_name} (${membership.tier})`)
          console.log(`[Financials]   Subscription ID: ${membership.stripe_subscription_id || 'N/A'}`)
          console.log(`[Financials]   Customer ID: ${membership.stripe_customer_id || 'N/A'}`)
        }

        try {
          // Get actual payments from Stripe
          if (membership.stripe_subscription_id) {
            // Get invoices for this subscription (most accurate)
            const invoices = await stripe.invoices.list({
              subscription: membership.stripe_subscription_id,
              limit: 100
            })
            
            if (debugFinancials) {
              console.log(`[Financials]   Found ${invoices.data.length} invoices`)
            }

            // Sum all paid invoices
            const subscriptionRevenue = invoices.data
              .filter(inv => inv.status === 'paid')
              .reduce((sum, inv) => sum + (inv.amount_paid / 100), 0)

            if (debugFinancials) {
              console.log(`[Financials]   Subscription revenue: $${subscriptionRevenue.toFixed(2)}`)
            }
            totalMembershipRevenue += subscriptionRevenue
          } else if (membership.stripe_customer_id) {
            // Fallback: get all invoices for customer
            const invoices = await stripe.invoices.list({
              customer: membership.stripe_customer_id,
              limit: 100
            })
            
            if (debugFinancials) {
              console.log(`[Financials]   Found ${invoices.data.length} customer invoices`)
            }

            const customerRevenue = invoices.data
              .filter(inv => inv.status === 'paid')
              .reduce((sum, inv) => sum + (inv.amount_paid / 100), 0)

            if (debugFinancials) {
              console.log(`[Financials]   Customer revenue: $${customerRevenue.toFixed(2)}`)
            }
            totalMembershipRevenue += customerRevenue
          } else {
            if (debugFinancials) {
              console.log(`[Financials]   No Stripe IDs found, using monthly price fallback`)
            }
            // Fallback to monthly price if no Stripe IDs
            const monthlyPrice = parseFloat(membership.monthly_price || 0)
            if (monthlyPrice > 0) {
              totalMembershipRevenue += monthlyPrice
            }
          }
        } catch (error) {
          console.error(`[Financials] Error fetching Stripe data for ${membership.student_name}:`, error)
          // Fallback to monthly price if Stripe fetch fails
          const monthlyPrice = parseFloat(membership.monthly_price || 0)
          if (monthlyPrice > 0) {
            if (debugFinancials) {
              console.log(`[Financials]   Using fallback monthly price: $${monthlyPrice}`)
            }
            totalMembershipRevenue += monthlyPrice
          }
        }
      }
      }
    } else if (debugFinancials) {
      console.log(
        `[Financials] Skipping live Stripe invoice fetch (${memberships.length} memberships). Use ?syncStripe=true to reconcile revenue from Stripe.`,
      )
    }

    if (debugFinancials) {
      console.log(
        `[Financials] membership revenue so far: $${totalMembershipRevenue.toFixed(2)} (source: ${syncStripe ? "stripe+db" : "db-only"})`,
      )
    }
    
    // If Stripe didn't work or returned 0, try payments table
    if (totalMembershipRevenue === 0) {
      let paymentsTableExists = false
      try {
        const paymentsCheck = await sql`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'payments' AND column_name = 'amount'
        `
        paymentsTableExists = paymentsCheck.length > 0
      } catch (error) {
        // Payments table doesn't exist or query failed
      }
      
      if (paymentsTableExists) {
        try {
          const payments = await sql`
            SELECT 
              p.amount,
              p.status,
              p.student_id,
              m.tier
            FROM payments p
            JOIN memberships m ON p.student_id = m.student_id
            WHERE (p.status = 'completed' 
              OR p.status = 'paid'
              OR p.status = 'succeeded')
              AND m.status = 'active'
          `
          
          totalMembershipRevenue = payments
            .filter((p: any) => {
              const tier = p.tier || 'Scholar'
              return tier !== 'Scholar' // Only count paid tiers
            })
            .reduce((sum: number, p: any) => {
              return sum + parseFloat(p.amount || 0)
            }, 0)
        } catch (error) {
          console.error("[Financials] Error querying payments table:", error)
        }
      }
    }
    
    // Final fallback: use monthly price if both Stripe and payments table failed
    if (totalMembershipRevenue === 0) {
      totalMembershipRevenue = memberships.reduce((sum: number, m: any) => {
        if (m.tier === 'Scholar') return sum
        const monthlyPrice = parseFloat(m.monthly_price || 0)
        return sum + monthlyPrice
      }, 0)
    }

    // Get monthly breakdown (excluding deleted if column exists)
    const monthlyDonations = hasDeletedAtColumn
      ? await sql`
          SELECT 
            DATE_TRUNC('month', created_at) as month,
            COUNT(*) as count,
            SUM(amount) as total
          FROM donations
          WHERE status = 'completed'
            AND deleted_at IS NULL
          GROUP BY DATE_TRUNC('month', created_at)
          ORDER BY month DESC
          LIMIT 12
        `
      : await sql`
          SELECT 
            DATE_TRUNC('month', created_at) as month,
            COUNT(*) as count,
            SUM(amount) as total
          FROM donations
          WHERE status = 'completed'
          GROUP BY DATE_TRUNC('month', created_at)
          ORDER BY month DESC
          LIMIT 12
        `

    const monthlyMemberships = hasDeletedAtColumn
      ? await sql`
          SELECT 
            DATE_TRUNC('month', created_at) as month,
            COUNT(*) as count,
            SUM(CASE 
              WHEN COALESCE(tier, plan) = 'Scholar' THEN 0
              WHEN COALESCE(tier, plan) = 'Explorer' THEN 5.99
              WHEN COALESCE(tier, plan) = 'Trailblazer' THEN 9.99
              ELSE 0
            END) as total
          FROM memberships
          WHERE status = 'active'
            AND deleted_at IS NULL
          GROUP BY DATE_TRUNC('month', created_at)
          ORDER BY month DESC
          LIMIT 12
        `
      : await sql`
          SELECT 
            DATE_TRUNC('month', created_at) as month,
            COUNT(*) as count,
            SUM(CASE 
              WHEN COALESCE(tier, plan) = 'Scholar' THEN 0
              WHEN COALESCE(tier, plan) = 'Explorer' THEN 5.99
              WHEN COALESCE(tier, plan) = 'Trailblazer' THEN 9.99
              ELSE 0
            END) as total
          FROM memberships
          WHERE status = 'active'
          GROUP BY DATE_TRUNC('month', created_at)
          ORDER BY month DESC
          LIMIT 12
        `

    return NextResponse.json({
      meta: {
        membershipRevenueSource: syncStripe ? "stripe_invoices" : "database",
        syncStripe,
      },
      donations: donations.map((d: any) => ({
        id: d.id,
        amount: parseFloat(d.amount),
        donorName: d.donor_name,
        donorEmail: d.donor_email,
        message: d.message,
        isAnonymous: d.is_anonymous,
        status: d.status,
        createdAt: d.created_at,
        transactionId: d.transaction_id,
        studentName: d.student_name,
        studentNumber: d.student_number,
      })),
      memberships: memberships.map((m: any) => ({
        id: m.id,
        studentId: m.student_id,
        studentName: m.student_name,
        studentNumber: m.student_number,
        tier: m.tier,
        status: m.status,
        expiresAt: m.expires_at,
        autoRenew: m.auto_renew,
        monthlyPrice: parseFloat(m.monthly_price),
        createdAt: m.created_at,
        updatedAt: m.updated_at,
      })),
      deletedDonations: deletedDonations.map((d: any) => ({
        id: d.id,
        amount: parseFloat(d.amount),
        donorName: d.donor_name,
        donorEmail: d.donor_email,
        status: d.status,
        createdAt: d.created_at,
        deletedAt: d.deleted_at,
        studentName: d.student_name,
        studentNumber: d.student_number,
      })),
      deletedMemberships: deletedMemberships.map((m: any) => ({
        id: m.id,
        studentId: m.student_id,
        studentName: m.student_name,
        studentNumber: m.student_number,
        tier: m.tier,
        status: m.status,
        createdAt: m.created_at,
        deletedAt: m.deleted_at,
      })),
      totals: {
        donations: totalDonations,
        membershipRevenue: totalMembershipRevenue,
        total: totalDonations + totalMembershipRevenue,
      },
      monthlyBreakdown: {
        donations: monthlyDonations.map((m: any) => ({
          month: m.month,
          count: parseInt(m.count),
          total: parseFloat(m.total || 0),
        })),
        memberships: monthlyMemberships.map((m: any) => ({
          month: m.month,
          count: parseInt(m.count),
          total: parseFloat(m.total || 0),
        })),
      },
    })
  } catch (error: any) {
    console.error("[Admin/Instructor Financials] Failed to fetch financial data:", error)
    console.error("[Admin/Instructor Financials] Error details:", {
      message: error?.message,
      stack: error?.stack,
      name: error?.name
    })
    return NextResponse.json(
      { 
        error: "Failed to fetch financial data",
        details: error?.message || "Unknown error occurred"
      },
      { status: 500 }
    )
  }
}

