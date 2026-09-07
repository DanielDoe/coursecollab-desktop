import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { resolveOptionalCourseScope } from "@/lib/optional-instructor-course-scope";
import {
  attendancePointsForStatus,
  isAttendanceStatus,
} from "@/lib/attendance-status";
import {
  canActorAccessAttendanceSession,
  requireInstructorAttendanceAccess,
} from "@/lib/instructor-attendance-auth";
import { sqlAttendanceSessionScope, sqlAttendanceSessionTermWindowScope, sqlAttendanceStudentIdInScope } from "@/lib/attendance-instructor-scope";
import { syncGradebookForAttendanceMark } from "@/lib/grades";
import { requireBoundStudentCaller } from "@/lib/student-api-auth";
import { getEnrollmentAttendanceWindow, termStartWithGrace } from "@/lib/attendance-enrollment-scope";

function isMissingDeletedAtColumn(error: unknown): boolean {
  const err = error as { code?: string; message?: string }
  return err?.code === "42703" && (err.message?.includes("deleted_at") ?? false)
}

// GET - Fetch attendance records for a student
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const section = searchParams.get("section");
  const sessionIdParam = searchParams.get("sessionId");
  const status = searchParams.get("status"); // 'present', 'absent', 'all'

  try {
    const instructorClaim = req.headers.get("x-instructor-id")?.trim();
    let recordStudentId: string | number | null = studentId;
    let isInstructor = false;

    if (instructorClaim) {
      const attendanceAuth = await requireInstructorAttendanceAccess(req);
      if (!attendanceAuth.ok) return attendanceAuth.response;
      isInstructor = true;
    } else if (studentId) {
      const bound = await requireBoundStudentCaller(req, studentId);
      if (!bound.ok) return bound.response;
      recordStudentId = bound.studentDbId;
    } else {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const scopedRecords = await resolveOptionalCourseScope(req);
    if (!scopedRecords.ok) return scopedRecords.response;

    /** When instructor pulls by section under a scoped course, verify section belongs to that course */
    const sectionCourseLock =
      section && scopedRecords.courseId != null && isInstructor
        ? await sqlAttendanceSessionScope(req, scopedRecords.courseId, "asess")
        : sql.unsafe("");

    const instructorTermWindow =
      isInstructor && scopedRecords.courseId != null
        ? await sqlAttendanceSessionTermWindowScope(req, scopedRecords.courseId, "asess")
        : sql.unsafe("");

    const studentScopedInCourse =
      recordStudentId &&
      isInstructor &&
      scopedRecords.courseId != null
        ? await sqlAttendanceStudentIdInScope(req, scopedRecords.courseId, Number(recordStudentId))
        : sql.unsafe("");

    const sessionIdNum =
      sessionIdParam != null && sessionIdParam !== ""
        ? Number.parseInt(sessionIdParam, 10)
        : null;
    const sessionFilterSql =
      sessionIdNum != null && Number.isFinite(sessionIdNum)
        ? sql.unsafe(` AND ar.session_id = ${sessionIdNum}`)
        : sql.unsafe("");

    let studentTermFilter = sql.unsafe("");
    if (!isInstructor && recordStudentId) {
      const window = await getEnrollmentAttendanceWindow(Number(recordStudentId));
      if (window) {
        const courseId = window.courseId;
        const sectionCode = window.sectionCode.replace(/'/g, "''");
        const graceStart = termStartWithGrace(window.termStart);
        const startPred = graceStart
          ? `AND (asess.id IS NULL OR asess.start_time::date >= '${graceStart}'::date)`
          : "";
        const endPred = window.termEnd
          ? `AND asess.start_time::date <= '${window.termEnd}'::date`
          : "";
        studentTermFilter = sql.unsafe(`
          AND asess.id IS NOT NULL
          AND TRIM(asess.section) = TRIM('${sectionCode}')
          AND (asess.course_id IS NULL OR asess.course_id = ${courseId})
          ${startPred}
          ${endPred}
        `);
      }
    }

    if (!recordStudentId && !section && sessionIdNum == null) {
      return NextResponse.json(
        { error: "Student ID, section, or sessionId is required" },
        { status: 400 }
      );
    }


    let records;
    if (recordStudentId) {
      // Get records for specific student
      try {
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
            ar.session_id as "sessionId",
            ar.check_in_lat as "checkInLat",
            ar.check_in_long as "checkInLong",
            asess.class_title as "classTitle",
            asess.start_time as "startTime",
            asess.end_time as "endTime"
          FROM attendance_records ar
          LEFT JOIN attendance_sessions asess ON ar.session_id = asess.id
          WHERE ar.student_id = ${recordStudentId}
            AND ar.deleted_at IS NULL
            ${studentScopedInCourse}
            ${studentTermFilter}
          ORDER BY ar.timestamp DESC
        `;
      } catch (columnError: any) {
        // If deleted_at column doesn't exist, try without it
        if (isMissingDeletedAtColumn(columnError)) {
          console.warn('[Attendance Records API] deleted_at column not found, querying without it');
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
              ar.session_id as "sessionId",
            ar.check_in_lat as "checkInLat",
              ar.check_in_long as "checkInLong",
              COALESCE(asess.class_title, 'Unknown Class') as "classTitle",
              asess.start_time as "startTime",
              asess.end_time as "endTime"
            FROM attendance_records ar
            LEFT JOIN attendance_sessions asess ON ar.session_id = asess.id
            WHERE ar.student_id = ${recordStudentId}
            ${studentScopedInCourse}
            ${studentTermFilter}
            ORDER BY ar.timestamp DESC
          `;
        } else {
          throw columnError;
        }
      }
    } else if (sessionIdNum != null) {
      try {
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
            ar.session_id as "sessionId",
            ar.check_in_lat as "checkInLat",
            ar.check_in_long as "checkInLong",
            COALESCE(asess.class_title, 'Unknown Class') as "classTitle",
            asess.start_time as "startTime",
            asess.end_time as "endTime"
          FROM attendance_records ar
          LEFT JOIN attendance_sessions asess ON ar.session_id = asess.id
          WHERE ar.session_id = ${sessionIdNum}
            AND ar.deleted_at IS NULL
            ${instructorTermWindow}
            ${sectionCourseLock}
          ORDER BY ar.timestamp DESC
        `;
      } catch (columnError: unknown) {
        if (isMissingDeletedAtColumn(columnError)) {
          console.warn("[Attendance Records API] deleted_at column not found, querying session without it");
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
              ar.session_id as "sessionId",
              ar.check_in_lat as "checkInLat",
              ar.check_in_long as "checkInLong",
              COALESCE(asess.class_title, 'Unknown Class') as "classTitle",
              asess.start_time as "startTime",
              asess.end_time as "endTime"
            FROM attendance_records ar
            LEFT JOIN attendance_sessions asess ON ar.session_id = asess.id
            WHERE ar.session_id = ${sessionIdNum}
              ${instructorTermWindow}
              ${sectionCourseLock}
            ORDER BY ar.timestamp DESC
          `;
        } else {
          throw columnError;
        }
      }
    } else {
      // Get records for entire section
      // Use LEFT JOIN in case session was deleted but records still exist
      try {
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
            ar.session_id as "sessionId",
            ar.check_in_lat as "checkInLat",
            ar.check_in_long as "checkInLong",
            COALESCE(asess.class_title, 'Unknown Class') as "classTitle",
            asess.start_time as "startTime",
            asess.end_time as "endTime"
          FROM attendance_records ar
          LEFT JOIN attendance_sessions asess ON ar.session_id = asess.id
          WHERE ar.section = ${section}
            AND ar.deleted_at IS NULL
            ${sectionCourseLock}
            ${instructorTermWindow}
            ${sessionFilterSql}
          ORDER BY ar.timestamp DESC
        `;
      } catch (columnError: any) {
        // If deleted_at column doesn't exist, try without it
        if (isMissingDeletedAtColumn(columnError)) {
          console.warn('[Attendance Records API] deleted_at column not found, querying without it');
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
              ar.session_id as "sessionId",
            ar.check_in_lat as "checkInLat",
              ar.check_in_long as "checkInLong",
              COALESCE(asess.class_title, 'Unknown Class') as "classTitle",
              asess.start_time as "startTime",
              asess.end_time as "endTime"
            FROM attendance_records ar
            LEFT JOIN attendance_sessions asess ON ar.session_id = asess.id
            WHERE ar.section = ${section}
            ${sectionCourseLock}
            ${instructorTermWindow}
            ${sessionFilterSql}
            ORDER BY ar.timestamp DESC
          `;
        } else {
          throw columnError;
        }
      }
    }

    // Filter by status if specified
    let filteredRecords = records;
    if (status && status !== 'all') {
      filteredRecords = records.filter((r: any) => r.status === status);
    }

    return NextResponse.json({
      success: true,
      records: filteredRecords,
      total: filteredRecords.length,
    });
  } catch (error: any) {
    console.error("[Attendance Records API] Error:", {
      error: error.message,
      stack: error.stack,
      section,
      studentId,
      details: error.toString(),
    });
    return NextResponse.json(
      { 
        error: "Failed to fetch attendance records",
        message: error.message,
        details: error.toString(),
        section: section || null,
        studentId: studentId || null,
      },
      { status: 500 }
    );
  }
}

// PUT - Update attendance record (instructor only; session must belong to instructor)
export async function PUT(req: NextRequest) {
  try {
    const instructorIdRaw = req.headers.get("x-instructor-id")?.trim();
    const instructorId = instructorIdRaw ? parseInt(instructorIdRaw, 10) : NaN;
    if (!instructorIdRaw || Number.isNaN(instructorId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const attendanceAuth = await requireInstructorAttendanceAccess(req);
    if (!attendanceAuth.ok) return attendanceAuth.response;

    const scoped = await resolveOptionalCourseScope(req);
    if (!scoped.ok) return scoped.response;

    const body = await req.json();
    const recordId = Number(body.recordId ?? body.id);
    const status = body.status != null ? String(body.status).trim().toLowerCase() : null;
    const geoVerified =
      body.geoVerified === undefined ? null : body.geoVerified === null ? null : Boolean(body.geoVerified);

    if (!Number.isFinite(recordId)) {
      return NextResponse.json({ error: "Record ID is required" }, { status: 400 });
    }

    if (status && !isAttendanceStatus(status)) {
      return NextResponse.json(
        { error: "status must be present, absent, excused, or late" },
        { status: 400 },
      );
    }

    const owned = await sql`
      SELECT ar.id, asess.instructor_id, asess.section
      FROM attendance_records ar
      INNER JOIN attendance_sessions asess ON ar.session_id = asess.id
      WHERE ar.id = ${recordId}
      LIMIT 1
    `;

    if (owned.length === 0) {
      return NextResponse.json({ error: "Record not found or not authorized" }, { status: 404 });
    }

    const sessionMeta = owned[0] as { id: number; instructor_id: number; section: string }
    const canAccess = await canActorAccessAttendanceSession(
      instructorId,
      { instructor_id: sessionMeta.instructor_id, section: sessionMeta.section },
      scoped.courseId ?? attendanceAuth.courseId,
    )
    if (!canAccess) {
      return NextResponse.json({ error: "Record not found or not authorized" }, { status: 404 });
    }

    const pointsEarned =
      status && isAttendanceStatus(status) ? attendancePointsForStatus(status) : null;
    const statusSql = status || null;
    const geoSql = body.geoVerified === undefined ? null : geoVerified;

    await sql`
      UPDATE attendance_records
      SET
        status = COALESCE(${statusSql}, status),
        geo_verified = COALESCE(${geoSql}, geo_verified),
        points_earned = COALESCE(${pointsEarned}, points_earned)
      WHERE id = ${recordId}
    `;

    const meta = await sql`
      SELECT ar.student_id, ar.section
      FROM attendance_records ar
      WHERE ar.id = ${recordId}
      LIMIT 1
    `;
    if (meta.length > 0) {
      const row = meta[0] as { student_id: number; section: string | null };
      await syncGradebookForAttendanceMark(Number(row.student_id), row.section);
    }

    return NextResponse.json({
      success: true,
      message: "Attendance record updated successfully",
    });
  } catch (error) {
    console.error("Error updating attendance record:", error);
    return NextResponse.json(
      { error: "Failed to update attendance record" },
      { status: 500 }
    );
  }
}

// DELETE - Soft delete attendance record (instructor only)
export async function DELETE(req: NextRequest) {
  try {
    const instructorIdRaw = req.headers.get("x-instructor-id")?.trim();
    const instructorId = instructorIdRaw ? parseInt(instructorIdRaw, 10) : NaN;
    if (!instructorIdRaw || Number.isNaN(instructorId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const attendanceAuth = await requireInstructorAttendanceAccess(req);
    if (!attendanceAuth.ok) return attendanceAuth.response;

    const scoped = await resolveOptionalCourseScope(req);
    if (!scoped.ok) return scoped.response;

    const { searchParams } = new URL(req.url);
    const recordIdRaw = searchParams.get("recordId");
    const permanent = searchParams.get("permanent") === "true";
    const recordId = recordIdRaw ? parseInt(recordIdRaw, 10) : NaN;

    if (!Number.isFinite(recordId)) {
      return NextResponse.json(
        { error: "Record ID is required" },
        { status: 400 }
      );
    }

    const owned = await sql`
      SELECT ar.id, ar.student_id, ar.section, asess.instructor_id, asess.section AS session_section
      FROM attendance_records ar
      INNER JOIN attendance_sessions asess ON ar.session_id = asess.id
      WHERE ar.id = ${recordId}
      LIMIT 1
    `;

    if (owned.length === 0) {
      return NextResponse.json({ error: "Record not found or not authorized" }, { status: 404 });
    }

    const sessionMeta = owned[0] as {
      id: number
      student_id: number
      section: string | null
      instructor_id: number
      session_section: string
    }
    const canAccess = await canActorAccessAttendanceSession(
      instructorId,
      { instructor_id: sessionMeta.instructor_id, section: sessionMeta.session_section },
      scoped.courseId ?? attendanceAuth.courseId,
    )
    if (!canAccess) {
      return NextResponse.json({ error: "Record not found or not authorized" }, { status: 404 });
    }

    if (permanent) {
      await sql`
        DELETE FROM attendance_records
        WHERE id = ${recordId}
      `;
    } else {
      try {
        await sql`
          UPDATE attendance_records
          SET deleted_at = NOW()
          WHERE id = ${recordId}
        `;
      } catch (columnError: unknown) {
        if (!isMissingDeletedAtColumn(columnError)) throw columnError;
        await sql`
          DELETE FROM attendance_records
          WHERE id = ${recordId}
        `;
      }
    }

    try {
      await syncGradebookForAttendanceMark(Number(sessionMeta.student_id), sessionMeta.section);
    } catch (syncError) {
      console.error("[Attendance Records API] Gradebook sync after delete failed:", syncError);
    }

    return NextResponse.json({
      success: true,
      message: permanent ? "Attendance record permanently deleted" : "Attendance record moved to trash",
    });
  } catch (error) {
    console.error("Error deleting attendance record:", error);
    return NextResponse.json(
      { error: "Failed to delete attendance record" },
      { status: 500 }
    );
  }
}

