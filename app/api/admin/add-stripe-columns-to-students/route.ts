import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminId(request)
    if (!admin.ok) return admin.response

    console.log("🚀 Running migration to add Stripe columns to students table...")

    // Add stripe_customer_id column
    await sql`
      ALTER TABLE students
      ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255)
    `

    // Add stripe_subscription_id column
    await sql`
      ALTER TABLE students
      ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255)
    `

    // Create indexes for better performance
    await sql`
      CREATE INDEX IF NOT EXISTS idx_students_stripe_customer_id ON students(stripe_customer_id)
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_students_stripe_subscription_id ON students(stripe_subscription_id)
    `

    console.log("✅ Stripe columns added successfully to 'students' table.")
    return NextResponse.json({ 
      success: true, 
      message: "Successfully added stripe_customer_id and stripe_subscription_id columns to students table" 
    })
  } catch (error: any) {
    console.error("❌ Error adding Stripe columns:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

