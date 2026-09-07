import { NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    console.log("\n╔════════════════════════════════════════════════╗")
    console.log("║ [UPDATE MEMBERSHIPS SCHEMA] START              ║")
    console.log("╚════════════════════════════════════════════════╝")

    // Check if tier column exists
    const tierCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'memberships' AND column_name = 'tier'
    `

    if (tierCheck.length === 0) {
      console.log("📝 Adding 'tier' column...")
      await sql`ALTER TABLE memberships ADD COLUMN tier VARCHAR(20)`
      await sql`UPDATE memberships SET tier = plan WHERE tier IS NULL`
      await sql`ALTER TABLE memberships ALTER COLUMN tier SET NOT NULL`
      await sql`
        ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_tier_check
      `
      await sql`
        ALTER TABLE memberships ADD CONSTRAINT memberships_tier_check 
        CHECK (tier IN ('Scholar', 'Explorer', 'Trailblazer'))
      `
      console.log("✅ Added 'tier' column")
    } else {
      console.log("✅ Column 'tier' already exists")
    }

    // Check if expires_at column exists
    const expiresAtCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'memberships' AND column_name = 'expires_at'
    `

    if (expiresAtCheck.length === 0) {
      console.log("📝 Adding 'expires_at' column...")
      await sql`ALTER TABLE memberships ADD COLUMN expires_at TIMESTAMP`
      // Populate from end_date if it exists
      await sql`
        UPDATE memberships 
        SET expires_at = end_date 
        WHERE expires_at IS NULL AND end_date IS NOT NULL
      `
      console.log("✅ Added 'expires_at' column")
    } else {
      console.log("✅ Column 'expires_at' already exists")
    }

    // Check if auto_renew column exists
    const autoRenewCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'memberships' AND column_name = 'auto_renew'
    `

    if (autoRenewCheck.length === 0) {
      console.log("📝 Adding 'auto_renew' column...")
      await sql`ALTER TABLE memberships ADD COLUMN auto_renew BOOLEAN DEFAULT false`
      // Set auto_renew to true for paid tiers
      await sql`
        UPDATE memberships 
        SET auto_renew = true 
        WHERE tier IN ('Explorer', 'Trailblazer') AND auto_renew IS NULL
      `
      console.log("✅ Added 'auto_renew' column")
    } else {
      console.log("✅ Column 'auto_renew' already exists")
    }

    console.log("╔════════════════════════════════════════════════╗")
    console.log("║ [UPDATE MEMBERSHIPS SCHEMA] SUCCESS ✅          ║")
    console.log("╚════════════════════════════════════════════════╝\n")

    return NextResponse.json({ 
      success: true, 
      message: "Successfully updated memberships table schema" 
    })
  } catch (error: any) {
    console.error("❌ Error:", error)
    console.error("❌ Error message:", error.message)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to update memberships schema",
        details: error.message 
      },
      { status: 500 }
    )
  }
}

