import { NextRequest, NextResponse } from "next/server";
import { getSQL } from "@/lib/db";
import { redactClassroomPointsStudentSubmission } from "@/lib/classroom-points-student-question-config";
import { resolveOptionalCourseScope } from "@/lib/optional-instructor-course-scope";
import {
  classroomAssignmentSessionMatchesStudent,
  sessionBelongsToCourse,
  submissionBelongsToCourse,
} from "@/lib/classroom-submission-scope";
import { resolveStudentCourseContextByDbId } from "@/lib/student-course-scope";
import { ensureClassroomSubmissionHiddenColumn } from "@/lib/ensure-classroom-submission-hidden";

const sqlInstance = getSQL();

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function requireInstructor(request: NextRequest) {
  const { requireClassroomPointsInstructor } = await import("@/lib/classroom-points-request-auth")
  return requireClassroomPointsInstructor(request)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { requireClassroomPointsRead } = await import("@/lib/classroom-points-request-auth")
    const access = await requireClassroomPointsRead(request)
    if (!access.ok) return access.response

    try {
      await ensureClassroomSubmissionHiddenColumn(sqlInstance)
    } catch {
      /* ignore */
    }

    const { id } = await params
    const submissionId = parseInt(id, 10)
    if (Number.isNaN(submissionId)) {
      return NextResponse.json({ error: "Invalid submission id" }, { status: 400 })
    }

    const rows = await sqlInstance`
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
        COALESCE(cps.hidden_from_students, false) as hidden_from_students,
        cps.question_config
      FROM classroom_point_submissions cps
      WHERE cps.id = ${submissionId}
      LIMIT 1
    `
    if (rows.length === 0) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 })
    }

    if (access.role === "instructor") {
      const scoped = await resolveOptionalCourseScope(request)
      if (!scoped.ok) return scoped.response
      if (scoped.courseId != null) {
        const inCourse = await submissionBelongsToCourse(submissionId, scoped.courseId)
        if (!inCourse) {
          return NextResponse.json({ error: "Submission not found" }, { status: 404 })
        }
      }
      return NextResponse.json({ submission: rows[0] })
    }

    const ctx = await resolveStudentCourseContextByDbId(access.studentDbId)
    if (ctx?.courseId == null) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 })
    }
    const inCourse = await submissionBelongsToCourse(submissionId, ctx.courseId)
    const inSection = classroomAssignmentSessionMatchesStudent(rows[0].session, ctx.sessionCode)
    if (!inCourse || !inSection || rows[0].hidden_from_students === true) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 })
    }

    return NextResponse.json({
      submission: redactClassroomPointsStudentSubmission(rows[0]),
    })
  } catch (error: any) {
    console.error("[Classroom Points Submissions] GET by id failed:", error)
    return NextResponse.json({ error: "Failed to fetch submission" }, { status: 500 })
  }
}

// PUT — Update title/metadata and optionally restart availability (created_at) for reuse across terms.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireInstructor(request)
    if (!scope.ok) return scope.response

    const { id } = await params;
    const submissionId = parseInt(id, 10);
    if (Number.isNaN(submissionId)) {
      return NextResponse.json({ error: "Invalid submission id" }, { status: 400 });
    }

    const body = await request.json();
    const {
      title,
      description,
      session,
      durationHours,
      restartAvailability,
      submissionKind,
      questionConfig,
      dueAt,
      hiddenFromStudents,
    } = body as {
      title?: string;
      description?: string | null;
      session?: string | null;
      durationHours?: number | null;
      restartAvailability?: boolean;
      submissionKind?: string;
      questionConfig?: unknown;
      dueAt?: string | null;
      hiddenFromStudents?: boolean;
    };

    const existing = await sqlInstance`
      SELECT * FROM classroom_point_submissions WHERE id = ${submissionId} LIMIT 1
    `;

    if (existing.length === 0) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    const scoped = await resolveOptionalCourseScope(request);
    if (!scoped.ok) return scoped.response;
    if (scoped.courseId != null) {
      const inCourse = await submissionBelongsToCourse(submissionId, scoped.courseId);
      if (!inCourse) {
        return NextResponse.json({ error: "Submission not found" }, { status: 404 });
      }
    }

    const row = existing[0] as {
      title: string;
      description: string | null;
      session: string | null;
      duration_hours: number | null;
      due_at?: Date | string | null;
      submission_kind?: string | null;
      question_config?: unknown;
      hidden_from_students?: boolean;
    };
    const nextHidden =
      hiddenFromStudents === undefined
        ? Boolean(row.hidden_from_students)
        : hiddenFromStudents === true;

    const nextTitle =
      typeof title === "string" && title.trim().length > 0 ? title.trim() : row.title;

    let nextDescription = row.description;
    if (description !== undefined) {
      nextDescription =
        description === null || description === "" ? null : String(description);
    }

    let nextSession = row.session;
    if (session !== undefined) {
      nextSession = session === "" || session === null ? null : String(session);
    }

    if (scoped.courseId != null && nextSession) {
      const sessionOk = await sessionBelongsToCourse(nextSession, scoped.courseId);
      if (!sessionOk) {
        return NextResponse.json(
          { error: "Session does not belong to the selected course" },
          { status: 400 },
        );
      }
    }

    let nextDuration = row.duration_hours;
    if (durationHours !== undefined) {
      const n = Number(durationHours);
      nextDuration =
        durationHours === null || !Number.isFinite(n) || n <= 0
          ? null
          : Math.floor(n);
    }

    let nextDueAt: Date | null =
      row.due_at != null ? new Date(row.due_at) : null;
    if (dueAt !== undefined) {
      if (dueAt === null || dueAt === "") {
        nextDueAt = null;
      } else {
        const parsed = new Date(String(dueAt));
        if (Number.isNaN(parsed.getTime())) {
          return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
        }
        nextDueAt = parsed;
        nextDuration = null;
      }
    }

    const restart = Boolean(restartAvailability);

    let nextKind = row.submission_kind ?? "code";
    if (submissionKind !== undefined) {
      nextKind =
        String(submissionKind).trim().toLowerCase() === "solution" ? "solution" : "code";
    }

    let nextQuestionConfig: string | null =
      row.question_config != null ? JSON.stringify(row.question_config) : null;
    if (questionConfig !== undefined) {
      if (nextKind === "solution" && questionConfig != null) {
        nextQuestionConfig = JSON.stringify(questionConfig);
      } else if (nextKind === "code") {
        nextQuestionConfig = null;
      }
    }

    try {
      await sqlInstance`ALTER TABLE classroom_point_submissions ADD COLUMN IF NOT EXISTS submission_kind TEXT NOT NULL DEFAULT 'code'`
      await sqlInstance`ALTER TABLE classroom_point_submissions ADD COLUMN IF NOT EXISTS question_config JSONB`
      await sqlInstance`ALTER TABLE classroom_point_submissions ADD COLUMN IF NOT EXISTS due_at TIMESTAMP`
      await ensureClassroomSubmissionHiddenColumn(sqlInstance)
    } catch {
      /* ignore */
    }

    console.log("[Classroom Points Submissions] Updating submission:", submissionId, {
      restartAvailability: restart,
    });

    let result;
    if (restart) {
      result = await sqlInstance`
        UPDATE classroom_point_submissions
        SET
          title = ${nextTitle},
          description = ${nextDescription},
          session = ${nextSession},
          duration_hours = ${nextDuration},
          due_at = ${nextDueAt},
          submission_kind = ${nextKind},
          question_config = ${nextQuestionConfig}::jsonb,
          hidden_from_students = ${nextHidden},
          created_at = NOW()
        WHERE id = ${submissionId}
        RETURNING *
      `;
    } else {
      result = await sqlInstance`
        UPDATE classroom_point_submissions
        SET
          title = ${nextTitle},
          description = ${nextDescription},
          session = ${nextSession},
          duration_hours = ${nextDuration},
          due_at = ${nextDueAt},
          submission_kind = ${nextKind},
          question_config = ${nextQuestionConfig}::jsonb,
          hidden_from_students = ${nextHidden}
        WHERE id = ${submissionId}
        RETURNING *
      `;
    }

    if (nextTitle !== row.title) {
      await sqlInstance`
        UPDATE classroom_points
        SET reason = ${nextTitle}
        WHERE submission_id = ${submissionId}
      `;
    }

    console.log("[Classroom Points Submissions] Update successful");

    return NextResponse.json({
      success: true,
      submission: result[0],
    });

  } catch (error: any) {
    console.error("[Classroom Points Submissions] Error updating submission:", error);
    return NextResponse.json(
      { 
        error: "Failed to update submission",
        details: error?.message || "Unknown error occurred"
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete a submission and revoke associated points
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireInstructor(request)
    if (!scope.ok) return scope.response

    const { id } = await params;
    const submissionId = parseInt(id);

    console.log("[Classroom Points Submissions] Deleting submission:", submissionId);

    const scoped = await resolveOptionalCourseScope(request);
    if (!scoped.ok) return scoped.response;
    if (scoped.courseId != null) {
      const inCourse = await submissionBelongsToCourse(submissionId, scoped.courseId);
      if (!inCourse) {
        return NextResponse.json({ error: "Submission not found" }, { status: 404 });
      }
    }

    // First, get count of points that will be revoked
    const pointsToRevoke = await sqlInstance`
      SELECT COUNT(*) as count, COALESCE(SUM(points), 0) as total_points
      FROM classroom_points
      WHERE submission_id = ${submissionId}
    `;

    const count = parseInt(pointsToRevoke[0]?.count || 0);
    const totalPoints = parseFloat(pointsToRevoke[0]?.total_points || 0);

    console.log("[Classroom Points Submissions] Points to revoke:", { count, totalPoints });

    // Delete all classroom_points associated with this submission
    await sqlInstance`
      DELETE FROM classroom_points
      WHERE submission_id = ${submissionId}
    `;

    // Delete the submission itself
    const result = await sqlInstance`
      DELETE FROM classroom_point_submissions
      WHERE id = ${submissionId}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    console.log("[Classroom Points Submissions] Deletion successful");

    return NextResponse.json({
      success: true,
      message: `Submission deleted. ${count} submission(s) and ${totalPoints} points revoked.`,
      revokedCount: count,
      revokedPoints: totalPoints
    });

  } catch (error: any) {
    console.error("[Classroom Points Submissions] Error deleting submission:", error);
    return NextResponse.json(
      { 
        error: "Failed to delete submission",
        details: error?.message || "Unknown error occurred"
      },
      { status: 500 }
    );
  }
}
