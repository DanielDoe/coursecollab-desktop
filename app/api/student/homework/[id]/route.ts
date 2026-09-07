import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { canRetakeAssessment, getCompletedAttemptCount, getEffectiveRetakeLimit } from "@/lib/retake-utils";
import { NOW_UTC } from "@/lib/central-time";
import { resolveStudentDatabaseIdFromParam } from "@/lib/resolve-student-db-id";
import { hasDeadlineExtensionForStudentQuiz } from "@/lib/deadline-extension";
import { bypassesAssessmentAvailabilityWindows, isBetaUser } from "@/lib/membership";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const homeworkId = resolvedParams.id;
    const { searchParams } = new URL(request.url);
    const session = searchParams.get("session");
    const studentId = searchParams.get("studentId");
    const studentDatabaseIdParam = searchParams.get("studentDatabaseId");

    if (!session) {
      return NextResponse.json({ error: "Session parameter is required" }, { status: 400 });
    }

    if (!studentId && !studentDatabaseIdParam) {
      return NextResponse.json({ error: "Student ID or Database ID parameter is required" }, { status: 401 });
    }

    const rawStudent = (studentDatabaseIdParam ?? studentId ?? "").trim();
    const resolvedStudentId = await resolveStudentDatabaseIdFromParam(rawStudent);
    if (resolvedStudentId == null) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }
    const internalStudentId = resolvedStudentId;

    // Get student session info (use internal id for lookup)
    const studentSession = await sql`
      SELECT 
        s.id, 
        s.section, 
        COALESCE(sess.id, (SELECT id FROM sessions WHERE code = s.section LIMIT 1)) as session_id, 
        COALESCE(sess.code, s.section) as session_code
      FROM students s
      LEFT JOIN sessions sess ON s.session_id = sess.id
      WHERE s.id = ${internalStudentId}
      LIMIT 1
    `;

    if (studentSession.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const studentSessionData = studentSession[0];
    if (!studentSessionData.session_id) {
      return NextResponse.json({ error: "Student session not found" }, { status: 404 });
    }

    const scheduleBypass = await bypassesAssessmentAvailabilityWindows(internalStudentId);

    // Fetch specific homework with session access check
    // Note: quizzes table has no is_active column; derive from session + dates
    const homework = await sql`
      SELECT 
        q.id,
        q.restrict_access_to_students,
        q.allowed_student_ids,
        q.title,
        q.description,
        q.time_per_question,
        q.available_from,
        q.available_until,
        q.retake_limit,
        q.created_at,
        q.updated_at,
        (qsa.is_active = true AND (${scheduleBypass} = true OR (q.available_from IS NULL OR q.available_from <= ${NOW_UTC()})) AND (${scheduleBypass} = true OR (q.available_until IS NULL OR q.available_until >= ${NOW_UTC()}))) as is_active,
        q.retake_enabled,
        q.review_before_retake,
        q.retake_policy,
        COALESCE(q.rollover_enabled, false) as rollover_enabled,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM quiz_attempts qa 
            WHERE qa.quiz_id = q.id 
            AND qa.student_id = ${internalStudentId} 
            AND qa.completed_at IS NOT NULL
            AND qa.deleted_at IS NULL
          ) THEN 'completed'
          WHEN ${scheduleBypass} = false AND q.available_until IS NOT NULL AND q.available_until <= ${NOW_UTC()} THEN 'overdue'
          WHEN ${scheduleBypass} = false AND q.available_from IS NOT NULL AND q.available_from > ${NOW_UTC()} THEN 'locked'
          ELSE 'pending'
        END as status,
        qsa.is_active as session_active
      FROM quizzes q
      LEFT JOIN quiz_session_access qsa ON q.id = qsa.quiz_id AND qsa.session_id = ${studentSessionData.session_id}
      WHERE q.id = ${Number.parseInt(homeworkId)}
      AND q.assessment_type = 'homework'
      AND q.deleted_at IS NULL
      AND qsa.id IS NOT NULL
      AND qsa.is_active = true
    `;

    if (homework.length === 0) {
      return NextResponse.json({ error: "Homework not found" }, { status: 404 });
    }

    const homeworkData = homework[0];

    // Who can access: when restrict_access_to_students, only allowed_student_ids can access
    if (homeworkData.restrict_access_to_students === true) {
      const allowedIds = homeworkData.allowed_student_ids
      const allowedArr = Array.isArray(allowedIds) ? allowedIds.map((x: unknown) => Number(x)).filter(Number.isInteger) : []
      if (!allowedArr.includes(internalStudentId)) {
        return NextResponse.json(
          {
            error: "You must be in class to take this assessment. You cannot take it this way. Please contact your instructor if you were absent.",
            access_restricted: true,
          },
          { status: 403 }
        )
      }
    }

    // Deadline extension (matches /api/[assessmentType]/take): rollover row OR attempt_overrides.
    // Must run when status is "completed" too — otherwise past-due + completed hides retake (is_active stays false).
    let effectiveStatus = homeworkData.status
    let effectiveIsActive = homeworkData.is_active
    let rolloverActive = false

    const deadlinePassed =
      homeworkData.available_until != null &&
      new Date(homeworkData.available_until as string).getTime() <= Date.now()

    const hasDeadlineExt = await hasDeadlineExtensionForStudentQuiz(
      internalStudentId,
      homeworkData.id as number
    )
    if (deadlinePassed && homeworkData.status !== "locked") {
      if (hasDeadlineExt) {
        effectiveIsActive = true
        rolloverActive = true
        if (homeworkData.status === "overdue" || homeworkData.status === "pending") {
          effectiveStatus = "pending"
        }
      }
    }
    
    // ONLY completed attempts count - incomplete never count (single source of truth)
    const completedAttemptsCount = await getCompletedAttemptCount(internalStudentId, homeworkData.id);

    const inProgressSaved = await sql`
      SELECT id FROM quiz_attempts
      WHERE student_id = ${internalStudentId}
        AND quiz_id = ${homeworkData.id}
        AND deleted_at IS NULL
        AND completed_at IS NULL
        AND saved_for_later_at IS NOT NULL
      LIMIT 1
    `;
    
    // Check retake eligibility (uses effective limit: Trailblazer/Explorer get their perks)
    const retakeCheck = await canRetakeAssessment(
      internalStudentId,
      homeworkData.id,
      homeworkData.retake_limit,
      homeworkData.retake_enabled,
      completedAttemptsCount,
      undefined,
      {
        availableUntil: homeworkData.available_until,
        hasDeadlineExtension: hasDeadlineExt,
        bypassCalendarRetakeExpiry: await isBetaUser(internalStudentId),
      },
    );

    // Past due: still allow resume or an eligible retake (take API enforces first-attempt window)
    if (deadlinePassed && !effectiveIsActive) {
      if (inProgressSaved.length > 0 || (completedAttemptsCount > 0 && retakeCheck.canRetake)) {
        effectiveIsActive = true
      }
    }
    
    // Total allowed = effective retake limit + 1 (respects Trailblazer perks)
    const { effectiveLimit } = await getEffectiveRetakeLimit(
      internalStudentId,
      homeworkData.id,
      homeworkData.retake_limit,
      homeworkData.retake_enabled === true
    );
    const totalAttemptsAllowed = effectiveLimit === null ? null : effectiveLimit + 1;
    
    const attemptsRemaining = retakeCheck.attemptsRemaining;
    const canRetake = retakeCheck.canRetake && effectiveIsActive;

    // Can continue = has in-progress saved_for_later attempt (resume, not a retake)
    const canContinue = inProgressSaved.length > 0 && effectiveIsActive;

    return NextResponse.json({
      success: true,
      homework: {
        ...homeworkData,
        status: effectiveStatus,
        is_active: effectiveIsActive,
        rollover_active: rolloverActive,
        attempts_used: completedAttemptsCount,
        attempts_allowed: totalAttemptsAllowed,
        can_retake: canRetake,
        can_continue: canContinue,
        attempts_remaining: attemptsRemaining,
        calendar_retake_perks_expired: retakeCheck.calendarRetakePerksExpired ?? false,
        expired_retake_slots: retakeCheck.expiredRetakeSlots ?? null,
        due_date: homeworkData.available_until, // Map available_until to due_date for compatibility
        time_limit: homeworkData.time_per_question || 60, // Default time limit
        total_questions: 0, // Will be fetched separately if needed
        instructions: homeworkData.description || ""
      }
    });

  } catch (error) {
    console.error("[v0] Error fetching homework:", error);
    return NextResponse.json(
      { error: "Failed to fetch homework" },
      { status: 500 }
    );
  }
}
