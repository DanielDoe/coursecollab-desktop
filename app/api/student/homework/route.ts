import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { bypassesAssessmentAvailabilityWindows } from "@/lib/membership";
import { NOW_UTC } from "@/lib/central-time";
import { resolveStudentDatabaseIdFromParam } from "@/lib/resolve-student-db-id";
import { getQuizIdsWithDeadlineExtensionForStudent } from "@/lib/deadline-extension";
import { isPreCourseStudent } from "@/lib/student-course-access-gate";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionParam = searchParams.get("session");
    const studentId = searchParams.get("studentId");
    const studentDatabaseIdParam = searchParams.get("studentDatabaseId");

    if (!sessionParam) {
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

    if (await isPreCourseStudent(internalStudentId)) {
      return NextResponse.json({ homework: [], pre_course: true });
    }

    // Get student session info (handle both session_id and section)
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

    const session = studentSession[0];
    
    if (!session.session_id) {
      return NextResponse.json({ error: "Student session not found" }, { status: 404 });
    }

    const scheduleBypass = await bypassesAssessmentAvailabilityWindows(internalStudentId);

    // Fetch homeworks for the session with proper session access check
    // Explorer / Trailblazer / beta bypass available_from and available_until in list status
    const homeworks = await sql`
      SELECT 
        q.id,
        q.title,
        q.description,
        q.time_per_question,
        q.available_from,
        q.available_until,
        q.retake_limit,
        q.created_at,
        q.updated_at,
        COALESCE(
          (SELECT COUNT(*) FROM quiz_attempts qa WHERE qa.quiz_id = q.id AND qa.student_id = ${internalStudentId} AND qa.completed_at IS NOT NULL AND qa.deleted_at IS NULL),
          0
        ) as attempts_used,
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
      LEFT JOIN quiz_session_access qsa ON q.id = qsa.quiz_id AND qsa.session_id = ${session.session_id}
      WHERE q.assessment_type = 'homework'
      AND qsa.id IS NOT NULL
      AND qsa.is_active = true
      AND q.deleted_at IS NULL
      AND (
        (NOT COALESCE(q.restrict_access_to_students, false))
        OR (COALESCE(q.allowed_student_ids, '[]'::jsonb) @> to_jsonb(${internalStudentId}::integer))
      )
      ORDER BY q.available_until ASC, q.created_at DESC
    `;

    const hwRows = homeworks as {
      id: number
      status: string
      available_until: string | null
      available_from: string | null
    }[]
    const extensionIds = await getQuizIdsWithDeadlineExtensionForStudent(
      internalStudentId,
      hwRows.map((h) => h.id)
    )

    const homeworksAdjusted = hwRows.map((h) => {
      if (h.status !== "overdue" || !extensionIds.has(h.id)) return h
      return { ...h, status: "pending" as const }
    })

    return NextResponse.json({
      success: true,
      homeworks: homeworksAdjusted,
      stats: {
        total: homeworksAdjusted.length,
        completed: homeworksAdjusted.filter((h) => h.status === "completed").length,
        pending: homeworksAdjusted.filter((h) => h.status === "pending").length,
        overdue: homeworksAdjusted.filter((h) => h.status === "overdue").length,
      },
    });

  } catch (error) {
    console.error("[v0] Error fetching homeworks:", error);
    return NextResponse.json(
      { error: "Failed to fetch homeworks" },
      { status: 500 }
    );
  }
}
