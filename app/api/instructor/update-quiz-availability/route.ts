import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

/**
 * Instructor endpoint to update all quiz availability until December 20th
 */
export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    console.log("\n╔════════════════════════════════════════════════╗");
    console.log("║ [UPDATE QUIZ AVAILABILITY] START               ║");
    console.log("╚════════════════════════════════════════════════╝");

    const decemberDate = "2025-12-20";

    console.log(`\n📅 Setting all quizzes availability until: ${decemberDate}`);

    // Get current quizzes
    console.log("\n📋 Checking current quizzes...");
    const currentQuizzes = await sql`
      SELECT 
        id,
        title,
        availability_until,
        assessment_type
      FROM quizzes
      WHERE availability_until IS NOT NULL
      ORDER BY assessment_type
    `;

    console.log(`✅ Found ${currentQuizzes.length} quizzes`);

    if (currentQuizzes.length > 0) {
      console.log("\n📊 Current availability dates:");
      currentQuizzes.forEach((quiz: any) => {
        const currentDate = quiz.availability_until
          ? new Date(quiz.availability_until).toISOString().split("T")[0]
          : "Not set";
        console.log(`   [${quiz.assessment_type}] ${quiz.title}: ${currentDate}`);
      });

      // Update availability
      console.log(`\n🔄 Updating all quizzes to: ${decemberDate}`);
      const updateResult = await sql`
        UPDATE quizzes
        SET availability_until = ${decemberDate}
        WHERE availability_until IS NOT NULL
        RETURNING id, title, availability_until, assessment_type
      `;

      console.log(`✅ Successfully updated ${updateResult.length} quizzes`);

      // Breakdown by type
      const byType: Record<string, number> = {};
      updateResult.forEach((quiz: any) => {
        byType[quiz.assessment_type] = (byType[quiz.assessment_type] || 0) + 1;
      });

      console.log("\n✅ Summary by assessment type:");
      Object.entries(byType).forEach(([type, count]) => {
        console.log(`   ${type}: ${count} quizzes updated`);
      });

      console.log("\n╔════════════════════════════════════════════════╗");
      console.log("║ [UPDATE QUIZ AVAILABILITY] SUCCESS ✅           ║");
      console.log("╚════════════════════════════════════════════════╝\n");

      return NextResponse.json({
        message: "Quiz availability updated successfully",
        newDate: decemberDate,
        updatedCount: updateResult.length,
        breakdown: byType,
      });
    } else {
      console.log("\n⚠️  No quizzes with availability_until found");

      console.log("\n╔════════════════════════════════════════════════╗");
      console.log("║ [UPDATE QUIZ AVAILABILITY] SUCCESS ✅           ║");
      console.log("╚════════════════════════════════════════════════╝\n");

      return NextResponse.json({
        message: "No quizzes with availability dates found",
        newDate: decemberDate,
        updatedCount: 0,
        breakdown: {},
      });
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.log("╔════════════════════════════════════════════════╗");
    console.log("║ [UPDATE QUIZ AVAILABILITY] ERROR ❌             ║");
    console.log("╚════════════════════════════════════════════════╝\n");
    return NextResponse.json(
      { error: error.message || "Failed to update quiz availability" },
      { status: 500 }
    );
  }
}

