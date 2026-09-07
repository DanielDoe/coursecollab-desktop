import { NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET() {
  try {
    console.log("[Fix Commenter Role] Starting database constraint fix...")
    
    // Drop old constraint
    console.log("[Fix Commenter Role] Dropping old constraint...")
    await sql`
      ALTER TABLE quiz_issue_comments 
      DROP CONSTRAINT IF EXISTS quiz_issue_comments_commenter_role_check
    `
    console.log("[Fix Commenter Role] ✅ Old constraint dropped")
    
    // Add new constraint
    console.log("[Fix Commenter Role] Adding new constraint...")
    await sql`
      ALTER TABLE quiz_issue_comments 
      ADD CONSTRAINT quiz_issue_comments_commenter_role_check 
      CHECK (commenter_role IN ('student', 'instructor', 'admin'))
    `
    console.log("[Fix Commenter Role] ✅ New constraint added")
    
    // Verify
    const constraints = await sql`
      SELECT conname, pg_get_constraintdef(oid) as definition 
      FROM pg_constraint 
      WHERE conname = 'quiz_issue_comments_commenter_role_check'
    `
    
    console.log("[Fix Commenter Role] ✅ Fix applied successfully!")
    
    return NextResponse.json({
      success: true,
      message: "Commenter role constraint updated successfully",
      constraint: constraints[0],
      allowedRoles: ['student', 'instructor', 'admin']
    })
  } catch (error) {
    console.error("[Fix Commenter Role] ❌ Error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

