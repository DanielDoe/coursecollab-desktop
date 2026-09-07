import { NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth";
import { sql } from "@/lib/db";

// Mark as dynamic to prevent build-time database initialization
export const dynamic = 'force-dynamic'

/**
 * Admin endpoint to migrate presentations to use session-based unique constraints
 * This prevents presentations from different sessions from overwriting each other
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    console.log("\n=== [ADMIN] ADD SESSION TO PRESENTATIONS START ===");

    // Step 1: Check if session column exists
    console.log("📝 Step 1: Checking if session column exists...");
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'project_presentations' 
        AND column_name = 'session'
    `;

    if (columns.length > 0) {
      console.log("✅ Session column already exists");
    } else {
      console.log("📝 Adding session column...");
      await sql`
        ALTER TABLE project_presentations
        ADD COLUMN session VARCHAR(10)
      `;
      console.log("✅ Session column added");
    }

    // Step 2: Populate session from groups
    console.log("\n📝 Step 2: Populating session from groups...");
    const updateResult = await sql`
      UPDATE project_presentations pp
      SET session = g.session
      FROM groups g
      WHERE pp.group_id = g.id
        AND pp.session IS NULL
      RETURNING pp.id, pp.session
    `;
    console.log(`✅ Updated ${updateResult.length} presentations with session`);

    // Step 3: Check current constraints
    console.log("\n📝 Step 3: Checking current constraints...");
    const constraints = await sql`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'project_presentations'
        AND constraint_type = 'UNIQUE'
    `;
    console.log("Current constraints:", constraints.map(c => c.constraint_name));

    // Step 4: Create new constraint if needed
    console.log("\n📝 Step 4: Creating session-aware unique constraint...");
    try {
      // Drop old unique constraint
      await sql`
        ALTER TABLE project_presentations
        DROP CONSTRAINT IF EXISTS project_presentations_project_id_key
      `;
      console.log("✅ Dropped old constraint");
    } catch (e) {
      console.log("ℹ️  Old constraint not found (OK)");
    }

    try {
      // Add new constraint
      await sql`
        ALTER TABLE project_presentations
        ADD CONSTRAINT project_presentations_project_session_key 
        UNIQUE (project_id, session)
      `;
      console.log("✅ Added new unique constraint: (project_id, session)");
    } catch (e: any) {
      if (e.message.includes("already exists")) {
        console.log("ℹ️  New constraint already exists (OK)");
      } else {
        throw e;
      }
    }

    // Step 5: Add index on session
    console.log("\n📝 Step 5: Adding index on session column...");
    await sql`
      CREATE INDEX IF NOT EXISTS idx_presentations_session ON project_presentations(session)
    `;
    console.log("✅ Index created");

    // Step 6: Verify data
    console.log("\n📝 Step 6: Verifying results...");
    const presentations = await sql`
      SELECT 
        id,
        project_id,
        session,
        status,
        scheduled_date,
        start_time
      FROM project_presentations
      ORDER BY session, scheduled_date
    `;

    const bySession = presentations.reduce((acc: any, p: any) => {
      if (!acc[p.session]) acc[p.session] = [];
      acc[p.session].push(p);
      return acc;
    }, {});

    console.log("\n📊 Presentations by session:");
    Object.entries(bySession).forEach(([session, presos]: [string, any]) => {
      console.log(`   ${session}: ${presos.length} presentations`);
    });

    console.log("\n✅ ✅ ✅ MIGRATION COMPLETE!");
    console.log("   • Session column added");
    console.log("   • Unique constraint: (project_id, session)");
    console.log("   • Each project can have ONE presentation per session");
    console.log("   • P01, P02, P05 presentations won't overwrite each other");

    console.log("=== [ADMIN] ADD SESSION TO PRESENTATIONS SUCCESS ===\n");

    return NextResponse.json({
      message: "Migration completed successfully",
      presentationsBySession: bySession,
      totalPresentations: presentations.length,
    });
  } catch (error: any) {
    console.error("❌ Error:", error);
    console.log("=== [ADMIN] ADD SESSION TO PRESENTATIONS FAILED ===\n");
    return NextResponse.json(
      { error: error.message || "Migration failed" },
      { status: 500 }
    );
  }
}

