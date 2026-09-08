import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireInstructorCourse } from "@/lib/instructor-course-scope";
import { requireProjectsListScope } from "@/lib/project-request-auth";

// GET - Fetch presentation configuration
export async function GET(request: NextRequest) {
  try {
    const scope = await requireProjectsListScope(request)
    if (!scope.ok) return scope.response
    const { searchParams } = new URL(request.url);
    const session = searchParams.get("session");

    if (session) {
      // Get config for specific session
      const config = await sql`
        SELECT * FROM presentation_config
        WHERE session = ${session} AND is_active = TRUE
      `;

      if (config.length === 0) {
        return NextResponse.json(
          { error: "Configuration not found for this session" },
          { status: 404 }
        );
      }

      return NextResponse.json({ config: config[0] });
    } else {
      // Get all configs
      const configs = await sql`
        SELECT * FROM presentation_config
        WHERE is_active = TRUE
        ORDER BY session ASC
      `;

      return NextResponse.json({ configs });
    }
  } catch (error) {
    console.error("Error fetching presentation config:", error);
    const message = error instanceof Error ? error.message : String(error);
    if (/presentation_config|relation.*does not exist/i.test(message)) {
      return NextResponse.json({ configs: [] });
    }
    return NextResponse.json(
      { error: "Failed to fetch configuration" },
      { status: 500 }
    );
  }
}

// POST - Create or update presentation configuration
export async function POST(request: NextRequest) {
  try {
    const instructor = await requireInstructorCourse(request)
    if (!instructor.ok) return instructor.response
    const body = await request.json();
    const {
      session,
      presentationStartDate,
      presentationEndDate,
      lectureDays,
      startTime,
      endTime,
      slotDuration,
      location,
      createdBy,
      scheduleByDay,
    } = body;

    // Validate required fields
    if (!session || !presentationStartDate || !presentationEndDate || !lectureDays || !startTime || !endTime) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    let scheduleByDayToStore: unknown = null;
    if (scheduleByDay === undefined) {
      const existing = await sql`
        SELECT schedule_by_day FROM presentation_config WHERE session = ${session} LIMIT 1
      `;
      scheduleByDayToStore =
        (existing as { schedule_by_day?: unknown }[])[0]?.schedule_by_day ?? null;
    } else {
      scheduleByDayToStore = scheduleByDay;
    }

    // Upsert configuration
    const result = await sql`
      INSERT INTO presentation_config (
        session,
        presentation_start_date,
        presentation_end_date,
        lecture_days,
        start_time,
        end_time,
        slot_duration,
        location,
        created_by,
        schedule_by_day
      )
      VALUES (
        ${session},
        ${presentationStartDate},
        ${presentationEndDate},
        ${lectureDays},
        ${startTime},
        ${endTime},
        ${slotDuration || 20},
        ${location || 'New Electrical Engineering Bldg 119'},
        ${createdBy},
        ${scheduleByDayToStore != null ? JSON.stringify(scheduleByDayToStore) : null}::jsonb
      )
      ON CONFLICT (session)
      DO UPDATE SET
        presentation_start_date = EXCLUDED.presentation_start_date,
        presentation_end_date = EXCLUDED.presentation_end_date,
        lecture_days = EXCLUDED.lecture_days,
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        slot_duration = EXCLUDED.slot_duration,
        location = EXCLUDED.location,
        schedule_by_day = EXCLUDED.schedule_by_day,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    return NextResponse.json({
      message: "Configuration saved successfully",
      config: result[0],
    });
  } catch (error) {
    console.error("Error saving presentation config:", error);
    return NextResponse.json(
      { error: "Failed to save configuration" },
      { status: 500 }
    );
  }
}

// DELETE - Deactivate a configuration
export async function DELETE(request: NextRequest) {
  try {
    const instructor = await requireInstructorCourse(request)
    if (!instructor.ok) return instructor.response
    const { searchParams } = new URL(request.url);
    const session = searchParams.get("session");

    if (!session) {
      return NextResponse.json(
        { error: "Session is required" },
        { status: 400 }
      );
    }

    const result = await sql`
      UPDATE presentation_config
      SET is_active = FALSE
      WHERE session = ${session}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Configuration not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Configuration deactivated",
      config: result[0],
    });
  } catch (error) {
    console.error("Error deleting presentation config:", error);
    return NextResponse.json(
      { error: "Failed to deactivate configuration" },
      { status: 500 }
    );
  }
}

