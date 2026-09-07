import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireStudentIdParamMatchesCaller } from "@/lib/student-api-auth";
import { getAttemptDisplayGradesBatch } from "@/lib/attempt-grade-display";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const session = searchParams.get("session");
    const studentId = searchParams.get("studentId");

    if (!session) {
      return NextResponse.json({ error: "Session parameter is required" }, { status: 400 });
    }

    if (!studentId) {
      return NextResponse.json({ error: "Student ID parameter is required" }, { status: 401 });
    }

    const auth = await requireStudentIdParamMatchesCaller(request, studentId);
    if (!auth.ok) return auth.response;

    const internalStudentId = auth.studentDbId;

    const studentLookup = await sql`
      SELECT id FROM students WHERE id = ${internalStudentId}
    `;

    if (studentLookup.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const finalsHistory = await sql`
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
          WHEN qa.completed_at IS NOT NULL THEN 'completed'
          WHEN q.available_until <= NOW() THEN 'overdue'
          ELSE 'pending'
        END as status,
        COALESCE(
          (SELECT COUNT(*) FROM quiz_answers qa3 WHERE qa3.attempt_id = qa.id AND qa3.is_correct = true),
          0
        ) as correct_answers
      FROM quizzes q
      LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id AND qa.student_id = ${internalStudentId}
      WHERE q.assessment_type = 'final'
      AND q.is_public = true
      ORDER BY q.available_until DESC, qa.started_at DESC
    `;

    const attemptIds = (finalsHistory as { attempt_id: number | null }[])
      .map((row) => row.attempt_id)
      .filter((id): id is number => id != null);
    const displayGrades = await getAttemptDisplayGradesBatch(attemptIds);

    const groupedHistory = (finalsHistory as Array<Record<string, unknown>>).reduce(
      (acc: Record<number, Record<string, unknown>>, row) => {
        const finalId = Number(row.id);
        if (!acc[finalId]) {
          acc[finalId] = {
            id: finalId,
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
          (acc[finalId].attempts as unknown[]).push({
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
      finalsHistory: historyArray,
      stats: {
        total: historyArray.length,
        completed: historyArray.filter((f: { status: string }) => f.status === "completed").length,
        pending: historyArray.filter((f: { status: string }) => f.status === "pending").length,
        overdue: historyArray.filter((f: { status: string }) => f.status === "overdue").length,
      },
    });
  } catch (error) {
    console.error("[v0] Error fetching finals history:", error);
    return NextResponse.json(
      { error: "Failed to fetch finals history" },
      { status: 500 },
    );
  }
}
