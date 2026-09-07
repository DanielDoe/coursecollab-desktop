import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    // Get the most recent completed donation within the last 7 days
    const donation = await sql`
      SELECT 
        id,
        amount,
        status,
        created_at,
        EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 as days_ago,
        7 - (EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400) as days_remaining
      FROM donations
      WHERE student_id = ${parseInt(studentId)}
        AND status = 'completed'
        AND created_at >= NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC
      LIMIT 1
    `

    if (donation.length === 0) {
      return NextResponse.json({
        hasActiveDonation: false,
        donation: null,
      })
    }

    const donationData = donation[0]
    const daysRemaining = Math.max(0, Math.ceil(parseFloat(donationData.days_remaining.toString())))
    const daysAgo = parseFloat(donationData.days_ago.toString())

    return NextResponse.json({
      hasActiveDonation: true,
      donation: {
        id: donationData.id,
        amount: parseFloat(donationData.amount),
        createdAt: donationData.created_at,
        daysAgo: Math.round(daysAgo * 10) / 10,
        daysRemaining: daysRemaining,
        expiresAt: new Date(new Date(donationData.created_at).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    })
  } catch (error: any) {
    console.error("[Donation Status] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch donation status", details: error.message },
      { status: 500 }
    )
  }
}

