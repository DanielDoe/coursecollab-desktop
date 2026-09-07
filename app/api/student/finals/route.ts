import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { canRetakeAssessment } from "@/lib/retake-utils";
import { isBetaUser } from "@/lib/membership";
import { NOW_UTC } from "@/lib/central-time";
import { requireBoundStudentCaller } from "@/lib/student-api-auth";
import { getQuizIdsWithDeadlineExtensionForStudent } from "@/lib/deadline-extension";
import { normalizeAllowedStudentIds } from "@/lib/normalize-allowed-student-ids";
import { resolveAssessmentTimerDisplayLabel } from "@/lib/assessment-timer-display";
import { isPreCourseStudent } from "@/lib/student-course-access-gate";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionParam = searchParams.get("session");
    const studentId = searchParams.get("studentId");
    const studentDatabaseIdParam = searchParams.get("studentDatabaseId");

    const rawStudent = (studentDatabaseIdParam ?? studentId ?? "").trim();
    const auth = await requireBoundStudentCaller(request, rawStudent || null);
    if (!auth.ok) return auth.response;

    if (!sessionParam) {
      return NextResponse.json({ error: "Session parameter is required" }, { status: 400 });
    }

    const internalStudentId = auth.studentDbId;

    // Get student session info and beta status
    const studentSession = await sql`
      SELECT s.id, s.section, s.beta_user, sess.id as session_id, sess.code as session_code
      FROM students s
      JOIN sessions sess ON s.session_id = sess.id
      WHERE s.id = ${internalStudentId}
      LIMIT 1
    `;

    if (studentSession.length === 0) {
      return NextResponse.json({ error: "Student session not found" }, { status: 404 });
    }

    const session = studentSession[0];
    const studentBetaUser = session.beta_user || false;

    if (await isPreCourseStudent(internalStudentId)) {
      return NextResponse.json({ finals: [], pre_course: true });
    }
    
    // Check if beta testing is globally disabled
    const betaTestingDisabled = process.env.DISABLE_BETA_TESTING === 'true';
    
    // Check if student is a beta user (for early access to finals)
    const isBeta = await isBetaUser(internalStudentId);

    // Fetch finals for the session with proper session access check and beta filtering
    // Beta users can access finals even if available_from hasn't been reached yet
    const finalsRaw = await sql`
      SELECT 
        q.id,
        q.title,
        q.description,
        q.time_per_question,
        q.section_config,
        q.available_from,
        q.available_until,
        q.retake_limit,
        q.retake_enabled,
        q.created_at,
        q.updated_at,
        COALESCE(q.restrict_access_to_students, false) as restrict_access_to_students,
        q.allowed_student_ids,
        q.parent_quiz_id,
        (
          (qsa.id IS NOT NULL AND qsa.is_active = true)
          OR (
            NOT COALESCE(q.restrict_access_to_students, false)
            AND q.parent_quiz_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM quiz_session_access p
              WHERE p.quiz_id = q.parent_quiz_id
                AND p.session_id = ${session.session_id}
                AND p.is_active = true
            )
          )
          OR (
            COALESCE(q.restrict_access_to_students, false)
            AND q.parent_quiz_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM quiz_session_access p_rc
              WHERE p_rc.quiz_id = q.parent_quiz_id
                AND p_rc.session_id = ${session.session_id}
                AND p_rc.is_active = true
            )
          )
        ) as session_active,
        CASE 
          WHEN (
            (qsa.id IS NOT NULL AND qsa.is_active = true)
            OR (
              NOT COALESCE(q.restrict_access_to_students, false)
              AND q.parent_quiz_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM quiz_session_access p2
                WHERE p2.quiz_id = q.parent_quiz_id
                  AND p2.session_id = ${session.session_id}
                  AND p2.is_active = true
              )
            )
            OR (
              COALESCE(q.restrict_access_to_students, false)
              AND q.parent_quiz_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM quiz_session_access p2_rc
                WHERE p2_rc.quiz_id = q.parent_quiz_id
                  AND p2_rc.session_id = ${session.session_id}
                  AND p2_rc.is_active = true
              )
            )
          )
            AND (
              ${isBeta} = true  -- Beta users bypass available_from date check
              OR (q.available_from IS NULL OR q.available_from <= ${NOW_UTC()})
            )
            AND (
              ${isBeta} = true  -- Beta users bypass available_until date check
              OR (q.available_until IS NULL OR q.available_until >= ${NOW_UTC()})
            )
          THEN true
          ELSE false
        END as is_active,
        COALESCE(
          (SELECT COUNT(*) FROM quiz_attempts qa WHERE qa.quiz_id = q.id AND qa.student_id = ${internalStudentId} AND qa.completed_at IS NOT NULL AND qa.deleted_at IS NULL),
          0
        ) as attempts_used,
        COALESCE(
          (SELECT SUM(COALESCE(qq.time_limit, q.time_per_question, 60)) 
           FROM quiz_questions qq 
           WHERE qq.quiz_id = q.id),
          0
        ) as total_duration_seconds,
        COALESCE(
          (SELECT COUNT(*)::int FROM quiz_questions qq WHERE qq.quiz_id = q.id),
          0
        ) as question_count,
        COALESCE(
          (SELECT ROUND(AVG(COALESCE(qq.time_limit, q.time_per_question, 60)))::int
           FROM quiz_questions qq WHERE qq.quiz_id = q.id),
          q.time_per_question
        ) as actual_time_per_question,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM quiz_attempts qa 
            WHERE qa.quiz_id = q.id 
            AND qa.student_id = ${internalStudentId} 
            AND qa.completed_at IS NOT NULL
          ) THEN 'completed'
          WHEN ${isBeta} = false AND q.available_until < ${NOW_UTC()} THEN 'overdue'  -- Only mark overdue for non-beta users
          WHEN ${isBeta} = false AND q.available_from > ${NOW_UTC()} THEN 'locked'  -- Only lock for non-beta users
          ELSE 'pending'
        END as status
      FROM quizzes q
      LEFT JOIN quiz_session_access qsa ON q.id = qsa.quiz_id AND qsa.session_id = ${session.session_id}
      WHERE q.assessment_type = 'final'
      AND (
        (qsa.id IS NOT NULL AND qsa.is_active = true)
        OR (
          NOT COALESCE(q.restrict_access_to_students, false)
          AND q.parent_quiz_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM quiz_session_access p3
            WHERE p3.quiz_id = q.parent_quiz_id
              AND p3.session_id = ${session.session_id}
              AND p3.is_active = true
          )
        )
        OR (
          COALESCE(q.restrict_access_to_students, false)
          AND q.parent_quiz_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM quiz_session_access p3_rc
            WHERE p3_rc.quiz_id = q.parent_quiz_id
              AND p3_rc.session_id = ${session.session_id}
              AND p3_rc.is_active = true
          )
        )
      )
      AND q.deleted_at IS NULL
      AND (
        (q.assessment_type = 'final')
        OR (NOT COALESCE(q.restrict_access_to_students, false))
        OR (COALESCE(q.allowed_student_ids, '[]'::jsonb) @> to_jsonb(${internalStudentId}::integer))
      )
      AND (${betaTestingDisabled} = true OR q.beta_only = false OR (q.beta_only = true AND ${studentBetaUser} = true))
      ORDER BY q.available_until ASC, q.created_at DESC
    `;

    const extensionIds = await getQuizIdsWithDeadlineExtensionForStudent(
      internalStudentId,
      finalsRaw.map((f) => f.id as number)
    );

    // Calculate retake eligibility for each final
    const finals = await Promise.all(
      finalsRaw.map(async (final) => {
        // Get completed attempts count and latest attempt ID
        const completedAttempts = await sql`
          SELECT COUNT(*) as count
          FROM quiz_attempts
          WHERE quiz_id = ${final.id}
            AND student_id = ${internalStudentId}
            AND completed_at IS NOT NULL
        `
        
        const completedAttemptsCount = parseInt(completedAttempts[0]?.count || "0")
        
        // Get the latest completed attempt ID for viewing results
        const latestAttempt = await sql`
          SELECT id
          FROM quiz_attempts
          WHERE quiz_id = ${final.id}
            AND student_id = ${internalStudentId}
            AND completed_at IS NOT NULL
          ORDER BY completed_at DESC
          LIMIT 1
        `
        
        const attemptId = latestAttempt.length > 0 ? latestAttempt[0].id : null

        const hasExtension = extensionIds.has(final.id as number)
        
        // Check retake eligibility using proper retake logic
        // This automatically checks donation and membership perks via getDefaultRetakeLimit
        const retakeCheck = await canRetakeAssessment(
          internalStudentId,
          final.id,
          final.retake_limit,
          final.retake_enabled,
          completedAttemptsCount,
          undefined,
          {
            availableUntil: final.available_until,
            hasDeadlineExtension: hasExtension,
            bypassCalendarRetakeExpiry: isBeta,
          },
        )

        const effectiveIsActive = Boolean(final.is_active) || hasExtension

        const restrictAccess = final.restrict_access_to_students === true
        const allowedIds = normalizeAllowedStudentIds(final.allowed_student_ids)
        const finalAccessPendingAllowlist =
          restrictAccess && !allowedIds.includes(internalStudentId)

        const { allowed_student_ids: _a, restrict_access_to_students: _r, ...finalOut } =
          final as typeof final & {
            allowed_student_ids?: unknown
            restrict_access_to_students?: unknown
          }

        const timerDisplayLabel = resolveAssessmentTimerDisplayLabel(
          "final",
          (final as { section_config?: unknown }).section_config,
          Number((final as { actual_time_per_question?: number }).actual_time_per_question),
        )

        return {
          ...finalOut,
          is_active: effectiveIsActive,
          attempts_used: completedAttemptsCount,
          attempt_id: attemptId,
          final_access_pending_allowlist: finalAccessPendingAllowlist,
          can_retake: false,
          attempts_remaining: 0,
          timer_display_label: timerDisplayLabel,
          time_per_question: Math.round(
            Number((final as { actual_time_per_question?: number }).actual_time_per_question) || 0,
          ),
          calendar_retake_perks_expired: retakeCheck.calendarRetakePerksExpired ?? false,
          expired_retake_slots: retakeCheck.expiredRetakeSlots ?? null,
        }
      })
    )

    return NextResponse.json({
      success: true,
      finals: finals,
      stats: {
        total: finals.length,
        completed: finals.filter(f => f.status === 'completed').length,
        pending: finals.filter(f => f.status === 'pending').length,
        overdue: finals.filter(f => f.status === 'overdue').length,
      }
    });

  } catch (error) {
    console.error("[v0] Error fetching finals:", error);
    return NextResponse.json(
      { error: "Failed to fetch finals" },
      { status: 500 }
    );
  }
}

