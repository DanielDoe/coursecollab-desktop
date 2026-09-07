import { NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  const admin = await requireAdminId(req)
  if (!admin.ok) return admin.response

  try {
    // Delete all attendance records
    const deleteRecordsResult = await sql`
      DELETE FROM attendance_records
      RETURNING id
    `;

    // Reset all attendance streaks
    await sql`
      UPDATE attendance_streaks
      SET 
        current_streak = 0,
        longest_streak = 0,
        total_points = 0,
        last_attendance_date = NULL
    `;

    return NextResponse.json({
      success: true,
      message: `Cleared ${deleteRecordsResult.length} attendance records for all students`,
      recordsDeleted: deleteRecordsResult.length,
      streaksReset: true
    });
  } catch (error: any) {
    console.error("Error clearing all attendance records:", error);
    return NextResponse.json(
      { error: "Failed to clear attendance records", details: error.message },
      { status: 500 }
    );
  }
}
