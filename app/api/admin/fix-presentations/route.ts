import { NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth";
import { sql } from "@/lib/db";

export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export const runtime = "nodejs";

/**
 * ADMIN ONLY - Emergency fix endpoint for presentation issues
 * DELETE all cancelled presentations
 * UPDATE presentation 10 created_by to 4
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    console.log("\n🔧 [FIX-PRESENTATIONS] Starting emergency fix...\n");

    // Step 1: Delete all cancelled presentations
    console.log("1️⃣  Deleting all cancelled presentations...");
    const deleteResult = await sql`
      DELETE FROM project_presentations 
      WHERE status = 'cancelled'
      RETURNING id
    `;
    console.log(`   ✅ Deleted ${deleteResult.length} cancelled presentations`);
    if (deleteResult.length > 0) {
      console.log("   IDs deleted:", deleteResult.map(r => r.id).join(", "));
    }

    // Step 2: Fix presentation 10 - set creator to student 4
    console.log("\n2️⃣  Fixing presentation 10 creator (181 → 4)...");
    const updateResult = await sql`
      UPDATE project_presentations 
      SET created_by = 4 
      WHERE id = 10
      RETURNING id, created_by
    `;
    
    if (updateResult.length > 0) {
      console.log(`   ✅ Updated presentation 10`);
      console.log(`   created_by is now: ${updateResult[0].created_by}`);
    } else {
      console.log("   ⚠️ Presentation 10 not found");
    }

    // Step 3: Verify the fix
    console.log("\n3️⃣  Verifying fix...");
    const verify = await sql`
      SELECT 
        pp.id,
        pp.created_by,
        s.full_name as creator_name,
        pp.status,
        COUNT(*) OVER() as total_count
      FROM project_presentations pp
      LEFT JOIN students s ON pp.created_by = s.id
      ORDER BY pp.id DESC
      LIMIT 10
    `;
    
    console.log(`\n   Total presentations remaining: ${verify[0]?.total_count || 0}`);
    verify.forEach(p => {
      console.log(`   ID ${p.id}: created_by=${p.created_by} (${p.creator_name}), status=${p.status}`);
    });

    // Step 4: Test authorization for presentation 10
    console.log("\n4️⃣  Testing authorization for student 4 on presentation 10...");
    const authTest = await sql`
      SELECT 1
      FROM project_presentations pp
      WHERE pp.id = 10
        AND (
          pp.created_by = 4
          OR EXISTS (
            SELECT 1 FROM group_members gm
            WHERE gm.group_id = pp.group_id
              AND gm.student_id = 4
          )
        )
      LIMIT 1
    `;
    
    const isAuthorized = authTest.length > 0;
    if (isAuthorized) {
      console.log("   ✅ Student 4 IS NOW AUTHORIZED to cancel presentation 10!");
    } else {
      console.log("   ❌ Student 4 still not authorized");
    }

    console.log("\n✅ [FIX-PRESENTATIONS] COMPLETE!\n");

    return NextResponse.json({
      success: true,
      deleted: deleteResult.length,
      updated: updateResult.length,
      isAuthorized: isAuthorized,
      message: "Presentation fix completed successfully"
    });

  } catch (error) {
    console.error("\n❌ [FIX-PRESENTATIONS] ERROR:", error);
    return NextResponse.json(
      { error: "Fix failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

