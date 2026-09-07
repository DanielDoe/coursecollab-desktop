import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST - Recover soft-deleted attendance record
export async function POST(req: NextRequest) {
  try {
    const instructorAuth = req.headers.get("x-instructor-id") || req.headers.get("authorization");
    
    if (!instructorAuth) {
      return NextResponse.json(
        { error: "Instructor authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { recordId } = body;

    if (!recordId) {
      return NextResponse.json(
        { error: "Record ID is required" },
        { status: 400 }
      );
    }

    // Check if record was deleted within 24 hours
    const record = await sql`
      SELECT deleted_at
      FROM attendance_records
      WHERE id = ${recordId}
        AND deleted_at IS NOT NULL
    `;

    if (record.length === 0) {
      return NextResponse.json(
        { error: "Record not found or not deleted" },
        { status: 404 }
      );
    }

    const deletedAt = new Date(record[0].deleted_at);
    const hoursSinceDeletion = (Date.now() - deletedAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceDeletion > 24) {
      return NextResponse.json(
        { error: "Record cannot be recovered. It was deleted more than 24 hours ago." },
        { status: 400 }
      );
    }

    // Recover the record
    await sql`
      UPDATE attendance_records
      SET deleted_at = NULL
      WHERE id = ${recordId}
    `;

    return NextResponse.json({
      success: true,
      message: "Attendance record recovered successfully",
    });
  } catch (error: any) {
    console.error("Error recovering attendance record:", error);
    return NextResponse.json(
      { error: "Failed to recover attendance record", details: error.message },
      { status: 500 }
    );
  }
}
