import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { calculateLetterGrade, getGradeWeights, calculateTotalScore } from "@/lib/grades";
import { normalizeSessionForStorage } from "@/lib/session-catalog";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      studentId,
      session,
      quizScore,
      homeworkScore,
      midtermScore,
      finalScore,
      attendanceScore,
      projectScore,
      classroomScore,
      engagementCredits,
      notes,
      isLocked,
    } = body;

    if (!studentId || !session) {
      return NextResponse.json(
        { error: "Student ID and session are required" },
        { status: 400 }
      );
    }

    const studentIdNum = parseInt(studentId, 10);
    if (isNaN(studentIdNum)) {
      return NextResponse.json(
        { error: "Invalid student ID" },
        { status: 400 }
      );
    }

    const sessionRaw = String(session).trim();
    const sessionForStorage = await normalizeSessionForStorage(sessionRaw);

    let weights = await getGradeWeights(sessionForStorage);
    if (!weights && sessionRaw !== sessionForStorage) {
      weights = await getGradeWeights(sessionRaw);
    }
    if (!weights) {
      return NextResponse.json(
        { error: "Grade weights not found" },
        { status: 500 }
      );
    }

    let currentGrade = await sql`
      SELECT * FROM student_grades
      WHERE student_id = ${studentIdNum} AND session = ${sessionForStorage}
    `;

    if (currentGrade.length === 0) {
      const fallback = await sql`
        SELECT * FROM student_grades g
        WHERE g.student_id = ${studentIdNum}
          AND (
            TRIM(g.session) = 'ALL'
            OR TRIM(g.session) = TRIM(${sessionForStorage})
            OR TRIM(g.session) = TRIM(${sessionRaw})
          )
        ORDER BY
          CASE
            WHEN TRIM(g.session) = TRIM(${sessionForStorage}) THEN 0
            WHEN TRIM(g.session) = TRIM(${sessionRaw}) THEN 1
            WHEN TRIM(g.session) = 'ALL' THEN 2
            ELSE 3
          END
        LIMIT 1
      `;
      if (fallback.length > 0) {
        currentGrade = fallback;
      }
    }

    const cur = currentGrade[0] as
      | Record<string, unknown>
      | undefined;

    const scores = {
      quiz: quizScore !== undefined ? Number(quizScore) : Number(cur?.quiz_score) || 0,
      homework: homeworkScore !== undefined ? Number(homeworkScore) : Number(cur?.homework_score) || 0,
      midterm: midtermScore !== undefined ? Number(midtermScore) : Number(cur?.midterm_score) || 0,
      final: finalScore !== undefined ? Number(finalScore) : Number(cur?.final_score) || 0,
      attendance: attendanceScore !== undefined ? Number(attendanceScore) : Number(cur?.attendance_score) || 0,
      project: projectScore !== undefined ? Number(projectScore) : Number(cur?.project_score) || 0,
      classroom: classroomScore !== undefined ? Number(classroomScore) : Number(cur?.classroom_score) || 0,
      engagement: engagementCredits !== undefined ? Number(engagementCredits) : Number(cur?.engagement_credits) || 0,
    };

    const attendanceTouched = attendanceScore !== undefined;
    const attendanceManualOverride = attendanceTouched
      ? true
      : Boolean(cur?.attendance_manual_override);

    const { total, contributions } = calculateTotalScore(scores, weights);
    const letterGrade = calculateLetterGrade(total);

    const result = await sql`
      INSERT INTO student_grades (
        student_id, session,
        quiz_score, homework_score, midterm_score, final_score,
        attendance_score, project_score, classroom_score, engagement_credits,
        quiz_contribution, homework_contribution, midterm_contribution, final_contribution,
        attendance_contribution, project_contribution, classroom_contribution, engagement_contribution,
        total_score, letter_grade, notes, is_locked,
        attendance_manual_override
      )
      VALUES (
        ${studentIdNum}, ${sessionForStorage},
        ${scores.quiz}, ${scores.homework}, ${scores.midterm}, ${scores.final},
        ${scores.attendance}, ${scores.project}, ${scores.classroom}, ${scores.engagement},
        ${contributions.quiz}, ${contributions.homework}, ${contributions.midterm}, ${contributions.final},
        ${contributions.attendance}, ${contributions.project}, ${contributions.classroom}, ${contributions.engagement},
        ${total}, ${letterGrade}, ${notes || null}, ${isLocked || false},
        ${attendanceManualOverride}
      )
      ON CONFLICT (student_id, session)
      DO UPDATE SET
        quiz_score = EXCLUDED.quiz_score,
        homework_score = EXCLUDED.homework_score,
        midterm_score = EXCLUDED.midterm_score,
        final_score = EXCLUDED.final_score,
        attendance_score = EXCLUDED.attendance_score,
        project_score = EXCLUDED.project_score,
        classroom_score = EXCLUDED.classroom_score,
        engagement_credits = EXCLUDED.engagement_credits,
        quiz_contribution = EXCLUDED.quiz_contribution,
        homework_contribution = EXCLUDED.homework_contribution,
        midterm_contribution = EXCLUDED.midterm_contribution,
        final_contribution = EXCLUDED.final_contribution,
        attendance_contribution = EXCLUDED.attendance_contribution,
        project_contribution = EXCLUDED.project_contribution,
        classroom_contribution = EXCLUDED.classroom_contribution,
        engagement_contribution = EXCLUDED.engagement_contribution,
        total_score = EXCLUDED.total_score,
        letter_grade = EXCLUDED.letter_grade,
        notes = COALESCE(EXCLUDED.notes, student_grades.notes),
        is_locked = EXCLUDED.is_locked,
        attendance_manual_override = EXCLUDED.attendance_manual_override,
        last_calculated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    return NextResponse.json({ grade: result[0] });
  } catch (error) {
    console.error("Error updating student grade:", error);
    return NextResponse.json(
      { error: "Failed to update student grade" },
      { status: 500 }
    );
  }
}


