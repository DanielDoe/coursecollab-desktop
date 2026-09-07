import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { courseGradeWeightSessionKey } from "@/lib/grades"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const body = await request.json()
    const {
      quizWeight,
      homeworkWeight,
      midtermWeight,
      finalWeight,
      attendanceWeight,
      projectWeight,
      classroomWeight,
      engagementWeight,
    } = body

    const qw = Number(quizWeight) || 0
    const hw = Number(homeworkWeight) || 0
    const mw = Number(midtermWeight) || 0
    const fw = Number(finalWeight) || 0
    const aw = Number(attendanceWeight) || 0
    const pw = Number(projectWeight) || 0
    const cw = Number(classroomWeight) || 0
    const ew = Number(engagementWeight) || 0

    const totalWeight = qw + hw + mw + fw + aw + pw + cw + ew

    if (Math.abs(totalWeight - 100) > 0.05) {
      return NextResponse.json(
        { error: `Grade weights must total 100% (current total: ${totalWeight}).` },
        { status: 400 },
      )
    }

    for (const [label, v] of [
      ["quiz", qw],
      ["homework", hw],
      ["midterm", mw],
      ["final", fw],
      ["attendance", aw],
      ["project", pw],
      ["classroom", cw],
      ["engagement", ew],
    ] as const) {
      if (v < 0 || v > 100) {
        return NextResponse.json(
          { error: `Each category weight must be 0–100 (${label}: ${v})` },
          { status: 400 },
        )
      }
    }

    const sessionKey = courseGradeWeightSessionKey(scope.course.id)

    const result = await sql`
      INSERT INTO grade_weights (
        session, quiz_weight, homework_weight, midterm_weight, final_weight,
        attendance_weight, project_weight, classroom_weight, engagement_weight
      )
      VALUES (
        ${sessionKey},
        ${qw},
        ${hw},
        ${mw},
        ${fw},
        ${aw},
        ${pw},
        ${cw},
        ${ew}
      )
      ON CONFLICT (session)
      DO UPDATE SET
        quiz_weight = EXCLUDED.quiz_weight,
        homework_weight = EXCLUDED.homework_weight,
        midterm_weight = EXCLUDED.midterm_weight,
        final_weight = EXCLUDED.final_weight,
        attendance_weight = EXCLUDED.attendance_weight,
        project_weight = EXCLUDED.project_weight,
        classroom_weight = EXCLUDED.classroom_weight,
        engagement_weight = EXCLUDED.engagement_weight,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `

    return NextResponse.json({
      weights: result[0],
      courseId: scope.course.id,
      session: sessionKey,
    })
  } catch (error) {
    console.error("Error adjusting grade weights:", error)
    return NextResponse.json({ error: "Failed to adjust grade weights" }, { status: 500 })
  }
}
