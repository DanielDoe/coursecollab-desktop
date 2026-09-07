import { NextRequest, NextResponse } from "next/server";
import { sql, executeParameterizedSql } from "@/lib/db";
import crypto from "crypto";
import { CENTRAL_TIMEZONE } from "@/lib/timezone";
import { fromZonedTime } from "date-fns-tz";
import { generateFallbackCode } from "@/lib/attendance-utils";
import { resolveOptionalCourseScope } from "@/lib/optional-instructor-course-scope";
import { normalizeAttendanceDbTimestamp } from "@/lib/db-timestamp";
import {
  canActorAccessAttendanceSession,
  requireInstructorAttendanceAccess,
} from "@/lib/instructor-attendance-auth";
import { sqlAttendanceSessionScope, sqlAttendanceSessionTermWindowScope } from "@/lib/attendance-instructor-scope";

// Generate unique QR code
function generateQRCode(sessionId: number, section: string): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(16).toString("hex");
  return `ATTEND_${sessionId}_${section}_${timestamp}_${random}`;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET - Fetch attendance sessions
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const instructorId = searchParams.get("instructorId");
  const section = searchParams.get("section");
  const isActive = searchParams.get("isActive");
  const sessionId = searchParams.get("sessionId");
  
  try {
    const attendanceAuth = await requireInstructorAttendanceAccess(req);
    if (!attendanceAuth.ok) return attendanceAuth.response;
    // Check if fallback_code and require_location columns exist (do this once at the start)
    const columnCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'attendance_sessions' 
        AND column_name IN ('fallback_code', 'require_location', 'is_cancelled')
    `;
    const columnRows = Array.isArray(columnCheck) ? columnCheck : [];
    const hasFallbackCode = columnRows.some((col: { column_name?: string }) => col.column_name === 'fallback_code');
    const hasRequireLocation = columnRows.some((col: { column_name?: string }) => col.column_name === 'require_location');
    const hasIsCancelled = columnRows.some((col: { column_name?: string }) => col.column_name === 'is_cancelled');

    const scoped = await resolveOptionalCourseScope(req);
    if (!scoped.ok) return scoped.response;

    let platformCourseId: number | null = null;
    if (scoped.courseId != null) {
      if (instructorId && String(instructorId) !== String(attendanceAuth.actorId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      platformCourseId = scoped.courseId;
    }

    const courseAttendanceFilterSql =
      platformCourseId != null
        ? await sqlAttendanceSessionScope(req, platformCourseId)
        : sql.unsafe("");

    const termWindowSql =
      platformCourseId != null
        ? await sqlAttendanceSessionTermWindowScope(req, platformCourseId)
        : sql.unsafe("");

    const validSessionDatesSql = sql.unsafe(
      " AND asess.start_time >= '2024-01-01'::timestamp ",
    );

    // If sessionId is provided, fetch that specific session
    if (sessionId) {
      // Build SELECT and GROUP BY clauses conditionally
      const selectParts = [
        'asess.id',
        'asess.course_id',
        'asess.section',
        'asess.instructor_id',
        'asess.class_title',
        'asess.start_time::text as start_time',
        'asess.end_time::text as end_time',
        'asess.location_lat',
        'asess.location_long',
        'asess.radius_meters'
      ];
      
      const groupByParts = [
        'asess.id', 'asess.course_id', 'asess.section', 'asess.instructor_id', 'asess.class_title',
        'asess.start_time', 'asess.end_time', 'asess.location_lat', 'asess.location_long',
        'asess.radius_meters'
      ];
      
      if (hasRequireLocation) {
        selectParts.push('asess.require_location');
        groupByParts.push('asess.require_location');
      } else {
        selectParts.push('NULL as require_location');
      }
      
      selectParts.push('asess.qr_code', 'asess.qr_expires_at::text as qr_expires_at', 'asess.is_active');
      groupByParts.push('asess.qr_code', 'asess.qr_expires_at', 'asess.is_active');

      if (hasIsCancelled) {
        selectParts.push('asess.is_cancelled');
        groupByParts.push('asess.is_cancelled');
      } else {
        selectParts.push('false as is_cancelled');
      }
      
      if (hasFallbackCode) {
        selectParts.push('asess.fallback_code');
        groupByParts.push('asess.fallback_code');
      } else {
        selectParts.push('NULL as fallback_code');
      }
      
      selectParts.push('asess.created_at', 'asess.updated_at', 'COUNT(ar.id) as total_attended');
      groupByParts.push('asess.created_at', 'asess.updated_at');
      
      const selectClause = selectParts.join(', ');
      const groupByClause = groupByParts.join(', ');

      const session = await sql`
        SELECT ${sql.unsafe(selectClause)}
        FROM attendance_sessions asess
        LEFT JOIN attendance_records ar ON asess.id = ar.session_id
        WHERE asess.id = ${parseInt(sessionId, 10)}
          ${courseAttendanceFilterSql}
          ${termWindowSql}
        GROUP BY ${sql.unsafe(groupByClause)}
      `;

      const normalizeTimestamp = normalizeAttendanceDbTimestamp;

      if (session.length === 0) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      const normalizedSession = {
        ...session[0],
        start_time: normalizeTimestamp(session[0].start_time),
        end_time: normalizeTimestamp(session[0].end_time),
        qr_expires_at: normalizeTimestamp(session[0].qr_expires_at),
        created_at: normalizeTimestamp(session[0].created_at),
        updated_at: normalizeTimestamp(session[0].updated_at),
      };

      return NextResponse.json({
        success: true,
        sessions: [normalizedSession],
        total: 1,
      });
    }

    if (!instructorId && !section) {
      return NextResponse.json(
        { error: "Instructor ID, section, or sessionId is required" },
        { status: 400 }
      );
    }

    if (instructorId) {
      const instIdNum = Number(instructorId);
      if (!Number.isFinite(instIdNum) || instIdNum <= 0) {
        return NextResponse.json({ error: "Invalid instructor ID" }, { status: 400 });
      }
    }

    // Build query based on available parameters - build GROUP BY conditionally
    // Build GROUP BY parts as array and join them
    const groupByParts = [
      'asess.id', 'asess.course_id', 'asess.section', 'asess.instructor_id', 'asess.class_title',
      'asess.start_time', 'asess.end_time', 'asess.location_lat', 'asess.location_long',
      'asess.radius_meters'
    ];
    
    if (hasRequireLocation) {
      groupByParts.push('asess.require_location');
    }
    
    groupByParts.push('asess.qr_code', 'asess.qr_expires_at', 'asess.is_active');

    if (hasIsCancelled) {
      groupByParts.push('asess.is_cancelled');
    }
    
    if (hasFallbackCode) {
      groupByParts.push('asess.fallback_code');
    }
    
    groupByParts.push('asess.created_at', 'asess.updated_at');
    
    const groupByClause = groupByParts.join(', ');

    // Build SELECT clause conditionally
    const selectParts = [
      'asess.id',
      'asess.course_id',
      'asess.section',
      'asess.instructor_id',
      'asess.class_title',
      'asess.start_time::text as start_time',
      'asess.end_time::text as end_time',
      'asess.location_lat',
      'asess.location_long',
      'asess.radius_meters'
    ];
    
    if (hasRequireLocation) {
      selectParts.push('asess.require_location');
    } else {
      selectParts.push('NULL as require_location');
    }
    
    selectParts.push(
      'asess.qr_code',
      'asess.qr_expires_at::text as qr_expires_at',
      'asess.is_active'
    );

    if (hasIsCancelled) {
      selectParts.push('asess.is_cancelled');
    } else {
      selectParts.push('false as is_cancelled');
    }
    
    if (hasFallbackCode) {
      selectParts.push('asess.fallback_code');
    } else {
      selectParts.push('NULL as fallback_code');
    }
    
    selectParts.push('asess.created_at', 'asess.updated_at', 'COUNT(ar.id) as total_attended');
    
    const selectClause = selectParts.join(', ');

    let sessions;
    if (instructorId) {
      const instIdNum = Number(instructorId);
      const courseScopedList = platformCourseId != null;
      if (isActive !== null) {
        sessions = courseScopedList
          ? await sql`
              SELECT ${sql.unsafe(selectClause)}
              FROM attendance_sessions asess
              LEFT JOIN attendance_records ar ON asess.id = ar.session_id
              WHERE asess.is_active = ${isActive === "true"}
                ${courseAttendanceFilterSql}
                ${termWindowSql}
              GROUP BY ${sql.unsafe(groupByClause)}
              ORDER BY asess.start_time DESC
            `
          : await sql`
              SELECT ${sql.unsafe(selectClause)}
              FROM attendance_sessions asess
              LEFT JOIN attendance_records ar ON asess.id = ar.session_id
              WHERE asess.instructor_id = ${instIdNum}
                AND asess.is_active = ${isActive === "true"}
                ${courseAttendanceFilterSql}
                ${termWindowSql}
              GROUP BY ${sql.unsafe(groupByClause)}
              ORDER BY asess.start_time DESC
            `;
      } else {
        sessions = courseScopedList
          ? await sql`
              SELECT ${sql.unsafe(selectClause)}
              FROM attendance_sessions asess
              LEFT JOIN attendance_records ar ON asess.id = ar.session_id
              WHERE 1=1
                ${courseAttendanceFilterSql}
                ${termWindowSql}
              GROUP BY ${sql.unsafe(groupByClause)}
              ORDER BY asess.start_time DESC
            `
          : await sql`
              SELECT ${sql.unsafe(selectClause)}
              FROM attendance_sessions asess
              LEFT JOIN attendance_records ar ON asess.id = ar.session_id
              WHERE asess.instructor_id = ${instIdNum}
                ${courseAttendanceFilterSql}
                ${termWindowSql}
              GROUP BY ${sql.unsafe(groupByClause)}
              ORDER BY asess.start_time DESC
            `;
      }
    } else {
      // section is provided
      if (isActive !== null) {
        sessions = await sql`
          SELECT ${sql.unsafe(selectClause)}
          FROM attendance_sessions asess
          LEFT JOIN attendance_records ar ON asess.id = ar.session_id
          WHERE asess.section = ${section}
            AND asess.is_active = ${isActive === 'true'}
            ${validSessionDatesSql}
          GROUP BY ${sql.unsafe(groupByClause)}
          ORDER BY asess.start_time DESC
        `;
      } else {
        sessions = await sql`
          SELECT ${sql.unsafe(selectClause)}
          FROM attendance_sessions asess
          LEFT JOIN attendance_records ar ON asess.id = ar.session_id
          WHERE asess.section = ${section}
            ${validSessionDatesSql}
          GROUP BY ${sql.unsafe(groupByClause)}
          ORDER BY asess.start_time DESC
        `;
      }
    }

    const normalizeTimestamp = normalizeAttendanceDbTimestamp;

    // Ensure all timestamp fields are returned as ISO strings with UTC indication
    // This prevents JavaScript from misinterpreting them as local time
    const sessionRows = Array.isArray(sessions) ? sessions : [];
    const normalizedSessions = sessionRows.map((session: Record<string, unknown>) => ({
      ...session,
      start_time: normalizeTimestamp(session.start_time),
      end_time: normalizeTimestamp(session.end_time),
      qr_expires_at: normalizeTimestamp(session.qr_expires_at),
      created_at: normalizeTimestamp(session.created_at),
      updated_at: normalizeTimestamp(session.updated_at),
    }));

    return NextResponse.json({
      success: true,
      sessions: normalizedSessions,
      total: normalizedSessions.length,
    });
  } catch (error: any) {
    console.error("Error fetching attendance sessions:", {
      error: error.message,
      stack: error.stack,
      instructorId,
      section,
      isActive,
      details: error.toString(),
    });
    return NextResponse.json(
      { 
        error: "Failed to fetch attendance sessions",
        message: error.message,
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}

// POST - Create new attendance session
export async function POST(req: NextRequest) {
  try {
    const attendanceAuth = await requireInstructorAttendanceAccess(req);
    if (!attendanceAuth.ok) return attendanceAuth.response;

    console.log("[Attendance API] POST /api/attendance/sessions - Starting session creation");
    
    const body = await req.json();
    console.log("[Attendance API] Request body received:", {
      instructorId: body.instructorId,
      section: body.section,
      classTitle: body.classTitle,
      startTime: body.startTime,
      endTime: body.endTime,
      requireLocation: body.requireLocation,
      locationLat: body.locationLat,
      locationLong: body.locationLong,
      radiusMeters: body.radiusMeters,
      qrExpiryMinutes: body.qrExpiryMinutes,
    });

    const {
      instructorId,
      section,
      classTitle,
      startTime,
      endTime,
      requireLocation = false,
      locationLat,
      locationLong,
      radiusMeters = 100,
      qrExpiryMinutes = 30,
    } = body;

    // Validate required fields
    if (!instructorId || !section || !classTitle || !startTime || !endTime) {
      console.error("[Attendance API] Missing required fields:", {
        instructorId: !!instructorId,
        section: !!section,
        classTitle: !!classTitle,
        startTime: !!startTime,
        endTime: !!endTime,
      });
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const scopedPost = await resolveOptionalCourseScope(req);
    if (!scopedPost.ok) return scopedPost.response;
    if (scopedPost.courseId != null && String(scopedPost.instructorId ?? "") !== String(instructorId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (scopedPost.courseId != null) {
      const inCourse = await sql`
        SELECT 1 FROM sessions
        WHERE course_id = ${scopedPost.courseId}
          AND TRIM(code) = TRIM(${section})
        LIMIT 1
      `;
      if (inCourse.length === 0) {
        return NextResponse.json(
          { error: "Section is not part of the selected course" },
          { status: 400 },
        );
      }
    }

    console.log("[Attendance API] All required fields present, checking database columns...");

    // Check if fallback_code and require_location columns exist
    const columnCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'attendance_sessions' 
        AND column_name IN ('fallback_code', 'require_location')
    `;
    const hasFallbackCode = columnCheck.some((col: any) => col.column_name === 'fallback_code');
    const hasRequireLocation = columnCheck.some((col: any) => col.column_name === 'require_location');
    
    console.log("[Attendance API] Column existence check:", {
      fallback_code: hasFallbackCode,
      require_location: hasRequireLocation,
    });

    // startTime and endTime come from client as UTC ISO strings (already converted from CT by convertCentralDateTimeToUtcISO)
    // Store them directly as UTC timestamps - no conversion needed
    const startTimeUTC = new Date(startTime);
    const endTimeUTC = new Date(endTime);
    
    console.log("[Attendance API] Parsed timestamps:", {
      startTimeUTC: startTimeUTC.toISOString(),
      endTimeUTC: endTimeUTC.toISOString(),
      startTimeUTCValid: !isNaN(startTimeUTC.getTime()),
      endTimeUTCValid: !isNaN(endTimeUTC.getTime()),
    });
    
    // Calculate QR expiry time (add minutes to endTime UTC)
    const qrExpiresAtUTC = new Date(endTimeUTC.getTime() + qrExpiryMinutes * 60000);
    console.log("[Attendance API] QR expires at:", qrExpiresAtUTC.toISOString());

    // Validate: if requireLocation is true, location must be provided
    if (requireLocation && (!locationLat || !locationLong)) {
      console.error("[Attendance API] Location required but not provided");
      return NextResponse.json(
        { error: "Location coordinates are required when location verification is enabled" },
        { status: 400 }
      );
    }

    console.log("[Attendance API] Inserting session into database...");

    // Create session first to get ID - conditionally include require_location
    let result;
    if (hasRequireLocation) {
      // require_location column exists - include it in INSERT
      console.log("[Attendance API] Using INSERT with require_location column");
      result = await sql`
        INSERT INTO attendance_sessions (
          instructor_id,
          section,
          class_title,
          start_time,
          end_time,
          require_location,
          location_lat,
          location_long,
          radius_meters,
          qr_code,
          qr_expires_at,
          is_active
        ) VALUES (
          ${instructorId},
          ${section},
          ${classTitle},
          ${startTimeUTC.toISOString()}::timestamp,
          ${endTimeUTC.toISOString()}::timestamp,
          ${requireLocation},
          ${requireLocation ? (locationLat || null) : null},
          ${requireLocation ? (locationLong || null) : null},
          ${requireLocation ? radiusMeters : null},
          'temp',
          ${qrExpiresAtUTC.toISOString()}::timestamp,
          true
        )
        RETURNING id
      `;
    } else {
      // require_location column doesn't exist - skip it
      console.log("[Attendance API] Using INSERT without require_location column");
      result = await sql`
        INSERT INTO attendance_sessions (
          instructor_id,
          section,
          class_title,
          start_time,
          end_time,
          location_lat,
          location_long,
          radius_meters,
          qr_code,
          qr_expires_at,
          is_active
        ) VALUES (
          ${instructorId},
          ${section},
          ${classTitle},
          ${startTimeUTC.toISOString()}::timestamp,
          ${endTimeUTC.toISOString()}::timestamp,
          ${requireLocation ? (locationLat || null) : null},
          ${requireLocation ? (locationLong || null) : null},
          ${requireLocation ? radiusMeters : null},
          'temp',
          ${qrExpiresAtUTC.toISOString()}::timestamp,
          true
        )
        RETURNING id
      `;
    }

    console.log("[Attendance API] Session inserted successfully, ID:", result[0]?.id);

    if (!result || !result[0] || !result[0].id) {
      console.error("[Attendance API] Failed to get session ID from insert result:", result);
      throw new Error("Failed to create session - no ID returned");
    }

    const sessionId = result[0].id;
    console.log("[Attendance API] Generated session ID:", sessionId);

    console.log("[Attendance API] Generating QR code...");
    const qrCode = generateQRCode(sessionId, section);
    console.log("[Attendance API] QR code generated:", qrCode.substring(0, 50) + "...");

    // Update with actual QR code and fallback code (if column exists)
    if (hasFallbackCode) {
      // Generate simple fallback code
      console.log("[Attendance API] Generating fallback code...");
      const fallbackCode = generateFallbackCode(6);
      console.log("[Attendance API] Fallback code generated:", fallbackCode);
      
      console.log("[Attendance API] Updating session with QR code and fallback code...");
      await sql`
        UPDATE attendance_sessions
        SET 
          qr_code = ${qrCode},
          fallback_code = ${fallbackCode}
        WHERE id = ${sessionId}
      `;
      console.log("[Attendance API] Session updated successfully with QR and fallback code");
    } else {
      // Column doesn't exist, just update QR code
      console.log("[Attendance API] Fallback code column doesn't exist, updating QR code only...");
      await sql`
        UPDATE attendance_sessions
        SET qr_code = ${qrCode}
        WHERE id = ${sessionId}
      `;
      console.log("[Attendance API] Session updated successfully with QR code");
    }

    // Fetch the session with explicit column selection - conditionally include require_location and fallback_code
    let session;
    if (hasFallbackCode && hasRequireLocation) {
      // Both columns exist
      session = await sql`
        SELECT 
          id,
          course_id,
          section,
          instructor_id,
          class_title,
          start_time,
          end_time,
          location_lat,
          location_long,
          radius_meters,
          require_location,
          qr_code,
          qr_expires_at,
          is_active,
          fallback_code,
          created_at,
          updated_at
        FROM attendance_sessions
        WHERE id = ${sessionId}
      `;
    } else if (hasFallbackCode && !hasRequireLocation) {
      // Only fallback_code exists
      session = await sql`
        SELECT 
          id,
          course_id,
          section,
          instructor_id,
          class_title,
          start_time,
          end_time,
          location_lat,
          location_long,
          radius_meters,
          NULL as require_location,
          qr_code,
          qr_expires_at,
          is_active,
          fallback_code,
          created_at,
          updated_at
        FROM attendance_sessions
        WHERE id = ${sessionId}
      `;
    } else if (!hasFallbackCode && hasRequireLocation) {
      // Only require_location exists
      session = await sql`
        SELECT 
          id,
          course_id,
          section,
          instructor_id,
          class_title,
          start_time,
          end_time,
          location_lat,
          location_long,
          radius_meters,
          require_location,
          qr_code,
          qr_expires_at,
          is_active,
          NULL as fallback_code,
          created_at,
          updated_at
        FROM attendance_sessions
        WHERE id = ${sessionId}
      `;
    } else {
      // Neither column exists
      session = await sql`
        SELECT 
          id,
          course_id,
          section,
          instructor_id,
          class_title,
          start_time,
          end_time,
          location_lat,
          location_long,
          radius_meters,
          NULL as require_location,
          NULL as fallback_code,
          qr_code,
          qr_expires_at,
          is_active,
          created_at,
          updated_at
        FROM attendance_sessions
        WHERE id = ${sessionId}
      `;
    }
    
    const normalizeTimestamp = normalizeAttendanceDbTimestamp;

    // Normalize timestamp fields to ensure UTC interpretation
    const sessionData = session[0];
    const normalizedSession = {
      ...sessionData,
      start_time: normalizeTimestamp(sessionData.start_time),
      end_time: normalizeTimestamp(sessionData.end_time),
      qr_expires_at: normalizeTimestamp(sessionData.qr_expires_at),
      created_at: normalizeTimestamp(sessionData.created_at),
      updated_at: normalizeTimestamp(sessionData.updated_at),
    };

    console.log("[Attendance API] Session creation completed successfully:", {
      sessionId: normalizedSession.id,
      classTitle: normalizedSession.class_title,
      section: normalizedSession.section,
      hasFallbackCode: !!normalizedSession.fallback_code,
    });

    return NextResponse.json({
      success: true,
      message: "Attendance session created successfully",
      session: normalizedSession,
      qrCode,
      fallbackCode: hasFallbackCode ? normalizedSession.fallback_code : null,
    });
  } catch (error: any) {
    console.error("[Attendance API] ERROR creating attendance session:");
    console.error("[Attendance API] Error type:", error?.constructor?.name);
    console.error("[Attendance API] Error message:", error?.message);
    console.error("[Attendance API] Error stack:", error?.stack);
    console.error("[Attendance API] Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    // Check for specific database errors
    if (error?.code) {
      console.error("[Attendance API] Database error code:", error.code);
    }
    if (error?.detail) {
      console.error("[Attendance API] Database error detail:", error.detail);
    }
    if (error?.hint) {
      console.error("[Attendance API] Database error hint:", error.hint);
    }
    
    return NextResponse.json(
      { 
        error: "Failed to create attendance session",
        message: error?.message || "Unknown error",
        details: process.env.NODE_ENV === "development" ? error?.stack : undefined,
      },
      { status: 500 }
    );
  }
}

// PUT - Update attendance session
export async function PUT(req: NextRequest) {
  try {
    const attendanceAuth = await requireInstructorAttendanceAccess(req);
    if (!attendanceAuth.ok) return attendanceAuth.response;

    const body = await req.json();
    const {
      sessionId,
      isActive,
      classTitle,
      startTime,
      endTime,
      locationLat,
      locationLong,
      radiusMeters,
      qrExpiryMinutes,
      regenerateQRCode,
      section,
      isCancelled,
    } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    const existing = await sql`
      SELECT * FROM attendance_sessions
      WHERE id = ${sessionId}
    `;

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Attendance session not found" },
        { status: 404 }
      );
    }

    const session = existing[0];

    const scopedPut = await resolveOptionalCourseScope(req);
    if (!scopedPut.ok) return scopedPut.response;

    const canAccess = await canActorAccessAttendanceSession(
      attendanceAuth.actorId,
      {
        instructor_id: Number(session.instructor_id),
        section: String(session.section ?? ""),
      },
      scopedPut.courseId,
    );
    if (!canAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (scopedPut.courseId != null) {
      const secToCheck = section !== undefined ? section : session.section;
      const inCourse = await sql`
        SELECT 1 FROM sessions
        WHERE course_id = ${scopedPut.courseId}
          AND TRIM(code) = TRIM(${secToCheck})
        LIMIT 1
      `;
      if (inCourse.length === 0) {
        return NextResponse.json(
          { error: "Section is not part of the selected course" },
          { status: 400 },
        );
      }
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (classTitle !== undefined) {
      updates.push(`class_title = $${paramIndex}`);
      params.push(classTitle);
      paramIndex++;
    }

    if (section !== undefined) {
      updates.push(`section = $${paramIndex}`);
      params.push(section);
      paramIndex++;
    }

    if (startTime !== undefined) {
      // Convert UTC ISO string to Date object, then back to ISO string for proper storage
      const startTimeUTC = new Date(startTime);
      updates.push(`start_time = $${paramIndex}::timestamp`);
      params.push(startTimeUTC.toISOString());
      paramIndex++;
    }

    if (endTime !== undefined) {
      // Convert UTC ISO string to Date object, then back to ISO string for proper storage
      const endTimeUTC = new Date(endTime);
      updates.push(`end_time = $${paramIndex}::timestamp`);
      params.push(endTimeUTC.toISOString());
      paramIndex++;
    }

    if (isCancelled !== undefined) {
      await sql`
        ALTER TABLE attendance_sessions
        ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN NOT NULL DEFAULT false
      `
      const cancelled = Boolean(isCancelled);
      updates.push(`is_cancelled = $${paramIndex}`);
      params.push(cancelled);
      paramIndex++;
      if (cancelled) {
        updates.push(`is_active = $${paramIndex}`);
        params.push(false);
        paramIndex++;
      }
    }

    if (isActive !== undefined && isCancelled !== true) {
      updates.push(`is_active = $${paramIndex}`);
      params.push(isActive);
      paramIndex++;
    }

    if (locationLat !== undefined) {
      updates.push(`location_lat = $${paramIndex}`);
      params.push(locationLat === null || locationLat === "" ? null : parseFloat(locationLat));
      paramIndex++;
    }

    if (locationLong !== undefined) {
      updates.push(`location_long = $${paramIndex}`);
      params.push(locationLong === null || locationLong === "" ? null : parseFloat(locationLong));
      paramIndex++;
    }

    if (radiusMeters !== undefined) {
      updates.push(`radius_meters = $${paramIndex}`);
      params.push(parseInt(radiusMeters, 10));
      paramIndex++;
    }

    if (endTime !== undefined || qrExpiryMinutes !== undefined) {
      const baseEnd = new Date(endTime ?? session.end_time);
      const existingMinutes = Math.max(
        0,
        Math.round(
          (new Date(session.qr_expires_at).getTime() -
            new Date(session.end_time).getTime()) / 60000
        )
      );
      const minutes = qrExpiryMinutes ?? existingMinutes;
      const expires = new Date(baseEnd.getTime() + minutes * 60000);
      updates.push(`qr_expires_at = $${paramIndex}`);
      params.push(expires.toISOString());
      paramIndex++;
    }

    if (regenerateQRCode) {
      const newCode = generateQRCode(sessionId, session.section);
      updates.push(`qr_code = $${paramIndex}`);
      params.push(newCode);
      paramIndex++;
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    updates.push(`updated_at = NOW()`);

    params.push(sessionId);

    const query = `
      UPDATE attendance_sessions
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await executeParameterizedSql(query, params);
    
    const normalizeTimestamp = normalizeAttendanceDbTimestamp;
    
    // Normalize timestamp fields to ensure UTC interpretation
    const updatedSessionData = result[0];
    const normalizedSession = {
      ...updatedSessionData,
      start_time: normalizeTimestamp(updatedSessionData.start_time),
      end_time: normalizeTimestamp(updatedSessionData.end_time),
      qr_expires_at: normalizeTimestamp(updatedSessionData.qr_expires_at),
    };

    return NextResponse.json({
      success: true,
      message: "Attendance session updated successfully",
      session: normalizedSession,
    });
  } catch (error) {
    console.error("Error updating attendance session:", error);
    return NextResponse.json(
      { error: "Failed to update attendance session" },
      { status: 500 }
    );
  }
}

// DELETE - Delete attendance session
export async function DELETE(req: NextRequest) {
  try {
    const attendanceAuth = await requireInstructorAttendanceAccess(req);
    if (!attendanceAuth.ok) return attendanceAuth.response;

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    const scopedDel = await resolveOptionalCourseScope(req);
    if (!scopedDel.ok) return scopedDel.response;

    const target = await sql`
      SELECT section, instructor_id FROM attendance_sessions WHERE id = ${sessionId} LIMIT 1
    `;
    if (target.length === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    const t = target[0] as { section: string; instructor_id: unknown };

    const canAccess = await canActorAccessAttendanceSession(
      attendanceAuth.actorId,
      { instructor_id: Number(t.instructor_id), section: String(t.section ?? "") },
      scopedDel.courseId,
    );
    if (!canAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (scopedDel.courseId != null) {
      const ok = await sql`
        SELECT 1 FROM sessions
        WHERE course_id = ${scopedDel.courseId}
          AND TRIM(code) = TRIM(${t.section})
        LIMIT 1
      `;
      if (ok.length === 0) {
        return NextResponse.json({ error: "Session not in selected course" }, { status: 403 });
      }
    }

    // This will cascade delete all related attendance records
    await sql`
      DELETE FROM attendance_sessions
      WHERE id = ${sessionId}
    `;

    return NextResponse.json({
      success: true,
      message: "Attendance session deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting attendance session:", error);
    return NextResponse.json(
      { error: "Failed to delete attendance session" },
      { status: 500 }
    );
  }
}

