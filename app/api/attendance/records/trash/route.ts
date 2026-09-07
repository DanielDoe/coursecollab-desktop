import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { resolveOptionalCourseScope } from "@/lib/optional-instructor-course-scope";
import { sqlAttendanceSessionScope } from "@/lib/attendance-instructor-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET - Fetch soft-deleted attendance records
export async function GET(req: NextRequest) {
  try {
    const instructorAuth = req.headers.get("x-instructor-id") || req.headers.get("authorization");
    
    if (!instructorAuth) {
      return NextResponse.json(
        { error: "Instructor authentication required" },
        { status: 401 }
      );
    }

    const scoped = await resolveOptionalCourseScope(req);
    if (!scoped.ok) return scoped.response;

    const courseTrashFrag =
      scoped.courseId != null
        ? await sqlAttendanceSessionScope(req, scoped.courseId, "asess")
        : sql.unsafe("");

    const { searchParams } = new URL(req.url);
    const section = searchParams.get("section");

    let records;
    if (section) {
      records = await sql`
        SELECT 
          ar.id,
          ar.student_id as "studentId",
          ar.student_name as "studentName",
          ar.student_number as "studentNumber",
          ar.section,
          ar.status,
          ar.geo_verified as "geoVerified",
          ar.distance_meters as "distanceMeters",
          ar.points_earned as "pointsEarned",
          ar.timestamp,
          ar.deleted_at,
          asess.class_title as "classTitle",
          asess.start_time as "startTime",
          asess.end_time as "endTime"
        FROM attendance_records ar
        JOIN attendance_sessions asess ON ar.session_id = asess.id
        WHERE ar.section = ${section}
          AND ar.deleted_at IS NOT NULL
          ${courseTrashFrag}
        ORDER BY ar.deleted_at DESC
      `;
    } else {
      records = await sql`
        SELECT 
          ar.id,
          ar.student_id as "studentId",
          ar.student_name as "studentName",
          ar.student_number as "studentNumber",
          ar.section,
          ar.status,
          ar.geo_verified as "geoVerified",
          ar.distance_meters as "distanceMeters",
          ar.points_earned as "pointsEarned",
          ar.timestamp,
          ar.deleted_at,
          asess.class_title as "classTitle",
          asess.start_time as "startTime",
          asess.end_time as "endTime"
        FROM attendance_records ar
        JOIN attendance_sessions asess ON ar.session_id = asess.id
        WHERE ar.deleted_at IS NOT NULL
          ${courseTrashFrag}
        ORDER BY ar.deleted_at DESC
      `;
    }

    // Filter records that can still be recovered (< 24 hours)
    const now = Date.now();
    const recoverableRecords = records.filter((r: any) => {
      if (!r.deleted_at) return false;
      const deletedAt = new Date(r.deleted_at);
      const hoursSinceDeletion = (now - deletedAt.getTime()) / (1000 * 60 * 60);
      return hoursSinceDeletion <= 24;
    });

    const expiredRecords = records.filter((r: any) => {
      if (!r.deleted_at) return false;
      const deletedAt = new Date(r.deleted_at);
      const hoursSinceDeletion = (now - deletedAt.getTime()) / (1000 * 60 * 60);
      return hoursSinceDeletion > 24;
    });

    return NextResponse.json({
      success: true,
      records: recoverableRecords,
      expiredRecords,
      recoverable: recoverableRecords.length,
      expired: expiredRecords.length,
      total: records.length,
    });
  } catch (error: any) {
    console.error("Error fetching trash records:", error);
    return NextResponse.json(
      { error: "Failed to fetch trash records", details: error.message },
      { status: 500 }
    );
  }
}
