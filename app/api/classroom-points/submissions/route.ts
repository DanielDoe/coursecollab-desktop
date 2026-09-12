import { NextRequest, NextResponse } from "next/server";
import { getSQL } from "@/lib/db";
import { createBulkNotifications, sendNewAssessmentEmailsIfConfigured } from "@/lib/create-notification";
import { resolveOptionalCourseScope } from "@/lib/optional-instructor-course-scope";
import {
  resolveClassroomPointFeedbackText,
} from "@/lib/classroom-points-ai-feedback.shared";
import { CLASSROOM_SUBMISSION_IS_ACTIVE_SQL } from "@/lib/classroom-submission-availability-sql";
import {
  redactClassroomPointsStudentSubmission,
} from "@/lib/classroom-points-student-question-config";
import {
  courseRequiresSubmissionSession,
  resolveDefaultCourseSession,
  sessionBelongsToCourse,
  sqlSubmissionCourseScope,
  sqlSubmissionSessionFilter,
} from "@/lib/classroom-submission-scope";
import { resolveStudentCourseContextByDbId } from "@/lib/student-course-scope";
import { isPreCourseStudent } from "@/lib/student-course-access-gate";
import { resolveStudentDatabaseIdFromParam } from "@/lib/resolve-student-db-id";

const sqlInstance = getSQL();

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Same CASE as CLASSROOM_SUBMISSION_IS_ACTIVE_SQL, qualified for alias `cps`. */
function sqlStudentSubmissionIsActive() {
  void CLASSROOM_SUBMISSION_IS_ACTIVE_SQL
  return sqlInstance`
    AND COALESCE(cps.hidden_from_students, false) = false
    AND (
      CASE
        WHEN cps.due_at IS NOT NULL THEN cps.due_at > NOW()
        WHEN cps.duration_hours IS NULL THEN false
        ELSE (cps.created_at + ((cps.duration_hours + 72) * INTERVAL '1 hour')) > NOW()
      END
    )
  `
}

async function loadStudentClassroomPointSubmissions(opts: {
  studentDbId: number
  session: string | null
}) {
  if (await isPreCourseStudent(opts.studentDbId)) {
    return NextResponse.json({
      submissions: [],
      missingSubmissions: [],
      pendingSubmissions: [],
      pre_course: true,
    })
  }

  const ctx = await resolveStudentCourseContextByDbId(opts.studentDbId)
  const courseId = ctx?.courseId ?? null
  if (courseId == null) {
    return NextResponse.json({
      submissions: [],
      missingSubmissions: [],
      pendingSubmissions: [],
    })
  }

  const enrolledSession = ctx.sessionCode?.trim() || ""
  if (!enrolledSession) {
    return NextResponse.json({
      submissions: [],
      missingSubmissions: [],
      pendingSubmissions: [],
    })
  }

  const courseClause = sqlSubmissionCourseScope(courseId)
  const sessionClause = sqlSubmissionSessionFilter(enrolledSession)
  const activeClause = sqlStudentSubmissionIsActive()

  const submissions = await sqlInstance`
    SELECT
      cps.id,
      cps.title,
      cps.description,
      cps.created_at,
      cps.created_by,
      cps.session,
      cps.duration_hours,
      cps.due_at,
      COALESCE(cps.submission_kind, 'code') as submission_kind,
      cps.question_config,
      CASE
        WHEN cps.due_at IS NOT NULL THEN cps.due_at
        WHEN cps.duration_hours IS NULL THEN NULL
        ELSE (cps.created_at + ((cps.duration_hours + 72) * INTERVAL '1 hour'))
      END as expires_at,
      CASE
        WHEN cps.due_at IS NOT NULL THEN cps.due_at > NOW()
        WHEN cps.duration_hours IS NULL THEN false
        WHEN (cps.created_at + ((cps.duration_hours + 72) * INTERVAL '1 hour')) > NOW() THEN true
        ELSE false
      END as is_active
    FROM classroom_point_submissions cps
    WHERE 1 = 1
      ${activeClause}
      ${courseClause}
      ${sessionClause}
    ORDER BY cps.created_at DESC
  `

  const studentSubmissions = await sqlInstance`
    SELECT DISTINCT
      submission_id,
      status
    FROM classroom_points
    WHERE student_id = ${opts.studentDbId}
      AND submission_id IS NOT NULL
  `

  const attemptedIds = new Set(studentSubmissions.map((a: { submission_id: number }) => a.submission_id))
  const pendingIds = new Set(
    studentSubmissions
      .filter((a: { status: string }) => a.status === "pending")
      .map((a: { submission_id: number }) => a.submission_id),
  )

  const missingSubmissions = submissions.filter((sub: { id: number }) => !attemptedIds.has(sub.id))
  const pendingSubmissions = submissions.filter((sub: { id: number }) => pendingIds.has(sub.id))

  let pendingFeedbackBySubmissionId: Record<
    number,
    {
      classroomPointId: number
      status: string
      points: number
      pointBooster: number
      instructorFeedback: string | null
    }
  > = {}

  if (pendingIds.size > 0) {
    try {
      await sqlInstance`ALTER TABLE classroom_points ADD COLUMN IF NOT EXISTS ai_feedback JSONB`
    } catch {
      /* ignore */
    }
    const pendingRows = await sqlInstance`
      SELECT id, submission_id, status, points, point_booster, reason, ai_feedback
      FROM classroom_points
      WHERE student_id = ${opts.studentDbId}
        AND status = 'pending'
        AND submission_id IS NOT NULL
    `
    for (const row of pendingRows as Array<{
      id: number
      submission_id: number
      status: string
      points: number | string
      point_booster: number | null
      reason: string | null
      ai_feedback: unknown
    }>) {
      pendingFeedbackBySubmissionId[row.submission_id] = {
        classroomPointId: row.id,
        status: row.status,
        points: Number(row.points) || 0,
        pointBooster: Math.max(1, Number(row.point_booster) || 1),
        instructorFeedback: resolveClassroomPointFeedbackText(row),
      }
    }
  }

  return NextResponse.json({
    submissions: submissions.map((sub: { id: number }) => ({
      ...redactClassroomPointsStudentSubmission(sub),
      attempted: attemptedIds.has(sub.id),
      pending: pendingIds.has(sub.id),
    })),
    missingSubmissions: missingSubmissions.map((sub: { question_config?: unknown }) =>
      redactClassroomPointsStudentSubmission(sub),
    ),
    pendingSubmissions: pendingSubmissions.map((sub: { id: number }) => ({
      ...redactClassroomPointsStudentSubmission(sub),
      classroomPoint: pendingFeedbackBySubmissionId[sub.id] ?? null,
    })),
    pendingFeedbackBySubmissionId,
  })
}

// GET — Students: non-expired only. Instructors (?manage=1): all rows for reuse / scheduling.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const session = searchParams.get("session");
    const studentId = searchParams.get("studentId");
    const forManage =
      searchParams.get("manage") === "1" || searchParams.get("manage") === "true";

    // Ensure optional columns exist
    try {
      await sqlInstance`ALTER TABLE classroom_point_submissions ADD COLUMN IF NOT EXISTS submission_kind TEXT NOT NULL DEFAULT 'code'`
      await sqlInstance`ALTER TABLE classroom_point_submissions ADD COLUMN IF NOT EXISTS question_config JSONB`
      await sqlInstance`ALTER TABLE classroom_point_submissions ADD COLUMN IF NOT EXISTS due_at TIMESTAMP`
    } catch {
      /* ignore */
    }

    // Check if table exists, if not return empty array
    try {
      await sqlInstance`SELECT 1 FROM classroom_point_submissions LIMIT 1`;
    } catch (tableError: any) {
      // Table doesn't exist yet, return empty array
      if (tableError?.code === '42P01') {
        console.log("[Classroom Points Submissions] Table doesn't exist yet, returning empty array");
        return NextResponse.json({ submissions: [] });
      }
      throw tableError;
    }

    const { requireClassroomPointsRead, requireClassroomPointsInstructor } = await import(
      "@/lib/classroom-points-request-auth"
    )

    let submissions;

    if (!studentId && forManage) {
      const scope = await requireClassroomPointsInstructor(request)
      if (!scope.ok) return scope.response

      const scoped = await resolveOptionalCourseScope(request);
      if (!scoped.ok) return scoped.response;
      const courseId = scoped.courseId;
      if (courseId == null) {
        return NextResponse.json({ submissions: [] });
      }
      const courseClause = sqlSubmissionCourseScope(courseId);
      const sessionClause =
        session != null && session !== ""
          ? sqlSubmissionSessionFilter(session)
          : sqlInstance``;

      submissions = await sqlInstance`
        SELECT 
          cps.id,
          cps.title,
          cps.description,
          cps.created_at,
          cps.created_by,
          cps.session,
          cps.duration_hours,
          cps.due_at,
          COALESCE(cps.submission_kind, 'code') as submission_kind,
          cps.question_config,
          CASE 
            WHEN cps.due_at IS NOT NULL THEN cps.due_at
            WHEN cps.duration_hours IS NULL THEN NULL
            ELSE (cps.created_at + ((cps.duration_hours + 72) * INTERVAL '1 hour'))
          END as expires_at,
          CASE 
            WHEN cps.due_at IS NOT NULL THEN cps.due_at > NOW()
            WHEN cps.duration_hours IS NULL THEN false
            WHEN (cps.created_at + ((cps.duration_hours + 72) * INTERVAL '1 hour')) > NOW() THEN true
            ELSE false
          END as is_active
        FROM classroom_point_submissions cps
        WHERE 1 = 1
          ${courseClause}
          ${sessionClause}
        ORDER BY cps.created_at DESC
      `;
      return NextResponse.json({ submissions });
    }

    const access = await requireClassroomPointsRead(request)
    if (!access.ok) return access.response

    if (access.role === "student") {
      return await loadStudentClassroomPointSubmissions({
        studentDbId: access.studentDbId,
        session,
      })
    }

    // Instructor (non-manage) catalog — keep existing session filter.
    // Get non-expired submissions using stored duration_hours (+ 72 hours / 3 days buffer)
    // Use custom duration_hours set by instructor (NULL means never expires). Add 3 days to all durations.
    if (session) {
      submissions = await sqlInstance`
        SELECT 
          id,
          title,
          description,
          created_at,
          created_by,
          session,
          duration_hours,
          due_at,
          COALESCE(submission_kind, 'code') as submission_kind,
          question_config,
          CASE 
            WHEN due_at IS NOT NULL THEN due_at
            WHEN duration_hours IS NULL THEN NULL
            ELSE (created_at + ((duration_hours + 72) * INTERVAL '1 hour'))
          END as expires_at,
          CASE 
            WHEN due_at IS NOT NULL THEN due_at > NOW()
            WHEN duration_hours IS NULL THEN false
            WHEN (created_at + ((duration_hours + 72) * INTERVAL '1 hour')) > NOW() THEN true
            ELSE false
          END as is_active
        FROM classroom_point_submissions
        WHERE (
          CASE
            WHEN due_at IS NOT NULL THEN due_at > NOW()
            WHEN duration_hours IS NULL THEN false
            ELSE (created_at + ((duration_hours + 72) * INTERVAL '1 hour')) > NOW()
          END
        )
          AND TRIM(session) = TRIM(${session})
        ORDER BY created_at DESC
      `;
    } else {
      submissions = await sqlInstance`
        SELECT 
          id,
          title,
          description,
          created_at,
          created_by,
          session,
          duration_hours,
          due_at,
          COALESCE(submission_kind, 'code') as submission_kind,
          question_config,
          CASE 
            WHEN due_at IS NOT NULL THEN due_at
            WHEN duration_hours IS NULL THEN NULL
            ELSE (created_at + ((duration_hours + 72) * INTERVAL '1 hour'))
          END as expires_at,
          CASE 
            WHEN due_at IS NOT NULL THEN due_at > NOW()
            WHEN duration_hours IS NULL THEN false
            WHEN (created_at + ((duration_hours + 72) * INTERVAL '1 hour')) > NOW() THEN true
            ELSE false
          END as is_active
        FROM classroom_point_submissions
        WHERE (
          CASE
            WHEN due_at IS NOT NULL THEN due_at > NOW()
            WHEN duration_hours IS NULL THEN false
            ELSE (created_at + ((duration_hours + 72) * INTERVAL '1 hour')) > NOW()
          END
        )
        ORDER BY created_at DESC
      `;
    }

    // If studentId is provided, check which submissions they've already attempted and their status
    if (studentId) {
      const numericStudentId = await resolveStudentDatabaseIdFromParam(studentId)
      if (numericStudentId == null) {
        return NextResponse.json({ submissions: [], missingSubmissions: submissions, pendingSubmissions: [] })
      }
      const studentSubmissions = await sqlInstance`
        SELECT DISTINCT 
          submission_id,
          status
        FROM classroom_points
        WHERE student_id = ${numericStudentId}
          AND submission_id IS NOT NULL
      `;
      
      const attemptedIds = new Set(studentSubmissions.map((a: any) => a.submission_id));
      const pendingIds = new Set(
        studentSubmissions
          .filter((a: any) => a.status === 'pending')
          .map((a: any) => a.submission_id)
      );

      const sessionFilter = session
        ? sqlInstance`AND TRIM(session) = TRIM(${session})`
        : sqlInstance``;

      const allAssignments = await sqlInstance`
        SELECT
          id,
          title,
          description,
          created_at,
          created_by,
          session,
          duration_hours,
          due_at,
          COALESCE(submission_kind, 'code') as submission_kind,
          question_config,
          CASE
            WHEN due_at IS NOT NULL THEN due_at
            WHEN duration_hours IS NULL THEN NULL
            ELSE (created_at + ((duration_hours + 72) * INTERVAL '1 hour'))
          END as expires_at,
          CASE
            WHEN due_at IS NOT NULL THEN due_at > NOW()
            WHEN duration_hours IS NULL THEN false
            WHEN (created_at + ((duration_hours + 72) * INTERVAL '1 hour')) > NOW() THEN true
            ELSE false
          END as is_active
        FROM classroom_point_submissions
        WHERE COALESCE(hidden_from_students, false) = false
          AND (
            CASE
              WHEN due_at IS NOT NULL THEN due_at > NOW()
              WHEN duration_hours IS NULL THEN false
              ELSE (created_at + ((duration_hours + 72) * INTERVAL '1 hour')) > NOW()
            END
          )
          ${sessionFilter}
        ORDER BY created_at DESC
      `;

      const missingSubmissions = allAssignments.filter((sub: any) => !attemptedIds.has(sub.id));
      const pendingSubmissions = allAssignments.filter((sub: any) => pendingIds.has(sub.id));

      let pendingFeedbackBySubmissionId: Record<
        number,
        {
          classroomPointId: number
          status: string
          points: number
          pointBooster: number
          instructorFeedback: string | null
        }
      > = {}

      if (pendingIds.size > 0) {
        try {
          await sqlInstance`ALTER TABLE classroom_points ADD COLUMN IF NOT EXISTS ai_feedback JSONB`
        } catch {
          /* ignore */
        }
        const pendingRows = await sqlInstance`
          SELECT id, submission_id, status, points, point_booster, reason, ai_feedback
          FROM classroom_points
          WHERE student_id = ${numericStudentId}
            AND status = 'pending'
            AND submission_id IS NOT NULL
        `
        for (const row of pendingRows as Array<{
          id: number
          submission_id: number
          status: string
          points: number | string
          point_booster: number | null
          reason: string | null
          ai_feedback: unknown
        }>) {
          pendingFeedbackBySubmissionId[row.submission_id] = {
            classroomPointId: row.id,
            status: row.status,
            points: Number(row.points) || 0,
            pointBooster: Math.max(1, Number(row.point_booster) || 1),
            instructorFeedback: resolveClassroomPointFeedbackText(row),
          }
        }
      }

      return NextResponse.json({
        submissions: submissions.map((sub: any) => ({
          ...sub,
          attempted: attemptedIds.has(sub.id),
          pending: pendingIds.has(sub.id)
        })),
        missingSubmissions,
        pendingSubmissions: pendingSubmissions.map((sub: any) => ({
          ...sub,
          classroomPoint: pendingFeedbackBySubmissionId[sub.id] ?? null,
        })),
        pendingFeedbackBySubmissionId,
      });
    }

    return NextResponse.json({ submissions });

  } catch (error) {
    console.error("[Classroom Points Submissions] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch submissions" },
      { status: 500 }
    );
  }
}

// POST - Create a new submission (instructor only)
export async function POST(request: NextRequest) {
  try {
    console.log("[Classroom Points Submissions] POST request received");

    const { requireClassroomPointsInstructor } = await import("@/lib/classroom-points-request-auth")
    const instructorScope = await requireClassroomPointsInstructor(request)
    if (!instructorScope.ok) return instructorScope.response
    const instructorId = instructorScope.instructorId

    const scoped = await resolveOptionalCourseScope(request);
    if (!scoped.ok) return scoped.response;
    const courseId = scoped.courseId;
    
    const requestBody = await request.json();
    console.log("[Classroom Points Submissions] Request body:", requestBody);
    
    const { title, description, session, durationHours, submissionKind, questionConfig, dueAt } = requestBody;
    let resolvedSession =
      typeof session === "string" && session.trim() && session.trim().toUpperCase() !== "ALL"
        ? session.trim()
        : null
    console.log("[Classroom Points Submissions] Extracted values:", { title, session: resolvedSession, instructorId });

    if (!title) {
      console.log("[Classroom Points Submissions] Validation failed: Missing required fields");
      console.log("[Classroom Points Submissions] Title:", title, "InstructorId:", instructorId);
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    if (courseId != null) {
      const requiresSession = await courseRequiresSubmissionSession(courseId)
      if (requiresSession && !resolvedSession) {
        resolvedSession = await resolveDefaultCourseSession(courseId)
      }
      if (requiresSession && !resolvedSession) {
        return NextResponse.json(
          { error: "Session is required when creating assignments for this course" },
          { status: 400 },
        );
      }
      if (resolvedSession) {
        const sessionOk = await sessionBelongsToCourse(resolvedSession, courseId);
        if (!sessionOk) {
          return NextResponse.json(
            { error: "Session does not belong to the selected course" },
            { status: 400 },
          );
        }
      }
    }

    // Check if table exists, if not return error with instructions
    console.log("[Classroom Points Submissions] Checking if table exists...");
    try {
      await sqlInstance`SELECT 1 FROM classroom_point_submissions LIMIT 1`;
      console.log("[Classroom Points Submissions] Table exists, proceeding with insert");
    } catch (tableError: any) {
      // Table doesn't exist yet
      if (tableError?.code === '42P01') {
        console.error("[Classroom Points Submissions] Table doesn't exist yet. Error code:", tableError.code);
        console.error("[Classroom Points Submissions] Error details:", tableError);
        return NextResponse.json(
          { 
            error: "Database table not found. Please run the migration script first.",
            details: "The classroom_point_submissions table needs to be created. Please run: scripts/create-classroom-point-submissions-table.sql"
          },
          { status: 503 }
        );
      }
      console.error("[Classroom Points Submissions] Table check error:", tableError);
      throw tableError;
    }

    // Create submission with configurable duration (NULL means never expires)
    // Only set duration_hours if instructor explicitly provided a value > 0
    const duration = durationHours && durationHours > 0 ? parseInt(durationHours.toString()) : null;
    let dueAtValue: Date | null = null;
    if (dueAt) {
      const parsed = new Date(String(dueAt));
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
      }
      dueAtValue = parsed;
    }
    const effectiveDuration = dueAtValue ? null : duration;
    console.log("[Classroom Points Submissions] Inserting submission into database...");
    console.log("[Classroom Points Submissions] Insert values:", {
      title,
      session: resolvedSession || null,
      instructorId,
      durationHours: effectiveDuration || dueAtValue?.toISOString() || "NULL (never expires)",
      createdAt: "NOW()"
    });

    const kind =
      String(submissionKind ?? "code").trim().toLowerCase() === "solution" ? "solution" : "code"
    const configJson =
      kind === "solution" && questionConfig != null
        ? JSON.stringify(questionConfig)
        : null

    try {
      await sqlInstance`ALTER TABLE classroom_point_submissions ADD COLUMN IF NOT EXISTS submission_kind TEXT NOT NULL DEFAULT 'code'`
      await sqlInstance`ALTER TABLE classroom_point_submissions ADD COLUMN IF NOT EXISTS question_config JSONB`
      await sqlInstance`ALTER TABLE classroom_point_submissions ADD COLUMN IF NOT EXISTS due_at TIMESTAMP`
    } catch {
      /* ignore */
    }

    const result = await sqlInstance`
      INSERT INTO classroom_point_submissions (
        title,
        description,
        session,
        created_by,
        created_at,
        duration_hours,
        due_at,
        submission_kind,
        question_config
      ) VALUES (
        ${title},
        ${description || null},
        ${resolvedSession || null},
        ${instructorId},
        NOW(),
        ${effectiveDuration},
        ${dueAtValue},
        ${kind},
        ${configJson}::jsonb
      )
      RETURNING *
    `;

    console.log("[Classroom Points Submissions] Insert successful. Result:", result);
    console.log("[Classroom Points Submissions] Created submission ID:", result[0]?.id);

    // Notify students in the session when a new code submission is posted (in-app + email)
    const sendNotifications = requestBody.sendNotifications !== false;
    if (sendNotifications) {
      const { sql } = await import("@/lib/db");
      let studentIds: { id: number }[] = [];
      if (resolvedSession) {
        const sessionRow =
          courseId != null
            ? await sql`
                SELECT id FROM sessions
                WHERE code = ${resolvedSession} AND course_id = ${courseId}
                LIMIT 1
              `
            : await sql`SELECT id FROM sessions WHERE code = ${resolvedSession} LIMIT 1`;
        if (sessionRow.length > 0) {
          studentIds = await sql`
            SELECT id FROM students WHERE session_id = ${sessionRow[0].id}
          `;
        }
      }
      if (studentIds.length === 0 && courseId == null) {
        studentIds = await sql`SELECT id FROM students`;
      }
      if (studentIds.length > 0) {
        createBulkNotifications(
          studentIds.map((s) => s.id),
          {
            type: kind === "solution" ? "code_submission" : "code_submission",
            title: kind === "solution" ? "New solution submission available! 📝" : "New code submission available! 📝",
            message:
              kind === "solution"
                ? `A new worked-solution assignment "${title}" has been posted. Submit your solution to earn classroom points!`
                : `A new code submission "${title}" has been posted. Submit your code to earn classroom points!`,
            link: "/student/dashboard-v2/classroom-points",
          },
        ).catch((err) => console.error("[Classroom Points] Failed to send notifications:", err));
        sendNewAssessmentEmailsIfConfigured(
          studentIds.map((s) => s.id),
          kind === "solution" ? "solution submission" : "code submission",
          title,
          null
        );
      }
    }

    return NextResponse.json({
      success: true,
      submission: result[0]
    });

  } catch (error: any) {
    console.error("[Classroom Points Submissions] Error creating submission:", error);
    console.error("[Classroom Points Submissions] Error code:", error?.code);
    console.error("[Classroom Points Submissions] Error message:", error?.message);
    console.error("[Classroom Points Submissions] Error stack:", error?.stack);
    console.error("[Classroom Points Submissions] Full error object:", JSON.stringify(error, null, 2));
    
    return NextResponse.json(
      { 
        error: "Failed to create submission",
        details: error?.message || "Unknown error occurred",
        code: error?.code
      },
      { status: 500 }
    );
  }
}
