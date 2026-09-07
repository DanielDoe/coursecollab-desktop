/**
 * API endpoint to verify and refresh donation access for a student
 * This ensures donation perks are immediately available after payment
 */

import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { hasActiveDonationTrial } from "@/lib/membership"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    // Parse studentId (could be database ID or student_id string)
    let studentDatabaseId: number
    try {
      studentDatabaseId = parseInt(studentId)
      // Verify it exists
      const check = await sql`SELECT id FROM students WHERE id = ${studentDatabaseId} LIMIT 1`
      if (check.length === 0) {
        // Try as student_id string
        const checkByCode = await sql`SELECT id FROM students WHERE student_id = ${studentId} LIMIT 1`
        if (checkByCode.length === 0) {
          return NextResponse.json({ error: "Student not found" }, { status: 404 })
        }
        studentDatabaseId = checkByCode[0].id
      }
    } catch (error) {
      // Try as student_id string
      const checkByCode = await sql`SELECT id FROM students WHERE student_id = ${studentId} LIMIT 1`
      if (checkByCode.length === 0) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 })
      }
      studentDatabaseId = checkByCode[0].id
    }

    // Check for active donations
    const activeDonations = await sql`
      SELECT 
        id,
        amount,
        status,
        created_at,
        EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 as days_ago
      FROM donations
      WHERE student_id = ${studentDatabaseId}
        AND status = 'completed'
        AND created_at >= NOW() - INTERVAL '14 days'
      ORDER BY created_at DESC
    `

    // Use the membership function to check access
    const hasAccess = await hasActiveDonationTrial(studentDatabaseId)

    return NextResponse.json({
      studentId: studentDatabaseId,
      hasDonationAccess: hasAccess,
      activeDonations: activeDonations.length,
      donations: activeDonations.map(d => ({
        id: d.id,
        amount: d.amount,
        daysAgo: Math.round(d.days_ago * 10) / 10,
        daysRemaining: Math.round((14 - d.days_ago) * 10) / 10,
        created_at: d.created_at,
      })),
      message: hasAccess 
        ? "Student has active donation access (14-day Trailblazer perks)"
        : "Student does not have active donation access",
    })
  } catch (error) {
    console.error("[Verify Donation Access] Error:", error)
    return NextResponse.json(
      { error: "Failed to verify donation access", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

