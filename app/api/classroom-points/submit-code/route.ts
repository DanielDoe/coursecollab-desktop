import { NextRequest, NextResponse } from "next/server";
import { getSQL, sql } from "@/lib/db";
import { autoEvaluateClassroomCodeSubmission } from "@/lib/classroom-points-auto-evaluate";
import { getRewardsPolicyForStudent } from "@/lib/rewards-policy.server";
import {
  CLASSROOM_BASE_POINTS,
  classroomPointsFromAiScorePercent,
  getTimingBoosterAt,
  resolveClassroomSubmissionBooster,
  timingBoosterLabel,
} from "@/lib/classroom-point-booster";
import { ensureClassroomPointsSchema } from "@/lib/ensure-classroom-points-schema";
import { classroomAssignmentSessionMatchesStudent } from "@/lib/classroom-submission-scope";
import { resolveStudentCourseContextByDbId } from "@/lib/student-course-scope";
import { resolveClassroomAwardInstructorId } from "@/lib/classroom-points-award-instructor";

const sqlInstance = getSQL();

const BASE_POINTS = CLASSROOM_BASE_POINTS;

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

/**
 * POST - Submit code for classroom points grading
 * Creates a pending classroom point entry that instructors can review
 */
export async function POST(request: NextRequest) {
  try {
    await ensureClassroomPointsSchema();
    console.log("[Classroom Points Submit] Starting submission...");
    const { requireClassroomPointsStudent } = await import("@/lib/classroom-points-request-auth")
    const { code, studentId, description, submissionId, plotImage } = await request.json();
    const studentAuth = await requireClassroomPointsStudent(request, studentId)
    if (!studentAuth.ok) return studentAuth.response
    console.log("[Classroom Points Submit] Received data:", { 
      studentId, 
      codeLength: code?.length, 
      hasDescription: !!description,
      submissionId,
      hasPlotImage: typeof plotImage === "string" && plotImage.length > 0,
    });

    if (typeof plotImage === "string" && plotImage.length > 12_000_000) {
      return NextResponse.json(
        { error: "Plot image is too large. Use a smaller image or screenshot (max ~5MB)." },
        { status: 400 }
      );
    }

    if (!code || !studentId || !submissionId) {
      console.log("[Classroom Points Submit] Missing required fields:", { 
        hasCode: !!code, 
        hasStudentId: !!studentId, 
        hasSubmissionId: !!submissionId 
      });
      return NextResponse.json(
        { error: "Code, studentId, and submissionId are required" },
        { status: 400 }
      );
    }

    // Check if submission exists and is not expired (uses custom duration_hours set by instructor)
    let submissionCheck;
    try {
      // Include deadline for point booster. Ensure due_at column exists (migration may not have run)
      try {
        await sqlInstance`ALTER TABLE classroom_point_submissions ADD COLUMN IF NOT EXISTS due_at TIMESTAMP`;
        await sqlInstance`ALTER TABLE classroom_point_submissions ADD COLUMN IF NOT EXISTS hidden_from_students BOOLEAN NOT NULL DEFAULT false`;
      } catch (_) {}
      submissionCheck = await sqlInstance`
        SELECT id, title, description, created_at, created_by, session, duration_hours, due_at,
               CASE 
                 WHEN due_at IS NOT NULL THEN due_at
                 WHEN duration_hours IS NULL THEN NULL
                 ELSE (created_at + ((duration_hours + 72) * INTERVAL '1 hour'))
               END as expiry_time,
               COALESCE(due_at, created_at + ((COALESCE(duration_hours, 168)) * INTERVAL '1 hour')) as deadline
        FROM classroom_point_submissions
        WHERE id = ${parseInt(submissionId)}
          AND COALESCE(hidden_from_students, false) = false
          AND (
            CASE
              WHEN due_at IS NOT NULL THEN due_at > NOW()
              WHEN duration_hours IS NULL THEN false
              ELSE (created_at + ((duration_hours + 72) * INTERVAL '1 hour')) > NOW()
            END
          )
      `;
      console.log("[Classroom Points Submit] Submission check result:", submissionCheck.length, "found");
    } catch (sqlError: any) {
      console.error("[Classroom Points Submit] SQL error checking submission:", sqlError.message);
      return NextResponse.json(
        { error: `Database error: ${sqlError.message || "Failed to check submission"}` },
        { status: 500 }
      );
    }

    if (submissionCheck.length === 0) {
      // Check if submission exists but expired (only if duration_hours was set)
      let expiredCheck;
      try {
        expiredCheck = await sqlInstance`
          SELECT id, title, created_at, NOW() as current_time,
                 duration_hours, due_at,
                 CASE 
                   WHEN due_at IS NOT NULL THEN due_at
                   WHEN duration_hours IS NULL THEN NULL
                   ELSE (created_at + ((duration_hours + 72) * INTERVAL '1 hour'))
                 END as expiry_time
          FROM classroom_point_submissions
          WHERE id = ${parseInt(submissionId)}
        `;
      } catch (sqlError: any) {
        console.error("[Classroom Points Submit] SQL error checking expired submission:", sqlError.message);
        return NextResponse.json(
          { error: `Database error: ${sqlError.message || "Failed to check submission"}` },
          { status: 500 }
        );
      }
      
      if (expiredCheck.length > 0) {
        const row = expiredCheck[0] as {
          title: string
          duration_hours: number | null
          due_at?: string | Date | null
          expiry_time?: string | Date | null
        }
        const expiredAt = row.due_at ?? row.expiry_time
        if (expiredAt && new Date(expiredAt) < new Date()) {
          console.log("[Classroom Points Submit] Submission found but expired:", {
            due_at: row.due_at,
            expiry_time: row.expiry_time,
          });
          return NextResponse.json(
            { error: `Assignment "${row.title}" has expired. The due date has passed.` },
            { status: 400 }
          );
        }
        console.log("[Classroom Points Submit] Submission exists but check failed for unknown reason");
        return NextResponse.json(
          { error: `Assignment with ID ${submissionId} not found or unavailable` },
          { status: 400 }
        );
      } else {
        console.log("[Classroom Points Submit] Submission not found at all");
        return NextResponse.json(
          { error: `Assignment with ID ${submissionId} not found` },
          { status: 400 }
        );
      }
    }

    const submission = submissionCheck[0];

    // Point booster: within 24hrs of deadline = x3, within 48hrs = x2 (uses original due when extended)
    const timingBooster = resolveClassroomSubmissionBooster({
      submissionId: parseInt(String(submissionId), 10),
      openedAt: submission.created_at,
      deadline: submission.deadline,
      submittedAt: new Date(),
    });
    const finalPoints = parseFloat((BASE_POINTS * timingBooster).toFixed(2));

    // Resolve student FIRST - studentId can be numeric (students.id) or string (students.student_id like "DEMO001")
    // CRITICAL: Duplicate check must use numeric students.id; parseInt(studentId) fails for string IDs
    console.log("[Classroom Points Submit] Looking up student with ID:", studentId);
    let studentInfo;
    const numericId = parseInt(studentId);
    if (!isNaN(numericId) && numericId.toString() === studentId.toString()) {
      // It's a numeric ID
      console.log("[Classroom Points Submit] Using numeric ID lookup:", numericId);
      studentInfo = await sqlInstance`
        SELECT id, section FROM students WHERE id = ${numericId}
      `;
    } else {
      // It's a student_id string (like "DEMO001")
      console.log("[Classroom Points Submit] Using string student_id lookup:", studentId);
      studentInfo = await sqlInstance`
        SELECT id, section FROM students WHERE student_id = ${studentId}
      `;
    }
    
    console.log("[Classroom Points Submit] Student lookup result:", studentInfo.length, "records found");
    if (studentInfo.length === 0) {
      console.log("[Classroom Points Submit] Student not found");
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    const student = studentInfo[0];
    console.log("[Classroom Points Submit] Found student:", { id: student.id, section: student.section });

    const studentCtx = await resolveStudentCourseContextByDbId(Number(student.id))
    const enrolledSession = studentCtx?.sessionCode || student.section
    if (!classroomAssignmentSessionMatchesStudent(submission.session, enrolledSession)) {
      return NextResponse.json(
        { error: "This assignment is not available for your section." },
        { status: 403 },
      )
    }

    const rewardsPolicy = await getRewardsPolicyForStudent(Number(student.id))
    if (!rewardsPolicy.allow_student_submissions) {
      return NextResponse.json(
        { error: "Student submissions are disabled for this course. Contact your instructor." },
        { status: 403 },
      )
    }

    // Check if student has already submitted for this assignment (1 attempt per assignment)
    // Use student.id (numeric) - never parseInt(studentId) which fails for string IDs like "DEMO001"
    let existingSubmission;
    try {
      existingSubmission = await sqlInstance`
        SELECT id, status, points, submission_id
        FROM classroom_points
        WHERE student_id = ${student.id}
          AND submission_id = ${parseInt(submissionId)}
          AND category = 'code_submission'
      `;
      if (existingSubmission.length === 0) {
        const reasonText = submission.title || "Code Submission for Grading";
        const reasonCheck = await sqlInstance`
          SELECT id, status, points, submission_id, reason
          FROM classroom_points
          WHERE student_id = ${student.id}
            AND category = 'code_submission'
            AND reason = ${reasonText}
            AND created_at > NOW() - INTERVAL '1 hour'
          ORDER BY created_at DESC
          LIMIT 1
        `;
        if (reasonCheck.length > 0) {
          console.log("[Classroom Points Submit] Found duplicate by reason (submission_id may be NULL):", reasonCheck[0]);
          existingSubmission = reasonCheck;
        }
      }
    } catch (sqlError: any) {
      if (sqlError.message?.includes('submission_id') || sqlError.code === '42703') {
        const reasonText = submission.title || "Code Submission for Grading";
        existingSubmission = await sqlInstance`
          SELECT id, status, points, reason
          FROM classroom_points
          WHERE student_id = ${student.id}
            AND category = 'code_submission'
            AND reason = ${reasonText}
            AND created_at > NOW() - INTERVAL '1 hour'
          ORDER BY created_at DESC
          LIMIT 1
        `;
      } else {
        console.error("[Classroom Points Submit] SQL error checking existing:", sqlError.message);
        return NextResponse.json(
          { error: `Database error: ${sqlError.message || "Failed to check existing submission"}` },
          { status: 500 }
        );
      }
    }

    if (existingSubmission.length > 0) {
      const status = existingSubmission[0].status || 'pending';
      return NextResponse.json(
        { error: `You have already submitted code for this assignment. Status: ${status}` },
        { status: 400 }
      );
    }

    const instructorId = await resolveClassroomAwardInstructorId({
      studentDbId: Number(student.id),
      assignmentCreatedBy: Number((submission as { created_by?: number | null }).created_by) || null,
    })

    // Create reason text using submission title
    const reasonText = submission.title || description || "Code Submission for Grading";
    const truncatedReason = reasonText.length > 500 
      ? `${reasonText.substring(0, 497)}...`
      : reasonText;

    // Create pending classroom point entry with point booster applied
    console.log("[Classroom Points Submit] Creating classroom point entry...", { timingBooster, finalPoints });

    // Ensure point_booster column exists
    try {
      await sqlInstance`ALTER TABLE classroom_points ADD COLUMN IF NOT EXISTS point_booster INTEGER DEFAULT 1`;
      await sqlInstance`ALTER TABLE classroom_points ADD COLUMN IF NOT EXISTS submitted_via_codebench BOOLEAN DEFAULT false`;
    } catch (_) {}

    // Try inserting with all columns, fallback if columns don't exist
    let pointResult;
    let insertAttempts = [
      // Attempt 1: With status, submission_id, and point_booster
      {
        sql: sqlInstance`
          INSERT INTO classroom_points (
            student_id,
            points,
            reason,
            category,
            awarded_by,
            session,
            status,
            submission_id,
            point_booster,
            submitted_via_codebench
          ) VALUES (
            ${student.id},
            ${finalPoints},
            ${truncatedReason},
            'code_submission',
            ${instructorId},
            ${student.section},
            'pending',
            ${parseInt(submissionId)},
            ${timingBooster},
            false
          )
          RETURNING *
        `,
        name: "with status, submission_id, point_booster"
      },
      // Attempt 2: With status and submission_id (no point_booster columns)
      {
        sql: sqlInstance`
          INSERT INTO classroom_points (
            student_id,
            points,
            reason,
            category,
            awarded_by,
            session,
            status,
            submission_id
          ) VALUES (
            ${student.id},
            ${finalPoints},
            ${truncatedReason},
            'code_submission',
            ${instructorId},
            ${student.section},
            'pending',
            ${parseInt(submissionId)}
          )
          RETURNING *
        `,
        name: "with status and submission_id"
      },
      // Attempt 3: Without status and submission_id (original schema)
      {
        sql: sqlInstance`
          INSERT INTO classroom_points (
            student_id,
            points,
            reason,
            category,
            awarded_by,
            session
          ) VALUES (
            ${student.id},
            ${finalPoints},
            ${truncatedReason},
            'code_submission',
            ${instructorId},
            ${student.section}
          )
          RETURNING *
        `,
        name: "without status and submission_id"
      }
    ];

    let insertSuccess = false;
    for (const attempt of insertAttempts) {
      try {
        pointResult = await attempt.sql;
        console.log(`[Classroom Points Submit] Created classroom point ${attempt.name}`);
        insertSuccess = true;
        break;
      } catch (insertError: any) {
        // Check if it's a unique constraint violation (duplicate submission)
        if (insertError.code === '23505' || insertError.message?.includes('unique') || insertError.message?.includes('duplicate')) {
          console.log(`[Classroom Points Submit] Duplicate submission detected (unique constraint violation)`);
          // Double-check if submission exists
          const duplicateCheck = await sqlInstance`
            SELECT id, status, points
            FROM classroom_points
            WHERE student_id = ${parseInt(studentId)}
              AND submission_id = ${parseInt(submissionId)}
              AND category = 'code_submission'
            LIMIT 1
          `;
          if (duplicateCheck.length > 0) {
            const status = duplicateCheck[0].status || 'pending';
            return NextResponse.json(
              { error: `You have already submitted code for this assignment. Status: ${status}` },
              { status: 400 }
            );
          }
          // If not found, it might be a race condition - return generic error
          return NextResponse.json(
            { error: `Duplicate submission detected. Please refresh and try again.` },
            { status: 400 }
          );
        }
        // Check if it's a column error
        if (insertError.message?.includes('column') || insertError.code === '42703') {
          console.log(`[Classroom Points Submit] ${attempt.name} failed (column missing), trying next...`);
          continue;
        } else {
          // Other error - log and fail
          console.error(`[Classroom Points Submit] Failed to create classroom point (${attempt.name}):`, insertError.message);
          return NextResponse.json(
            { error: `Failed to create classroom point entry: ${insertError.message}` },
            { status: 500 }
          );
        }
      }
    }

    if (!insertSuccess) {
      console.error("[Classroom Points Submit] All insert attempts failed");
      return NextResponse.json(
        { error: "Failed to create classroom point entry. Please contact support." },
        { status: 500 }
      );
    }
    
    const classroomPointId = pointResult[0]?.id;
    console.log("[Classroom Points Submit] Created classroom point:", classroomPointId);

    const plotImageStored =
      typeof plotImage === "string" && plotImage.trim().length > 0 ? plotImage.trim() : null;

    try {
      await sqlInstance`ALTER TABLE codebench_submissions ADD COLUMN IF NOT EXISTS plot_image TEXT`;
    } catch (_) {}

    // Store code submission in existing codebench_submissions table
    // Note: Using existing table from codebench - no table creation needed
    // IMPORTANT: Use numeric student.id (not student_id string) to avoid trigger errors
    // The trigger expects INTEGER, so we need to ensure we're inserting INTEGER
    console.log("[Classroom Points Submit] Storing code submission with student.id:", student.id, "type:", typeof student.id);
    
    // CRITICAL: Temporarily disable trigger to prevent student_id type conversion errors
    // The trigger update_student_learning_profile expects INTEGER but may receive string "DEMO001"
    // This can happen if there's data inconsistency in the codebench_submissions table
    let triggerDisabled = false;
    try {
      await sqlInstance`ALTER TABLE codebench_submissions DISABLE TRIGGER trigger_update_profile_after_codebench`;
      triggerDisabled = true;
      console.log("[Classroom Points Submit] Trigger disabled successfully");
    } catch (triggerError: any) {
      // If disabling trigger fails (e.g., in serverless DB), log but continue
      console.warn("[Classroom Points Submit] Could not disable trigger (may not be supported):", triggerError.message);
    }
    
    try {
      await sqlInstance`
        INSERT INTO codebench_submissions (
          student_id,
          assignment_id,
          code,
          classroom_point_id,
          status,
          submitted_at,
          plot_image
        ) VALUES (
          ${student.id}::INTEGER,
          NULL,
          ${code},
          ${classroomPointId},
          'pending',
          NOW(),
          ${plotImageStored}
        )
        ON CONFLICT (student_id, assignment_id) 
        DO UPDATE SET 
          code = ${code},
          classroom_point_id = ${classroomPointId},
          plot_image = ${plotImageStored},
          submitted_at = NOW()
      `;
      console.log("[Classroom Points Submit] Code submission stored successfully");
    } catch (error: any) {
      console.error("[Classroom Points Submit] Error storing code submission:", error.message);
      console.error("[Classroom Points Submit] Full error:", error);

      if (error.message?.includes("plot_image")) {
        try {
          await sqlInstance`
            INSERT INTO codebench_submissions (
              student_id,
              assignment_id,
              code,
              classroom_point_id,
              status,
              submitted_at
            ) VALUES (
              ${student.id}::INTEGER,
              NULL,
              ${code},
              ${classroomPointId},
              'pending',
              NOW()
            )
            ON CONFLICT (student_id, assignment_id) 
            DO UPDATE SET 
              code = ${code},
              classroom_point_id = ${classroomPointId},
              submitted_at = NOW()
          `;
          console.log("[Classroom Points Submit] Code submission stored (without plot_image column)");
        } catch (retry2: any) {
          console.error("[Classroom Points Submit] Retry without plot_image failed:", retry2.message);
        }
      }
      
      // If classroom_point_id column doesn't exist, try without it
      else if (error.message?.includes('classroom_point_id')) {
        console.log("[Classroom Points Submit] Retrying without classroom_point_id column...");
        try {
          await sqlInstance`
            INSERT INTO codebench_submissions (
              student_id,
              assignment_id,
              code,
              status,
              submitted_at
            ) VALUES (
              ${student.id}::INTEGER,
              NULL,
              ${code},
              'pending',
              NOW()
            )
            ON CONFLICT (student_id, assignment_id) 
            DO UPDATE SET 
              code = ${code},
              submitted_at = NOW()
          `;
          console.log("[Classroom Points Submit] Code submission stored (without classroom_point_id)");
        } catch (retryError: any) {
          console.error("[Classroom Points Submit] Retry also failed:", retryError.message);
          // Don't throw - the main submission succeeded
        }
      } else {
        // For other errors, log but don't fail the request
        // The classroom_point entry is the important one
        console.warn("[Classroom Points Submit] Codebench submission failed (non-critical):", error.message);
        console.warn("[Classroom Points Submit] Classroom point entry was created successfully:", classroomPointId);
      }
    } finally {
      // CRITICAL: Re-enable trigger after insert completes
      if (triggerDisabled) {
        try {
          await sqlInstance`ALTER TABLE codebench_submissions ENABLE TRIGGER trigger_update_profile_after_codebench`;
          console.log("[Classroom Points Submit] Trigger re-enabled successfully");
        } catch (triggerError: any) {
          // If re-enabling fails, log but don't fail the request
          console.warn("[Classroom Points Submit] Could not re-enable trigger (non-critical):", triggerError.message);
        }
      }
    }

    console.log("[Classroom Points Submit] ✅ Submission successful!");

    let aiResult: Awaited<ReturnType<typeof autoEvaluateClassroomCodeSubmission>> | null = null
    try {
      aiResult = await autoEvaluateClassroomCodeSubmission({
        classroomPointId: Number(classroomPointId),
        studentDbId: Number(student.id),
        timingBooster,
        baseReason: truncatedReason,
        code,
        assignmentTitle: submission.title || truncatedReason,
        assignmentDescription: (submission as { description?: string | null }).description ?? null,
        plotImage: plotImageStored,
      })
    } catch (aiError) {
      console.error("[Classroom Points Submit] AI auto-evaluate failed (non-blocking):", aiError)
    }

    return NextResponse.json({
      success: true,
      message: aiResult?.autoApproved
        ? "Code evaluated — points awarded!"
        : aiResult?.aiGraded
          ? "Code submitted — AI feedback recorded. Awaiting review if not auto-approved."
          : "Code submitted successfully for grading",
      classroomPointId,
      status: aiResult?.status ?? "pending",
      pointBooster: timingBooster,
      pointsAwarded: aiResult?.pointsAwarded ?? finalPoints,
      boosterLabel: timingBoosterLabel(timingBooster),
      aiGraded: aiResult?.aiGraded ?? false,
      autoApproved: aiResult?.autoApproved ?? false,
      instructorFeedback: aiResult?.instructorFeedback ?? null,
      aiFeedback: aiResult?.aiFeedback ?? null,
      requiresManualReview: aiResult?.requiresManualReview ?? true,
    });

  } catch (error) {
    console.error("[Classroom Points Submit] ❌ Error:", error);
    console.error("[Classroom Points Submit] Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit code" },
      { status: 500 }
    );
  }
}
