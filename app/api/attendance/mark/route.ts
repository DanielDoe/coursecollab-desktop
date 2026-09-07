import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { CENTRAL_TIMEZONE } from "@/lib/timezone";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { syncGradebookForAttendanceMark } from "@/lib/grades";
import { requireBoundStudentCaller } from "@/lib/student-api-auth";

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      studentId: claimedStudentId,
      sessionId,
      checkInLat,
      checkInLong,
      qrCode,
      code, // Fallback alphanumeric code
      checkInMethod, // Track which method was used: 'qr' or 'code'
    } = body;

    const bound = await requireBoundStudentCaller(
      req,
      claimedStudentId != null ? String(claimedStudentId) : null,
    );
    if (!bound.ok) return bound.response;
    const studentId = bound.studentDbId;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing required fields: studentId and sessionId are required" },
        { status: 400 }
      );
    }

    // At least one authentication method must be provided
    if (!qrCode && !code) {
      return NextResponse.json(
        { error: "Missing authentication: Provide QR code or fallback code" },
        { status: 400 }
      );
    }


    // 1. Verify session exists and is active
    let sessionQuery;
    if (qrCode) {
      // QR code validation
      sessionQuery = sql`
        SELECT * FROM attendance_sessions
        WHERE id = ${sessionId}
          AND qr_code = ${qrCode}
          AND is_active = true
          AND COALESCE(is_cancelled, false) = false
          AND qr_expires_at > (NOW() AT TIME ZONE 'UTC')
      `;
    } else {
      // Fallback method - just check session exists and is active
      sessionQuery = sql`
        SELECT * FROM attendance_sessions
        WHERE id = ${sessionId}
          AND is_active = true
          AND COALESCE(is_cancelled, false) = false
          AND qr_expires_at > (NOW() AT TIME ZONE 'UTC')
      `;
    }

    const session = await sessionQuery;

    if (session.length === 0) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 400 }
      );
    }

    const sessionData = session[0];

    // Validate method: QR or fallback code
    let validatedMethod = checkInMethod || "qr";
    let isValidMethod = false;

    if (qrCode) {
      // QR code validation already done above
      isValidMethod = true;
      validatedMethod = "qr";
    } else if (code) {
      // Validate fallback code (case-insensitive)
      if (sessionData.fallback_code && code.toUpperCase() === sessionData.fallback_code.toUpperCase()) {
        isValidMethod = true;
        validatedMethod = "code";
      }
    }

    if (!isValidMethod) {
      return NextResponse.json(
        { error: "Invalid attendance method. Please check your QR code or fallback code." },
        { status: 400 }
      );
    }

    // 2. Check if within time window (using CT timezone)
    const currentTime = new Date();
    const nowCT = toZonedTime(currentTime, CENTRAL_TIMEZONE);
    const startTimeCT = toZonedTime(new Date(sessionData.start_time), CENTRAL_TIMEZONE);
    const endTimeCT = toZonedTime(new Date(sessionData.end_time), CENTRAL_TIMEZONE);

    if (nowCT < startTimeCT) {
      return NextResponse.json(
        { error: "Check-in has not opened yet for this session" },
        { status: 400 }
      );
    }

    if (nowCT > endTimeCT) {
      return NextResponse.json(
        { error: "Attendance window has closed" },
        { status: 400 }
      );
    }

    // 3. Get student details with session code
    const student = await sql`
      SELECT s.id, s.full_name, s.student_id, sess.code as section
      FROM students s
      JOIN sessions sess ON s.session_id = sess.id
      WHERE s.id = ${studentId}
    `;

    if (student.length === 0) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    const studentData = student[0];

    // 4. Verify student is in correct section
    if (studentData.section !== sessionData.section) {
      return NextResponse.json(
        { error: "You are not enrolled in this section" },
        { status: 403 }
      );
    }

    // 5. Check if already marked attendance (BEFORE any other processing)
    // This prevents duplicate attendance via QR scan OR code entry
    const existing = await sql`
      SELECT id, check_in_method FROM attendance_records
      WHERE student_id = ${studentId} AND session_id = ${sessionId}
    `;

    if (existing.length > 0) {
      const existingMethod = existing[0].check_in_method || 'QR scan or code';
      return NextResponse.json(
        { 
          error: `Attendance already recorded for this session. You previously checked in using ${existingMethod === 'qr' ? 'QR scan' : existingMethod === 'code' ? 'code entry' : 'QR scan or code'}. Attendance can only be recorded once per session.`,
          alreadyRecorded: true,
          method: existingMethod
        },
        { status: 400 }
      );
    }

    // 6. Verify geolocation - REQUIRED only if session has require_location flag enabled
    // If location is not required but student provides it, we still verify it
    let geoVerified = null; // null = not verified, true = verified, false = failed verification
    let distance = null;

    // Check if location verification is required for this session
    const requireLocation = sessionData.require_location === true;

    // If session requires location verification, student MUST provide location
    if (requireLocation) {
      // Ensure location coordinates exist in session
      if (!sessionData.location_lat || !sessionData.location_long) {
        return NextResponse.json(
          {
            error: "Location verification is required but session location is not configured. Please contact your instructor.",
            locationRequired: true,
          },
          { status: 400 }
        );
      }
      if (!checkInLat || !checkInLong) {
        return NextResponse.json(
          {
            error: "Location is required for this attendance session. Please enable location services and try again.",
            required: true,
            locationRequired: true,
          },
          { status: 400 }
        );
      }

      // Parse coordinates with validation
      const studentLat = parseFloat(checkInLat);
      const studentLon = parseFloat(checkInLong);
      const sessionLat = parseFloat(sessionData.location_lat);
      const sessionLon = parseFloat(sessionData.location_long);

      // Validate coordinates
      if (isNaN(studentLat) || isNaN(studentLon) || isNaN(sessionLat) || isNaN(sessionLon)) {
        return NextResponse.json(
          {
            error: "Invalid location coordinates. Please try again.",
            locationRequired: true,
          },
          { status: 400 }
        );
      }

      distance = calculateDistance(
        studentLat,
        studentLon,
        sessionLat,
        sessionLon
      );

      // Add a small tolerance buffer (5 meters) to account for GPS inaccuracy
      const toleranceBuffer = 5; // meters
      const effectiveRadius = sessionData.radius_meters + toleranceBuffer;
      
      geoVerified = distance <= effectiveRadius;

      // Always log location data for debugging (even on success)
      console.log(`\n[ATTENDANCE DEBUG] ===========================================`);
      console.log(`[ATTENDANCE DEBUG] Location Verification ${geoVerified ? 'SUCCESS' : 'FAILED'}`);
      console.log(`[ATTENDANCE DEBUG] ===========================================`);
      console.log(`[ATTENDANCE DEBUG] QR Session Location: lat=${sessionLat}, lon=${sessionLon}, radius=${sessionData.radius_meters}m`);
      console.log(`[ATTENDANCE DEBUG] Student Phone Location: lat=${studentLat}, lon=${studentLon}`);
      console.log(`[ATTENDANCE DEBUG] Distance: ${Math.round(distance)}m, Effective Radius: ${effectiveRadius}m`);
      console.log(`[ATTENDANCE DEBUG] Verification: ${geoVerified ? 'PASSED' : 'FAILED'}`);
      console.log(`[ATTENDANCE DEBUG] ===========================================\n`);

      if (!geoVerified) {
        // Comprehensive logging for debugging
        console.log(`\n[ATTENDANCE DEBUG] ===========================================`);
        console.log(`[ATTENDANCE DEBUG] Location Verification Failed`);
        console.log(`[ATTENDANCE DEBUG] ===========================================`);
        console.log(`[ATTENDANCE DEBUG] QR Code Session Details:`);
        console.log(`[ATTENDANCE DEBUG]   - Session ID: ${sessionId}`);
        console.log(`[ATTENDANCE DEBUG]   - Class Title: ${sessionData.class_title}`);
        console.log(`[ATTENDANCE DEBUG]   - Section: ${sessionData.section}`);
        console.log(`[ATTENDANCE DEBUG]   - Location Required: ${requireLocation}`);
        console.log(`[ATTENDANCE DEBUG]   - Session Location:`);
        console.log(`[ATTENDANCE DEBUG]     * Latitude: ${sessionLat} (${sessionData.location_lat})`);
        console.log(`[ATTENDANCE DEBUG]     * Longitude: ${sessionLon} (${sessionData.location_long})`);
        console.log(`[ATTENDANCE DEBUG]   - Allowed Radius: ${sessionData.radius_meters}m`);
        console.log(`[ATTENDANCE DEBUG]   - Effective Radius (with 5m buffer): ${effectiveRadius}m`);
        console.log(`[ATTENDANCE DEBUG] `);
        console.log(`[ATTENDANCE DEBUG] Student Phone Location:`);
        console.log(`[ATTENDANCE DEBUG]   - Student ID: ${studentId}`);
        console.log(`[ATTENDANCE DEBUG]   - Student Name: ${studentData.full_name}`);
        console.log(`[ATTENDANCE DEBUG]   - Phone Location:`);
        console.log(`[ATTENDANCE DEBUG]     * Latitude: ${studentLat} (${checkInLat})`);
        console.log(`[ATTENDANCE DEBUG]     * Longitude: ${studentLon} (${checkInLong})`);
        console.log(`[ATTENDANCE DEBUG] `);
        console.log(`[ATTENDANCE DEBUG] Distance Calculation:`);
        console.log(`[ATTENDANCE DEBUG]   - Calculated Distance: ${Math.round(distance)}m`);
        console.log(`[ATTENDANCE DEBUG]   - Required Distance: ≤ ${effectiveRadius}m`);
        console.log(`[ATTENDANCE DEBUG]   - Difference: ${Math.round(distance - effectiveRadius)}m over limit`);
        console.log(`[ATTENDANCE DEBUG] ===========================================\n`);

        return NextResponse.json(
          {
            error: `You are ${Math.round(distance)}m away from the class location. The allowed radius is ${sessionData.radius_meters}m. Please move closer and try again.`,
            distance: Math.round(distance),
            required: sessionData.radius_meters,
            locationRequired: true,
            studentLocation: { lat: studentLat, lon: studentLon },
            sessionLocation: { lat: sessionLat, lon: sessionLon },
          },
          { status: 400 }
        );
      }
    } else if (checkInLat && checkInLong && sessionData.location_lat && sessionData.location_long) {
      // Location is NOT required, but student provided location data - verify it anyway
      const studentLat = parseFloat(checkInLat);
      const studentLon = parseFloat(checkInLong);
      const sessionLat = parseFloat(sessionData.location_lat);
      const sessionLon = parseFloat(sessionData.location_long);

      // Only verify if coordinates are valid
      if (!isNaN(studentLat) && !isNaN(studentLon) && !isNaN(sessionLat) && !isNaN(sessionLon)) {
        distance = calculateDistance(
          studentLat,
          studentLon,
          sessionLat,
          sessionLon
        );

        // Add a small tolerance buffer (5 meters) to account for GPS inaccuracy
        const toleranceBuffer = 5; // meters
        const effectiveRadius = (sessionData.radius_meters || 0) + toleranceBuffer;
        
        geoVerified = distance <= effectiveRadius;
      }
    }

    // 7. Record attendance
    const points = 1; // Base points
    // Get current time - store as UTC (database will handle timezone)
    const timestampUTC = currentTime;
    
    await sql`
      INSERT INTO attendance_records (
        student_id,
        session_id,
        student_name,
        student_number,
        section,
        check_in_lat,
        check_in_long,
        geo_verified,
        distance_meters,
        status,
        points_earned,
        timestamp,
        check_in_method
      ) VALUES (
        ${studentId},
        ${sessionId},
        ${studentData.full_name},
        ${studentData.student_id},
        ${studentData.section},
        ${checkInLat || null},
        ${checkInLong || null},
        ${geoVerified},
        ${distance ? Math.round(distance) : null},
        'present',
        ${points},
        ${timestampUTC.toISOString()}::timestamp,
        ${validatedMethod}
      )
    `;

    // 8. Update or create streak (using CT date)
    const todayCT = toZonedTime(new Date(), CENTRAL_TIMEZONE);
    const today = todayCT.toISOString().split('T')[0];
    const streak = await sql`
      SELECT * FROM attendance_streaks
      WHERE student_id = ${studentId}
    `;

    if (streak.length === 0) {
      // Create new streak
      await sql`
        INSERT INTO attendance_streaks (
          student_id,
          student_name,
          section,
          current_streak,
          longest_streak,
          total_points,
          last_attendance_date
        ) VALUES (
          ${studentId},
          ${studentData.full_name},
          ${studentData.section},
          1,
          1,
          ${points},
          ${today}
        )
      `;
    } else {
      const streakData = streak[0];
      const lastDate = streakData.last_attendance_date;
      const yesterdayCT = toZonedTime(new Date(), CENTRAL_TIMEZONE);
      yesterdayCT.setDate(yesterdayCT.getDate() - 1);
      const yesterdayStr = yesterdayCT.toISOString().split('T')[0];

      let newStreak = 1;
      if (lastDate === yesterdayStr) {
        // Consecutive day
        newStreak = streakData.current_streak + 1;
      } else if (lastDate !== today) {
        // Streak broken
        newStreak = 1;
      } else {
        // Same day, don't update streak
        newStreak = streakData.current_streak;
      }

      const longestStreak = Math.max(newStreak, streakData.longest_streak);
      const bonusPoints = newStreak % 5 === 0 ? 5 : 0; // +5 bonus every 5 days

      await sql`
        UPDATE attendance_streaks
        SET current_streak = ${newStreak},
            longest_streak = ${longestStreak},
            total_points = total_points + ${points + bonusPoints},
            last_attendance_date = ${today}
        WHERE student_id = ${studentId}
      `;
    }

    await syncGradebookForAttendanceMark(
      Number(studentId),
      String(studentData.section ?? ""),
    );

    return NextResponse.json({
      success: true,
      message: "Attendance recorded successfully",
      points,
      geoVerified,
      distance: distance ? Math.round(distance) : null,
    });
  } catch (error: any) {
    console.error("[ATTENDANCE MARK] Error:", error);
    return NextResponse.json(
      { 
        error: "Failed to mark attendance",
        details: error.message || "Unknown error"
      },
      { status: 500 }
    );
  }
}

