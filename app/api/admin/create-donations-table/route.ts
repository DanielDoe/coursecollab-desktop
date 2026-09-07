import { NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    console.log("\n╔════════════════════════════════════════════════╗")
    console.log("║ [CREATE DONATIONS TABLE] START                ║")
    console.log("╚════════════════════════════════════════════════╝")

    // Check if table already exists
    const tableCheck = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'donations'
    `

    if (tableCheck.length > 0) {
      console.log("✅ Table 'donations' already exists")
      return NextResponse.json({ 
        success: true, 
        message: "Table 'donations' already exists" 
      })
    }

    // Create the table
    console.log("📝 Creating 'donations' table...")
    await sql`
      CREATE TABLE donations (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
        amount DECIMAL(10, 2) NOT NULL,
        donor_name VARCHAR(255) NOT NULL,
        donor_email VARCHAR(255),
        message TEXT,
        is_anonymous BOOLEAN DEFAULT false,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `

    // Create indexes
    console.log("📝 Creating indexes...")
    await sql`CREATE INDEX IF NOT EXISTS idx_donations_student_id ON donations(student_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations(created_at)`
    await sql`CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status)`

    console.log("✅ Successfully created 'donations' table with indexes")
    console.log("╔════════════════════════════════════════════════╗")
    console.log("║ [CREATE DONATIONS TABLE] SUCCESS ✅            ║")
    console.log("╚════════════════════════════════════════════════╝\n")

    return NextResponse.json({ 
      success: true, 
      message: "Successfully created 'donations' table" 
    })
  } catch (error: any) {
    console.error("❌ Error:", error)
    console.error("❌ Error message:", error.message)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to create donations table",
        details: error.message 
      },
      { status: 500 }
    )
  }
}

