import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { NOW_UTC } from "@/lib/central-time";
import { resolveStudentDatabaseIdFromParam } from "@/lib/resolve-student-db-id";
import { hasDeadlineExtensionForStudentQuiz } from "@/lib/deadline-extension";
import { resolveAssessmentTimerDisplayLabel } from "@/lib/assessment-timer-display";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const finalId = resolvedParams.id;
    const { searchParams } = new URL(request.url);
    const session = searchParams.get("session");
    const studentId = searchParams.get("studentId");
    const studentDatabaseIdParam = searchParams.get("studentDatabaseId");

    if (!session) {
      return NextResponse.json({ error: "Session parameter is required" }, { status: 400 });
    }

    const rawStudent = (studentDatabaseIdParam ?? studentId ?? "").trim();
    if (!rawStudent) {
      return NextResponse.json({ error: "Student ID or studentDatabaseId is required" }, { status: 401 });
    }

    const resolvedId = await resolveStudentDatabaseIdFromParam(rawStudent);
    if (resolvedId == null) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const internalStudentId = resolvedId;

    // Fetch specific final
    const final = await sql`
      SELECT 
        q.id,
        q.restrict_access_to_students,
        q.allowed_student_ids,
        q.title,
        q.description,
        q.time_per_question,
        q.section_config,
        q.available_from,
        q.available_until,
        q.retake_limit,
        q.created_at,
        q.updated_at,
        q.is_active,
        q.retake_enabled,
        q.review_before_retake,
        q.retake_policy,
        COALESCE(
          (SELECT COUNT(*) FROM quiz_attempts qa WHERE qa.quiz_id = q.id AND qa.student_id = ${internalStudentId} AND qa.completed_at IS NOT NULL AND qa.deleted_at IS NULL),
          0
        ) as attempts_used,
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
            AND qa.deleted_at IS NULL
          ) THEN 'completed'
          WHEN q.available_until <= ${NOW_UTC()} THEN 'overdue'
          ELSE 'pending'
        END as status
      FROM quizzes q
      WHERE q.id = ${Number.parseInt(finalId)}
      AND q.assessment_type = 'final'
      AND q.is_public = true
    `;

    if (final.length === 0) {
      return NextResponse.json({ error: "Final exam not found" }, { status: 404 });
    }

    const finalData = final[0] as Record<string, unknown> & { id: number; is_active?: boolean };
    const hasExtension = await hasDeadlineExtensionForStudentQuiz(internalStudentId, finalData.id);
    const effectiveIsActive = Boolean(finalData.is_active) || hasExtension;

    // Who can access: when restrict_access_to_students, only allowed_student_ids can access
    if (finalData.restrict_access_to_students === true) {
      const allowedIds = finalData.allowed_student_ids
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

    const timerDisplayLabel = resolveAssessmentTimerDisplayLabel(
      "final",
      finalData.section_config,
      Number(finalData.actual_time_per_question),
    )

    return NextResponse.json({
      success: true,
      final: {
        ...finalData,
        is_active: effectiveIsActive,
        can_retake: false,
        attempts_remaining: 0,
        timer_display_label: timerDisplayLabel,
        time_per_question: Math.round(Number(finalData.actual_time_per_question) || 0),
      },
    });

  } catch (error) {
    console.error("[v0] Error fetching final:", error);
    return NextResponse.json(
      { error: "Failed to fetch final" },
      { status: 500 }
    );
  }
}

