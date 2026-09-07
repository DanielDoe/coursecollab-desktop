import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { studentId, amount, donorName, donorEmail, message, isAnonymous } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid donation amount" }, { status: 400 })
    }

    if (!donorName && !isAnonymous) {
      return NextResponse.json({ error: "Donor name is required" }, { status: 400 })
    }

    console.log("[Donations] Creating donation:", {
      studentId,
      amount,
      donorName: isAnonymous ? "Anonymous" : donorName,
      isAnonymous,
    })

    const result = await sql`
      INSERT INTO donations (
        student_id,
        amount,
        donor_name,
        donor_email,
        message,
        is_anonymous,
        status
      )
      VALUES (
        ${studentId ? parseInt(studentId) : null},
        ${parseFloat(amount)},
        ${isAnonymous ? "Anonymous" : donorName},
        ${donorEmail || null},
        ${message || null},
        ${isAnonymous || false},
        'completed'
      )
      RETURNING *
    `

    console.log("[Donations] Donation created successfully:", result[0].id)

    return NextResponse.json({
      success: true,
      donation: {
        id: result[0].id,
        amount: result[0].amount,
        donorName: result[0].donor_name,
        createdAt: result[0].created_at,
      },
    })
  } catch (error) {
    console.error("[Donations] Failed to create donation:", error)
    return NextResponse.json(
      { error: "Failed to process donation" },
      { status: 500 }
    )
  }
}

