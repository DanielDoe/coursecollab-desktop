import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireProjectsListScope } from "@/lib/project-request-auth";
import { requireCallerStudentDbId } from "@/lib/student-api-auth";
import { requireInstructorSession } from "@/lib/instructor-session-auth";
import { resolveGroupProjectTermScope } from "@/lib/group-project-term-scope";
import {
  formatLocalDateYmd,
  isStartEndValidBookableSlotInWindows,
  resolvePresentationTimeWindowsForDate,
  toYmdFromDb,
} from "@/lib/presentation-window-time";
import {
  assertSequentialBookingAllowed,
  toPresentationConfigLike,
} from "@/lib/presentation-sequential-booking";
import type { PresentationSqlTagged } from "@/lib/presentation-sequential-booking";

// GET - Fetch all presentations or filter by query params
export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const scope = await requireProjectsListScope(request)
    if (!scope.ok) return scope.response
    const gCourseScope = scope.gCourseScope
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const groupId = searchParams.get("groupId");
    const date = searchParams.get("date");
    const status = searchParams.get("status") || "scheduled";
    const sessionRaw = searchParams.get("session");
    const session =
      sessionRaw && sessionRaw.trim().toLowerCase() !== "all" ? sessionRaw.trim() : null;
    const gTermScope = await resolveGroupProjectTermScope(request, scope.courseId, session);


    // Build WHERE conditions
    const conditions = ["1=1"];
    
    if (projectId) {
      conditions.push(`pp.project_id = ${parseInt(projectId)}`);
    }
    if (groupId) {
      conditions.push(`pp.group_id = ${parseInt(groupId)}`);
    }
    if (date) {
      conditions.push(`pp.scheduled_date = '${date}'`);
    }
    if (session) {
      conditions.push(`pp.session = '${session}'`);
    }
    // Exclude cancelled presentations by default
    if (status && status !== "all") {
      conditions.push(`pp.status = '${status}'`);
    } else if (status === "all") {
      // Include all statuses including cancelled
      conditions.push("1=1");
    } else {
      // Default: exclude cancelled
      conditions.push(`pp.status != 'cancelled'`);
    }

    // Build query dynamically based on filters
    // Use specific queries for common filter combinations
    let presentations;
    
    if (projectId && session && status && status !== "all") {
      // Common case: Filter by projectId, session, and status
      presentations = await sql`
        SELECT pp.*, p.title as project_title, p.status as project_status,
               g.name as group_name, g.session, s.full_name as created_by_name
        FROM project_presentations pp
        JOIN projects p ON pp.project_id = p.id
        JOIN groups g ON pp.group_id = g.id
        LEFT JOIN students s ON pp.created_by = s.id
        WHERE pp.project_id = ${parseInt(projectId)}
          AND pp.session = ${session}
          AND pp.status = ${status}
          AND (${gCourseScope}) AND (${gTermScope})
        ORDER BY pp.scheduled_date ASC, pp.start_time ASC
      `;
    } else if (projectId && session) {
      // Filter by projectId and session (all statuses except cancelled by default)
      presentations = await sql`
        SELECT pp.*, p.title as project_title, p.status as project_status,
               g.name as group_name, g.session, s.full_name as created_by_name
        FROM project_presentations pp
        JOIN projects p ON pp.project_id = p.id
        JOIN groups g ON pp.group_id = g.id
        LEFT JOIN students s ON pp.created_by = s.id
        WHERE pp.project_id = ${parseInt(projectId)}
          AND pp.session = ${session}
          AND pp.status != 'cancelled'
          AND (${gCourseScope}) AND (${gTermScope})
        ORDER BY pp.scheduled_date ASC, pp.start_time ASC
      `;
    } else if (projectId && groupId && date && status && status !== "all") {
      presentations = await sql`
        SELECT pp.*, p.title as project_title, p.status as project_status,
               g.name as group_name, g.session, s.full_name as created_by_name
        FROM project_presentations pp
        JOIN projects p ON pp.project_id = p.id
        JOIN groups g ON pp.group_id = g.id
        LEFT JOIN students s ON pp.created_by = s.id
        WHERE pp.project_id = ${parseInt(projectId)}
          AND pp.group_id = ${parseInt(groupId)}
          AND pp.scheduled_date = ${date}
          AND pp.status = ${status}
          AND (${gCourseScope}) AND (${gTermScope})
        ORDER BY pp.scheduled_date ASC, pp.start_time ASC
      `;
    } else if (status && status !== "all") {
      presentations = await sql`
        SELECT pp.*, p.title as project_title, p.status as project_status,
               g.name as group_name, g.session, s.full_name as created_by_name
        FROM project_presentations pp
        JOIN projects p ON pp.project_id = p.id
        JOIN groups g ON pp.group_id = g.id
        LEFT JOIN students s ON pp.created_by = s.id
        WHERE pp.status = ${status}
          AND (${gCourseScope}) AND (${gTermScope})
        ORDER BY pp.scheduled_date ASC, pp.start_time ASC
      `;
    } else {
      // Default: get all presentations (used by instructor dashboard)
      // Show ALL presentations including past dates for record keeping
      presentations = await sql`
        SELECT pp.*, p.title as project_title, p.status as project_status,
               g.name as group_name, g.session, s.full_name as created_by_name
        FROM project_presentations pp
        JOIN projects p ON pp.project_id = p.id
        JOIN groups g ON pp.group_id = g.id
        LEFT JOIN students s ON pp.created_by = s.id
        WHERE (${gCourseScope}) AND (${gTermScope})
        ORDER BY pp.scheduled_date ASC, pp.start_time ASC
      `;
    }

    // Normalize dates to strings (YYYY-MM-DD format)
    if (presentations && presentations.length > 0) {
      presentations = presentations.map((p: any) => {
        if (p.scheduled_date) {
          p.scheduled_date = toYmdFromDb(p.scheduled_date);
        }
        return p;
      });
    }

    return NextResponse.json({ 
      presentations: presentations || [],
      count: presentations?.length || 0
    });
  } catch (error) {
    console.error("Error fetching presentations:", error);
    return NextResponse.json(
      { error: "Failed to fetch presentations" },
      { status: 500 }
    );
  }
}

// POST - Create/Schedule a new presentation
export async function POST(request: NextRequest) {
  try {
    const scope = await requireProjectsListScope(request)
    if (!scope.ok) return scope.response
    const body = await request.json();
    const {
      projectId,
      groupId,
      scheduledDate,
      startTime,
      endTime,
      location,
      notes,
      createdBy,
      session,
    } = body;

    // Validate required fields
    if (!projectId || !groupId || !scheduledDate || !startTime || !endTime || !session) {
      return NextResponse.json(
        { error: "Missing required fields. Session is required." },
        { status: 400 }
      );
    }

    const scheduledYmdForDb = toYmdFromDb(scheduledDate);
    if (!scheduledYmdForDb) {
      return NextResponse.json({ error: "Invalid scheduled date." }, { status: 400 });
    }

    const todayCentralYmd = formatLocalDateYmd(new Date());
    if (scheduledYmdForDb < todayCentralYmd) {
      return NextResponse.json(
        {
          error: `Cannot schedule on a past date (${scheduledYmdForDb}). Choose today or a future presentation day (US Central).`,
        },
        { status: 400 }
      );
    }

    // Validate that the scheduled date is on a valid day for the session
    try {
      // Get presentation config for this session
      const config = await sql`
        SELECT lecture_days, presentation_start_date, presentation_end_date,
               start_time, end_time, slot_duration, schedule_by_day
        FROM presentation_config
        WHERE session = ${session} AND is_active = TRUE
        LIMIT 1
      `;

      if (config.length > 0) {
        const configLike = toPresentationConfigLike(config[0] as never);

        if (scheduledYmdForDb > configLike.presentation_end_date) {
          return NextResponse.json(
            {
              error: `Invalid date. Presentations for ${session} must be scheduled on or before ${configLike.presentation_end_date}.`,
            },
            { status: 400 }
          );
        }

        const scheduledDateObj = new Date(`${scheduledYmdForDb}T12:00:00`);
        const dayOfWeek = scheduledDateObj.getDay();
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = dayNames[dayOfWeek];

        const dayMap: { [key: string]: number } = {
          Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
          Thursday: 4, Friday: 5, Saturday: 6
        };

        const validDays = configLike.lecture_days.map((day) => dayMap[day]);

        if (!validDays.includes(dayOfWeek)) {
          const validDayNames = configLike.lecture_days.join(' or ');
          return NextResponse.json(
            {
              error: `Invalid date for ${session}. ${session} presentations must be scheduled on ${validDayNames}. ${dayName} is not a valid day for this session.`,
              validDays: configLike.lecture_days,
            },
            { status: 400 }
          );
        }

        const slotDur = Number(configLike.slot_duration) || 20;
        const windows = resolvePresentationTimeWindowsForDate(configLike, scheduledYmdForDb);

        if (windows.length === 0) {
          return NextResponse.json(
            {
              error: `No presentation time window for ${scheduledYmdForDb} for ${session}. Check the configured date range.`,
            },
            { status: 400 }
          );
        }

        if (!isStartEndValidBookableSlotInWindows(startTime, endTime, windows, slotDur)) {
          return NextResponse.json(
            {
              error:
                "Selected time is not a valid slot for this session on this date.",
            },
            { status: 400 }
          );
        }

        const seq = await assertSequentialBookingAllowed(
          sql as unknown as PresentationSqlTagged,
          session,
          configLike,
          scheduledYmdForDb
        );
        if (!seq.ok) {
          return NextResponse.json({ error: seq.error }, { status: 400 });
        }
      }
    } catch (validationError) {
      console.error("[Presentations][POST] Date validation error:", validationError);
      // Don't fail if validation check fails, but log it
    }

    // Check for existing presentation for this project AND session
    const existingPresentation = await sql`
      SELECT * FROM project_presentations 
      WHERE project_id = ${projectId} AND session = ${session}
      ORDER BY created_at DESC
      LIMIT 1
    `;


    // Determine project id to exclude from conflict check (only if an active presentation exists)
    const conflictProjectId =
      existingPresentation.length > 0 && existingPresentation[0].status !== "cancelled"
        ? existingPresentation[0].project_id
        : null;

    // Check for conflicts using the database function
    const conflict = await sql`
      SELECT * FROM check_presentation_conflict(
        ${scheduledYmdForDb}::DATE,
        ${startTime}::TIME,
        ${endTime}::TIME,
        ${conflictProjectId}
      )
    `;

    if (conflict.length > 0 && conflict[0].conflict_found) {
      const conflictInfo = conflict[0];
      return NextResponse.json(
        {
          error: "Time slot conflict",
          conflict: {
            projectTitle: conflictInfo.conflicting_project_title,
            groupName: conflictInfo.conflicting_group_name,
            startTime: conflictInfo.conflicting_start_time,
            endTime: conflictInfo.conflicting_end_time,
          },
        },
        { status: 409 }
      );
    }

    if (existingPresentation.length > 0) {
      const presentation = existingPresentation[0];

      if (presentation.status === "cancelled") {
        const updated = await sql`
          UPDATE project_presentations
          SET 
            scheduled_date = ${scheduledYmdForDb},
            start_time = ${startTime},
            end_time = ${endTime},
            location = ${location},
            notes = ${notes || null},
            status = 'scheduled',
            created_by = ${createdBy},
            session = ${session},
            updated_at = NOW()
          WHERE id = ${presentation.id}
          RETURNING *
        `;

        return NextResponse.json(
          {
            message: "Presentation rescheduled successfully",
            presentation: updated[0],
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { error: "This project already has a scheduled presentation" },
        { status: 409 }
      );
    }

    // Create the presentation with session
    const result = await sql`
      INSERT INTO project_presentations (
        project_id, group_id, scheduled_date, start_time, end_time,
        location, notes, created_by, status, session
      )
      VALUES (
        ${projectId}, ${groupId}, ${scheduledYmdForDb}, ${startTime}, ${endTime},
        ${location}, ${notes || null}, ${createdBy}, 'scheduled', ${session}
      )
      RETURNING *
    `;


    return NextResponse.json(
      {
        message: "Presentation scheduled successfully",
        presentation: result[0],
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating presentation:", error);
    
    if (error.code === "23505") {
      // Unique constraint violation - project already has a presentation
      return NextResponse.json(
        { error: "This project already has a scheduled presentation" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to schedule presentation" },
      { status: 500 }
    );
  }
}

// PUT - Update presentation
export async function PUT(request: NextRequest) {
  try {
    const scope = await requireProjectsListScope(request)
    if (!scope.ok) return scope.response
    const body = await request.json();
    const {
      presentationId,
      scheduledDate,
      startTime,
      endTime,
      location,
      notes,
      status,
      instructorNotes,
      attendanceTaken,
    } = body;

    if (!presentationId) {
      return NextResponse.json(
        { error: "Presentation ID is required" },
        { status: 400 }
      );
    }

    // If updating time/date, check for conflicts
    if (scheduledDate && startTime && endTime) {
      const scheduledYmdPut = toYmdFromDb(scheduledDate);
      if (!scheduledYmdPut) {
        return NextResponse.json({ error: "Invalid scheduled date." }, { status: 400 });
      }

      const todayCentralPut = formatLocalDateYmd(new Date());
      if (scheduledYmdPut < todayCentralPut) {
        return NextResponse.json(
          {
            error: `Cannot reschedule to a past date (${scheduledYmdPut}). Choose today or a future day (US Central).`,
          },
          { status: 400 }
        );
      }

      // Get the project_id and session for this presentation
      const presentation = await sql`
        SELECT project_id, session FROM project_presentations WHERE id = ${presentationId}
      `;

      if (presentation.length === 0) {
        return NextResponse.json(
          { error: "Presentation not found" },
          { status: 404 }
        );
      }

      const presentationSession = presentation[0].session;

      // Validate that the scheduled date is on a valid day for the session
      try {
        const config = await sql`
          SELECT lecture_days, presentation_start_date, presentation_end_date,
                 start_time, end_time, slot_duration, schedule_by_day
          FROM presentation_config
          WHERE session = ${presentationSession} AND is_active = TRUE
          LIMIT 1
        `;

        if (config.length > 0) {
          const configLike = toPresentationConfigLike(config[0] as never);
          const scheduledYmd = scheduledYmdPut;

          if (scheduledYmd > configLike.presentation_end_date) {
            return NextResponse.json(
              {
                error: `Invalid date. Presentations for ${presentationSession} must be scheduled on or before ${configLike.presentation_end_date}.`,
              },
              { status: 400 }
            );
          }

          const scheduledDateObj = new Date(`${scheduledYmd}T12:00:00`);
          const dayOfWeek = scheduledDateObj.getDay();
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const dayName = dayNames[dayOfWeek];

          const dayMap: { [key: string]: number } = {
            Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
            Thursday: 4, Friday: 5, Saturday: 6
          };

          const validDays = configLike.lecture_days.map((day) => dayMap[day]);

          if (!validDays.includes(dayOfWeek)) {
            const validDayNames = configLike.lecture_days.join(' or ');
            return NextResponse.json(
              {
                error: `Invalid date for ${presentationSession}. ${presentationSession} presentations must be scheduled on ${validDayNames}. ${dayName} is not a valid day for this session.`,
                validDays: configLike.lecture_days
              },
              { status: 400 }
            );
          }

          const slotDur = Number(configLike.slot_duration) || 20;
          const windows = resolvePresentationTimeWindowsForDate(configLike, scheduledYmd);

          if (windows.length === 0) {
            return NextResponse.json(
              {
                error: `No presentation time window for ${scheduledYmd} for ${presentationSession}.`,
              },
              { status: 400 }
            );
          }

          if (!isStartEndValidBookableSlotInWindows(startTime, endTime, windows, slotDur)) {
            return NextResponse.json(
              {
                error:
                  "Selected time is not a valid slot for this session on this date.",
              },
              { status: 400 }
            );
          }

          const seq = await assertSequentialBookingAllowed(
            sql as unknown as PresentationSqlTagged,
            presentationSession,
            configLike,
            scheduledYmd
          );
          if (!seq.ok) {
            return NextResponse.json({ error: seq.error }, { status: 400 });
          }
        }
      } catch (validationError) {
        console.error("[Presentations][PUT] Date validation error:", validationError);
      }

      const conflict = await sql`
        SELECT * FROM check_presentation_conflict(
          ${scheduledYmdPut}::DATE,
          ${startTime}::TIME,
          ${endTime}::TIME,
          ${presentation[0].project_id}
        )
      `;

      if (conflict.length > 0 && conflict[0].conflict_found) {
        const conflictInfo = conflict[0];
        return NextResponse.json(
          {
            error: "Time slot conflict",
            conflict: {
              projectTitle: conflictInfo.conflicting_project_title,
              groupName: conflictInfo.conflicting_group_name,
              startTime: conflictInfo.conflicting_start_time,
              endTime: conflictInfo.conflicting_end_time,
            },
          },
          { status: 409 }
        );
      }
    }

    // Build update query dynamically
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (scheduledDate !== undefined) {
      updates.push(`scheduled_date = $${paramIndex}`);
      params.push(toYmdFromDb(scheduledDate) || scheduledDate);
      paramIndex++;
    }

    if (startTime !== undefined) {
      updates.push(`start_time = $${paramIndex}`);
      params.push(startTime);
      paramIndex++;
    }

    if (endTime !== undefined) {
      updates.push(`end_time = $${paramIndex}`);
      params.push(endTime);
      paramIndex++;
    }

    if (location !== undefined) {
      updates.push(`location = $${paramIndex}`);
      params.push(location);
      paramIndex++;
    }

    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex}`);
      params.push(notes);
      paramIndex++;
    }

    if (status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (instructorNotes !== undefined) {
      updates.push(`instructor_notes = $${paramIndex}`);
      params.push(instructorNotes);
      paramIndex++;
    }

    if (attendanceTaken !== undefined) {
      updates.push(`attendance_taken = $${paramIndex}`);
      params.push(attendanceTaken);
      paramIndex++;
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    // Build dynamic update query using Neon SQL template
    let result: any;

    // Use dynamic query construction based on what's being updated
    if (status !== undefined && scheduledDate === undefined && startTime === undefined && endTime === undefined && location === undefined && notes === undefined && instructorNotes === undefined && attendanceTaken === undefined) {
      // Simple case: only status is being updated
      result = await sql`
        UPDATE project_presentations
        SET status = ${status}
        WHERE id = ${presentationId}
        RETURNING *
      `;
    } else {
      // Complex case: multiple fields updated - use unsafe for flexibility
      params.push(presentationId);
      const query = `
        UPDATE project_presentations
        SET ${updates.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING *
      `;
      result = await sql.unsafe(query, params);
    }

    if (!result || !Array.isArray(result) || result.length === 0) {
      return NextResponse.json(
        { error: "Presentation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Presentation updated successfully",
      presentation: result[0],
    });
  } catch (error) {
    console.error("Error updating presentation:", error);
    return NextResponse.json(
      { error: "Failed to update presentation" },
      { status: 500 }
    );
  }
}

// DELETE - Cancel/Delete a presentation
export async function DELETE(request: NextRequest) {
  try {
    const scope = await requireProjectsListScope(request)
    if (!scope.ok) return scope.response
    const { searchParams } = new URL(request.url);
    const presentationId = searchParams.get("presentationId");

    if (!presentationId) {
      return NextResponse.json(
        { error: "Presentation ID is required" },
        { status: 400 }
      );
    }

    const student = await requireCallerStudentDbId(request);
    const instructor = student.ok ? null : await requireInstructorSession(request);
    const actorStudentId = student.ok ? String(student.studentDbId) : null;
    const actorInstructorId = instructor && instructor.ok ? String(instructor.instructorId) : null;

    if (!actorStudentId && !actorInstructorId) {
      return NextResponse.json(
        { error: "Unauthorized cancellation attempt" },
        { status: 401 }
      );
    }

    // Get presentation details
    const presentation = await sql`
      SELECT 
        pp.id, 
        pp.project_id, 
        pp.group_id,
        pp.session,
        pp.status,
        pp.created_by,
        s.full_name as creator_name
      FROM project_presentations pp
      LEFT JOIN students s ON pp.created_by = s.id
      WHERE pp.id = ${parseInt(presentationId)}
    `;

    if (presentation.length === 0) {
      return NextResponse.json(
        { error: "Presentation not found" },
        { status: 404 }
      );
    }

    if (presentation[0].status === "cancelled") {
      return NextResponse.json({
        message: "Presentation already cancelled",
        presentation: presentation[0],
      });
    }

    if (actorStudentId) {
      const parsedStudentId = parseInt(actorStudentId);
      const parsedPresentationId = parseInt(presentationId);
      
      // Check if creator
      const isCreator = parsedStudentId === presentation[0].created_by;

      // Check if group member
      const groupMembers = await sql`
        SELECT gm.student_id
        FROM group_members gm
        WHERE gm.group_id = ${presentation[0].group_id}
          AND gm.student_id = ${parsedStudentId}
        LIMIT 1
      `;
      const isMember = groupMembers.length > 0;

      if (!isCreator && !isMember) {
        return NextResponse.json(
          { error: "You are not authorized to cancel this presentation" },
          { status: 403 }
        );
      }
    }

    // For instructors: Hard delete from database
    // For students: Soft delete (mark as cancelled so they know to reschedule)
    let result;

    if (actorInstructorId) {
      // Instructor: Hard delete - completely remove from database
      result = await sql`
        DELETE FROM project_presentations
        WHERE id = ${parseInt(presentationId)}
        RETURNING id, project_id, status
      `;

      if (!result || result.length === 0) {
        return NextResponse.json(
          { error: "Presentation not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        message: "Presentation deleted successfully",
        presentation: result[0],
        deleted: true,
        deleteType: "hard",
      });
    } else if (actorStudentId) {
      // Student: Soft delete - mark as cancelled so they see it and know to reschedule
      result = await sql`
        UPDATE project_presentations
        SET status = 'cancelled'
        WHERE id = ${parseInt(presentationId)}
        RETURNING *
      `;

      if (!result || result.length === 0) {
        return NextResponse.json(
          { error: "Presentation not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        message: "Presentation cancelled successfully",
        presentation: result[0],
        deleted: false,
        deleteType: "soft",
      });
    }
  } catch (error) {
    console.error("Error deleting presentation:", error);
    return NextResponse.json(
      { error: "Failed to delete presentation" },
      { status: 500 }
    );
  }
}

