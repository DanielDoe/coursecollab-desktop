import { NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    console.log("\n╔════════════════════════════════════════════════╗")
    console.log("║ [ADD PROJECT LINK COLUMN] START                ║")
    console.log("╚════════════════════════════════════════════════╝")

    // Check if column already exists
    const columnCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'projects' AND column_name = 'project_link'
    `

    if (columnCheck.length > 0) {
      console.log("✅ Column 'project_link' already exists")
      return NextResponse.json({ 
        success: true, 
        message: "Column 'project_link' already exists" 
      })
    }

    // Add the column
    console.log("📝 Adding 'project_link' column to projects table...")
    await sql`
      ALTER TABLE projects 
      ADD COLUMN project_link TEXT
    `

    console.log("✅ Successfully added 'project_link' column")
    console.log("╔════════════════════════════════════════════════╗")
    console.log("║ [ADD PROJECT LINK COLUMN] SUCCESS ✅            ║")
    console.log("╚════════════════════════════════════════════════╝\n")

    return NextResponse.json({ 
      success: true, 
      message: "Successfully added 'project_link' column to projects table" 
    })
  } catch (error: any) {
    console.error("❌ Error:", error)
    console.error("❌ Error message:", error.message)
    console.error("❌ Error stack:", error.stack)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to add project_link column",
        details: error.message 
      },
      { status: 500 }
    )
  }
}

