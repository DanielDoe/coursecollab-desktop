import { NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  const admin = await requireAdminId(req)
  if (!admin.ok) return admin.response

  try {
    // Find demo student
    const studentResult = await sql`
      SELECT id, student_id, full_name 
      FROM students 
      WHERE student_id = 'DEMO001'
    `;

    if (studentResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Demo student not found" },
        { status: 404 }
      );
    }

    const demoStudent = studentResult.rows[0];

    // Delete attendance records
    const deleteRecordsResult = await sql`
      DELETE FROM attendance_records
      WHERE student_id = ${demoStudent.id}
      RETURNING id
    `;

    // Reset attendance streaks
    await sql`
      UPDATE attendance_streaks
      SET 
        current_streak = 0,
        longest_streak = 0,
        total_points = 0,
        last_attendance_date = NULL
      WHERE student_id = ${demoStudent.id}
    `;

    return NextResponse.json({
      success: true,
      message: `Cleared ${deleteRecordsResult.rows.length} attendance records for demo student`,
      demoStudent: {
        id: demoStudent.id,
        name: demoStudent.full_name,
        studentId: demoStudent.student_id
      }
    });
  } catch (error: any) {
    console.error("Error clearing demo student attendance:", error);
    return NextResponse.json(
      { error: "Failed to clear demo student attendance", details: error.message },
      { status: 500 }
    );
  }
}
