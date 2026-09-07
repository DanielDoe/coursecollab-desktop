import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

/**
 * Instructor endpoint to delete quiz/homework attempts with 0% score
 * IMPORTANT: This EXCLUDES mid_semester and finals to prevent accidental deletion of important exam data
 * Only deletes attempts for 'quiz' and 'homework' assessment types
 */
export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    console.log("\n╔════════════════════════════════════════════════╗");
    console.log("║ [DELETE ZERO SCORES] START                     ║");
    console.log("╚════════════════════════════════════════════════╝");

    // First, count and categorize zero scores
    // Handle different numeric types: 0, '0', 0.0, NULL, etc.
    // IMPORTANT: Exclude mid_semester and finals to protect important exam data
    console.log("\n📊 Checking for zero score attempts (quizzes/homework only)...");
    const zeroScores = await sql`
      SELECT 
        qa.id,
        qa.student_id,
        qa.quiz_id,
        qa.score,
        q.assessment_type,
        qa.started_at
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE (qa.score = 0 OR qa.score::numeric = 0)
        AND q.assessment_type IN ('quiz', 'homework')
        AND q.deleted_at IS NULL
      ORDER BY q.assessment_type, qa.started_at DESC
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
      // IMPORTANT: Only delete answers for quiz/homework attempts, not mid_semester/finals
      console.log("\n🗑️  Deleting related quiz_answers first...");
      const deletedAnswers = await sql`
        DELETE FROM quiz_answers
        WHERE attempt_id IN (
          SELECT qa.id 
          FROM quiz_attempts qa
          JOIN quizzes q ON qa.quiz_id = q.id
          WHERE (qa.score = 0 OR qa.score::numeric = 0)
            AND q.assessment_type IN ('quiz', 'homework')
            AND q.deleted_at IS NULL
        )
        RETURNING id
      `;
      console.log(`✅ Deleted ${deletedAnswers.length} related quiz_answers`);

      // Now delete the quiz_attempts
      // IMPORTANT: Only delete quiz/homework attempts, protect mid_semester/finals
      console.log("\n🗑️  Deleting zero score attempts (quizzes/homework only)...");
      const deleteResult = await sql`
        DELETE FROM quiz_attempts
        WHERE id IN (
          SELECT qa.id 
          FROM quiz_attempts qa
          JOIN quizzes q ON qa.quiz_id = q.id
          WHERE (qa.score = 0 OR qa.score::numeric = 0)
            AND q.assessment_type IN ('quiz', 'homework')
            AND q.deleted_at IS NULL
        )
        RETURNING id
      `;

      console.log(`✅ Successfully deleted ${deleteResult.length} attempts with 0% score`);

      // Verify deletion (only for quiz/homework)
      const remaining = await sql`
        SELECT COUNT(*) as count 
        FROM quiz_attempts qa
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE (qa.score = 0 OR qa.score::numeric = 0)
          AND q.assessment_type IN ('quiz', 'homework')
          AND q.deleted_at IS NULL
      `;

      console.log(`✅ Verification: ${remaining[0].count} zero score quiz/homework attempts remaining`);

      // Also check mid-semester/finals to show they were protected
      const protectedCount = await sql`
        SELECT COUNT(*) as count 
        FROM quiz_attempts qa
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE (qa.score = 0 OR qa.score::numeric = 0)
          AND q.assessment_type IN ('mid_semester', 'finals')
          AND q.deleted_at IS NULL
      `;

      console.log(`🛡️  Protected: ${protectedCount[0].count} zero score mid-semester/finals attempts (NOT deleted)`);

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

