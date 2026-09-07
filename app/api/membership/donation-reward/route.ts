import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

// Grant 7-day Trailblazer trial to donors
export async function POST(request: NextRequest) {
  try {
    const { studentId, donationId } = await request.json()

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    console.log(`[Donation Reward] Donation grants 7-day Trailblazer perks access (no membership created)`)

    // Donations grant perks for 7 days based on donation date, NOT by creating a membership
    // This keeps revenue calculations accurate (donations vs memberships)
    // The donation record itself is sufficient - we check for donations within 7 days
    
    // Mark donation as completed if donationId provided
    if (donationId) {
      await sql`
        UPDATE donations
        SET status = 'completed'
        WHERE id = ${parseInt(donationId)}
      `
    }

    // Award 7 playground credits
    try {
      const { awardPlaygroundCredits } = await import("@/lib/membership")
      await awardPlaygroundCredits(
        parseInt(studentId),
        7,
        "donation",
        "7 playground credits from donation"
      )
      console.log(`[Donation Reward] Awarded 7 playground credits to student ${studentId}`)
    } catch (error) {
      console.error("[Donation Reward] Failed to award playground credits:", error)
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    console.log(`[Donation Reward] Student ${studentId} now has 7-day Trailblazer perks access (until ${expiresAt.toISOString()})`)

    return NextResponse.json({
      success: true,
      message: "7-day Trailblazer perks access granted (based on donation date)",
      expiresAt: expiresAt.toISOString(),
      note: "Access is checked via donation date within 7 days, not via membership tier",
    })
  } catch (error: any) {
    console.error("[Donation Reward] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to grant donation reward" },
      { status: 500 }
    )
  }
}

