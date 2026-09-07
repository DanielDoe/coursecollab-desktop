import { NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth";
import { sql } from "@/lib/db";

// Mark as dynamic to prevent build-time database initialization
export const dynamic = 'force-dynamic'

/**
 * Admin endpoint to delete all quiz/homework attempts with 0% score
 */

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    console.log("\n╔════════════════════════════════════════════════╗");
    console.log("║ [DELETE ZERO SCORES] START                     ║");
    console.log("╚════════════════════════════════════════════════╝");

    // First, count and categorize zero scores
    // Handle different numeric types: 0, '0', 0.0, NULL, etc.
    console.log("\n📊 Checking for zero score attempts...");
    const zeroScores = await sql`
      SELECT 
        id,
        student_id,
        quiz_id,
        score,
        assessment_type,
        created_at
      FROM quiz_attempts
      WHERE (score = 0 OR score::numeric = 0)
      ORDER BY assessment_type, created_at DESC
    `;

    console.log(`✅ Found ${zeroScores.length} quiz/homework attempts with 0% score`);

    if (zeroScores.length > 0) {
      // Breakdown by type
      const byType: Record<string, number> = {};
      zeroScores.forEach((attempt: any) => {
        byType[attempt.assessment_type] = (byType[attempt.assessment_type] || 0) + 1;
      });

      console.log("\n📋 Breakdown by assessment type:");
      Object.entries(byType).forEach(([type, count]) => {
        console.log(`   ${type}: ${count} attempts`);
      });

      // First delete related quiz_answers to avoid foreign key constraint issues
      console.log("\n🗑️  Deleting related quiz_answers first...");
      const deletedAnswers = await sql`
        DELETE FROM quiz_answers
        WHERE quiz_attempt_id IN (
          SELECT id FROM quiz_attempts
          WHERE (score = 0 OR score::numeric = 0)
        )
        RETURNING id
      `;
      console.log(`✅ Deleted ${deletedAnswers.length} related quiz_answers`);

      // Now delete the quiz_attempts
      console.log("\n🗑️  Deleting zero score attempts...");
      const deleteResult = await sql`
        DELETE FROM quiz_attempts
        WHERE (score = 0 OR score::numeric = 0)
        RETURNING id
      `;

      console.log(`✅ Successfully deleted ${deleteResult.length} attempts with 0% score`);

      // Verify deletion
      const remaining = await sql`
        SELECT COUNT(*) as count FROM quiz_attempts 
        WHERE (score = 0 OR score::numeric = 0)
      `;

      console.log(`✅ Verification: ${remaining[0].count} zero score attempts remaining`);

      console.log("\n╔════════════════════════════════════════════════╗");
      console.log("║ [DELETE ZERO SCORES] SUCCESS ✅                ║");
      console.log("╚════════════════════════════════════════════════╝\n");

      return NextResponse.json({
        message: "Zero score attempts deleted successfully",
        deletedCount: deleteResult.length,
        breakdown: byType,
        remainingCount: remaining[0].count,
      });
    } else {
      console.log("\n✅ No zero score attempts found - nothing to delete");

      console.log("\n╔════════════════════════════════════════════════╗");
      console.log("║ [DELETE ZERO SCORES] SUCCESS ✅                ║");
      console.log("╚════════════════════════════════════════════════╝\n");

      return NextResponse.json({
        message: "No zero score attempts found",
        deletedCount: 0,
        breakdown: {},
        remainingCount: 0,
      });
    }
  } catch (error: any) {
    console.error("❌ Error:", error);
    console.error("❌ Error message:", error.message);
    console.error("❌ Error stack:", error.stack);
    console.log("╔════════════════════════════════════════════════╗");
    console.log("║ [DELETE ZERO SCORES] ERROR ❌                  ║");
    console.log("╚════════════════════════════════════════════════╝\n");
    return NextResponse.json(
      { 
        error: error.message || "Failed to delete zero score attempts",
        details: error.toString(),
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

