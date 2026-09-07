// Instructor financials route - redirects to admin financials (shared route)
import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

// This route is identical to admin financials but is here for instructor-specific access
// Both admin and instructor routes share the same logic
export async function GET(request: NextRequest) {
  try {
    // Verify instructor authentication
    const instructorSession = request.headers.get("x-instructor-id")
    
    if (!instructorSession) {
      return NextResponse.json({ error: "Instructor authentication required" }, { status: 401 })
    }

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
    let donations: any[] = []
    try {
      donations = hasDeletedAtColumn
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
              d.payment_method,
              d.error_message,
              d.failed_at,
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
              d.payment_method,
              d.error_message,
              d.failed_at,
              s.full_name as student_name,
              s.student_id as student_number
            FROM donations d
            LEFT JOIN students s ON d.student_id = s.id
            ORDER BY d.created_at DESC
          `
    } catch (error) {
      console.error("[Instructor Financials] Error fetching donations:", error)
      donations = []
    }

    // Get all memberships with revenue (excluding soft deleted if column exists)
    let memberships: any[] = []
    try {
      memberships = hasDeletedAtColumn
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
    } catch (error) {
      console.error("[Instructor Financials] Error fetching memberships:", error)
      memberships = []
    }
    
    // Get deleted donations (only if column exists)
    let deletedDonations: any[] = []
    if (hasDeletedAtColumn) {
      try {
        deletedDonations = await sql`
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
      } catch (error) {
        console.error("[Instructor Financials] Error fetching deleted donations:", error)
        deletedDonations = []
      }
    }
    
    // Get deleted memberships (only if column exists)
    let deletedMemberships: any[] = []
    if (hasDeletedAtColumn) {
      try {
        deletedMemberships = await sql`
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
      } catch (error) {
        console.error("[Instructor Financials] Error fetching deleted memberships:", error)
        deletedMemberships = []
      }
    }

    // Calculate totals - only count completed donations
    const completedDonations = donations.filter((d: any) => d.status === 'completed')
    const totalDonations = completedDonations.reduce((sum: number, d: any) => {
      return sum + parseFloat(d.amount || 0)
    }, 0)

    // Calculate actual membership revenue based on months active
    const totalMembershipRevenue = memberships.reduce((sum: number, m: any) => {
      if (m.tier === 'Scholar') return sum // Free tier
      
      const monthlyPrice = parseFloat(m.monthly_price || 0)
      if (monthlyPrice === 0) return sum
      
      // Calculate months active (from created_at to now or expires_at, whichever is earlier)
      const createdDate = new Date(m.created_at)
      const endDate = m.expires_at ? new Date(m.expires_at) : new Date()
      const monthsActive = Math.max(1, Math.ceil((endDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24 * 30)))
      
      return sum + (monthlyPrice * monthsActive)
    }, 0)

    // Get monthly breakdown (excluding deleted if column exists)
    let monthlyDonations: any[] = []
    try {
      monthlyDonations = hasDeletedAtColumn
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
    } catch (error) {
      console.error("[Instructor Financials] Error fetching monthly donations:", error)
      monthlyDonations = []
    }

    let monthlyMemberships: any[] = []
    try {
      monthlyMemberships = hasDeletedAtColumn
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
    } catch (error) {
      console.error("[Instructor Financials] Error fetching monthly memberships:", error)
      monthlyMemberships = []
    }

    // Safely map monthly breakdown data with null checks
    const safeMonthlyDonations = Array.isArray(monthlyDonations) 
      ? monthlyDonations.map((m: any) => ({
          month: m?.month || new Date().toISOString(),
          count: parseInt(m?.count || "0"),
          total: parseFloat(m?.total || "0"),
        }))
      : []

    const safeMonthlyMemberships = Array.isArray(monthlyMemberships)
      ? monthlyMemberships.map((m: any) => ({
          month: m?.month || new Date().toISOString(),
          count: parseInt(m?.count || "0"),
          total: parseFloat(m?.total || "0"),
        }))
      : []

    return NextResponse.json({
      donations: (donations || []).map((d: any) => ({
        id: d.id,
        amount: parseFloat(d.amount || 0),
        donorName: d.donor_name || "",
        donorEmail: d.donor_email || null,
        message: d.message || null,
        isAnonymous: d.is_anonymous || false,
        status: d.status || "pending",
        createdAt: d.created_at || new Date().toISOString(),
        transactionId: d.transaction_id || null,
        paymentMethod: d.payment_method || null,
        errorMessage: d.error_message || null,
        failedAt: d.failed_at || null,
        studentName: d.student_name || null,
        studentNumber: d.student_number || null,
      })),
      memberships: (memberships || []).map((m: any) => ({
        id: m.id,
        studentId: m.student_id,
        studentName: m.student_name || "",
        studentNumber: m.student_number || "",
        tier: m.tier || "Scholar",
        status: m.status || "active",
        expiresAt: m.expires_at || null,
        autoRenew: m.auto_renew || false,
        monthlyPrice: parseFloat(m.monthly_price || 0),
        createdAt: m.created_at || new Date().toISOString(),
        updatedAt: m.updated_at || new Date().toISOString(),
      })),
      deletedDonations: (deletedDonations || []).map((d: any) => ({
        id: d.id,
        amount: parseFloat(d.amount || 0),
        donorName: d.donor_name || "",
        donorEmail: d.donor_email || null,
        status: d.status || "pending",
        createdAt: d.created_at || new Date().toISOString(),
        deletedAt: d.deleted_at || new Date().toISOString(),
        studentName: d.student_name || null,
        studentNumber: d.student_number || null,
      })),
      deletedMemberships: (deletedMemberships || []).map((m: any) => ({
        id: m.id,
        studentId: m.student_id,
        studentName: m.student_name || "",
        studentNumber: m.student_number || "",
        tier: m.tier || "Scholar",
        status: m.status || "active",
        createdAt: m.created_at || new Date().toISOString(),
        deletedAt: m.deleted_at || new Date().toISOString(),
      })),
      totals: {
        donations: totalDonations || 0,
        membershipRevenue: totalMembershipRevenue || 0,
        total: (totalDonations || 0) + (totalMembershipRevenue || 0),
      },
      monthlyBreakdown: {
        donations: safeMonthlyDonations,
        memberships: safeMonthlyMemberships,
      },
    })
  } catch (error: any) {
    console.error("[Instructor Financials] Failed to fetch financial data:", error)
    console.error("[Instructor Financials] Error details:", {
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

