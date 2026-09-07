import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { recalculateAndSaveGrade, getGradeWeights, type StudentGrade } from "@/lib/grades";
import { normalizeSessionForStorage } from "@/lib/session-catalog";
import { requireStudentRecordAccess } from "@/lib/student-api-auth";
import { buildProvisionalGradeForStudent } from "@/lib/student-provisional-grade";
import { getStudentAttendanceSoFar } from "@/lib/attendance-percentage";
import { rememberTtl } from "@/lib/perf/ttl-cache";
import { logRequestPerf, startPerfTimer } from "@/lib/perf/request-log";

export const dynamic = "force-dynamic";

const CLASS_AVG_TTL_MS = 120_000
const WEIGHTS_TTL_MS = 15 * 60_000

async function fetchClassAverages(sessionForStorage: string) {
  return rememberTtl(`grades:class-avg:${sessionForStorage}`, CLASS_AVG_TTL_MS, async () => {
    const classAverages = await sql`
      SELECT 
        AVG(quiz_score) as avg_quiz,
        AVG(homework_score) as avg_homework,
        AVG(midterm_score) as avg_midterm,
        AVG(final_score) as avg_final,
        AVG(attendance_score) as avg_attendance,
        AVG(project_score) as avg_project,
        AVG(classroom_score) as avg_classroom,
        AVG(engagement_credits) as avg_engagement,
        AVG(total_score) as avg_total
      FROM student_grades
      WHERE session = ${sessionForStorage}
    `;
    return classAverages[0] || {};
  })
}

function cachedWeights(session: string) {
  return rememberTtl(`grades:weights:${session}`, WEIGHTS_TTL_MS, () => getGradeWeights(session))
}

export async function GET(request: NextRequest) {
  const elapsed = startPerfTimer()
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const sessionParam = searchParams.get("session") || "ALL";
    const recalculate = searchParams.get("recalculate") === "true";

    const sessionForStorage = await normalizeSessionForStorage(sessionParam);
    const session = sessionParam;

    if (!studentId) {
      return NextResponse.json(
        { error: "Student ID is required" },
        { status: 400 }
      );
    }

    const auth = await requireStudentRecordAccess(request, studentId);
    if (!auth.ok) return auth.response;

    const studentIdNum = auth.studentDbId;

    if (recalculate) {
      const recalculated = await recalculateAndSaveGrade(studentIdNum, session);
      if (recalculated) {
        const [provisional, weights, classAverages] = await Promise.all([
          buildProvisionalGradeForStudent(studentIdNum, recalculated, sessionForStorage),
          cachedWeights(session),
          fetchClassAverages(sessionForStorage),
        ])
        logRequestPerf({ route: "/api/grades/student", status: 200, durationMs: elapsed() })
        return NextResponse.json({
          grade: recalculated,
          weights,
          classAverages,
          provisional,
        });
      }
    }

    const gradeResult = await sql`
      SELECT * FROM student_grades
      WHERE student_id = ${studentIdNum} AND session = ${sessionForStorage}
    `;

    if (gradeResult.length === 0) {
      const newGrade = await recalculateAndSaveGrade(studentIdNum, session);
      if (!newGrade) {
        return NextResponse.json(
          { error: "Failed to calculate grade" },
          { status: 500 }
        );
      }
      const [provisional, weights, classAverages] = await Promise.all([
        buildProvisionalGradeForStudent(studentIdNum, newGrade, sessionForStorage),
        cachedWeights(session),
        fetchClassAverages(sessionForStorage),
      ])
      logRequestPerf({ route: "/api/grades/student", status: 200, durationMs: elapsed() })
      return NextResponse.json({
        grade: newGrade,
        weights,
        classAverages,
        provisional,
      });
    }

    const grade = gradeResult[0] as StudentGrade;
    const [weights, attendanceSoFar, classAverages] = await Promise.all([
      cachedWeights(session),
      getStudentAttendanceSoFar(studentIdNum, sessionForStorage),
      fetchClassAverages(sessionForStorage),
    ])
    if (attendanceSoFar.sessionsScoredSoFar > 0) {
      grade.attendance_score = attendanceSoFar.percentage;
    }

    const provisional = await buildProvisionalGradeForStudent(
      studentIdNum,
      grade,
      sessionForStorage,
    );

    logRequestPerf({ route: "/api/grades/student", status: 200, durationMs: elapsed() })
    return NextResponse.json({
      grade,
      weights,
      classAverages,
      provisional,
    });
  } catch (error) {
    console.error("Error fetching student grade:", error);
    logRequestPerf({ route: "/api/grades/student", status: 500, durationMs: elapsed() })
    return NextResponse.json(
      { error: "Failed to fetch student grade" },
      { status: 500 }
    );
  }
}
