import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { isBetaUser } from "@/lib/membership";
import { NOW_UTC } from "@/lib/central-time";
import { requireStudentIdParamMatchesCaller } from "@/lib/student-api-auth";
import { getAttemptDisplayGradesBatch } from "@/lib/attempt-grade-display";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionParam = searchParams.get("session");
    const studentId =
      searchParams.get("studentDatabaseId") ?? searchParams.get("studentId");

    if (!sessionParam) {
      return NextResponse.json({ error: "Session parameter is required" }, { status: 400 });
    }

    if (!studentId) {
      return NextResponse.json({ error: "Student ID parameter is required" }, { status: 401 });
    }

    const auth = await requireStudentIdParamMatchesCaller(request, studentId);
    if (!auth.ok) return auth.response;

    const internalStudentId = auth.studentDbId;

    const studentLookup = await sql`
      SELECT id, session_id FROM students WHERE id = ${internalStudentId}
    `;

    if (studentLookup.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const studentSessionId = studentLookup[0].session_id;

    if (!studentSessionId) {
      return NextResponse.json({ error: "Student session not found" }, { status: 404 });
    }

    const isBeta = await isBetaUser(internalStudentId);

    const homeworkHistory = await sql`
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
        qa.id as attempt_id,
        qa.started_at,
        qa.completed_at,
        qa.score,
        qa.total_questions as attempt_questions,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM quiz_attempts qa2 
            WHERE qa2.quiz_id = q.id AND qa2.student_id = ${internalStudentId} 
            AND qa2.completed_at IS NOT NULL AND qa2.deleted_at IS NULL
          ) THEN 'completed'
          WHEN ${isBeta} = false AND q.available_until IS NOT NULL AND q.available_until <= ${NOW_UTC()} THEN 'overdue'
          ELSE 'pending'
        END as status,
        COALESCE(
          (SELECT COUNT(*) FROM quiz_answers qa3 WHERE qa3.attempt_id = qa.id AND qa3.is_correct = true),
          0
        ) as correct_answers
      FROM quizzes q
      LEFT JOIN quiz_session_access qsa ON q.id = qsa.quiz_id AND qsa.session_id = ${studentSessionId} AND qsa.is_active = true
      LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id AND qa.student_id = ${internalStudentId} AND qa.deleted_at IS NULL
      WHERE q.assessment_type = 'homework'
      AND q.deleted_at IS NULL
      AND qsa.id IS NOT NULL
      ORDER BY q.available_until DESC, qa.started_at DESC
    `;

    const attemptIds = (homeworkHistory as { attempt_id: number | null }[])
      .map((row) => row.attempt_id)
      .filter((id): id is number => id != null)
    const displayGrades = await getAttemptDisplayGradesBatch(attemptIds);

    const groupedHistory = (homeworkHistory as Array<Record<string, unknown>>).reduce(
      (acc: Record<number, Record<string, unknown>>, row) => {
        const hwId = Number(row.id);
        if (!acc[hwId]) {
          acc[hwId] = {
            id: hwId,
            title: row.title,
            description: row.description,
            time_per_question: row.time_per_question,
            available_from: row.available_from,
            available_until: row.available_until,
            retake_limit: row.retake_limit,
            created_at: row.created_at,
            updated_at: row.updated_at,
            status: row.status,
            attempts: [],
          };
        }

        if (row.attempt_id) {
          const attemptId = Number(row.attempt_id);
          const grade = displayGrades.get(attemptId);
          (acc[hwId].attempts as unknown[]).push({
            id: attemptId,
            started_at: row.started_at,
            completed_at: row.completed_at,
            is_completed: row.completed_at !== null,
            score: grade?.score ?? Number(row.score ?? 0),
            total_questions: grade?.totalPoints ?? Number(row.attempt_questions ?? 0),
            correct_answers: Number(row.correct_answers ?? 0),
            percentage: grade?.percentage ?? 0,
          });
        }

        return acc;
      },
      {},
    );

    const historyArray = Object.values(groupedHistory);

    return NextResponse.json({
      success: true,
      homeworkHistory: historyArray,
      stats: {
        total: historyArray.length,
        completed: historyArray.filter((h: { status: string }) => h.status === "completed").length,
        pending: historyArray.filter((h: { status: string }) => h.status === "pending").length,
        overdue: historyArray.filter((h: { status: string }) => h.status === "overdue").length,
      },
    });
  } catch (error) {
    console.error("[v0] Error fetching homework history:", error);
    return NextResponse.json(
      { error: "Failed to fetch homework history" },
      { status: 500 },
    );
  }
}
