import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { recalculateAndSaveGrade } from "@/lib/grades";
import { resolveOptionalCourseScope } from "@/lib/optional-instructor-course-scope";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const scoped = await resolveOptionalCourseScope(request);
    if (!scoped.ok) return scoped.response;

    const body = await request.json().catch(() => ({}));
    const session = (body.session as string) || "ALL";

    const hdrInstructor = request.headers.get("x-instructor-id");
    const instructorFromHeader =
      hdrInstructor != null && String(hdrInstructor).trim() !== ""
        ? Number(hdrInstructor)
        : NaN;

    const sessionExtras =
      session === "ALL"
        ? sql``
        : sql` AND (
          TRIM(s.section) = TRIM(${session})
          OR EXISTS (
            SELECT 1 FROM sessions sess
            WHERE sess.id = s.session_id AND TRIM(sess.code) = TRIM(${session})
          )
        )`;

    let students;
    if (scoped.courseId != null) {
      students = await sql`
        SELECT s.id, s.section
        FROM students s
        WHERE s.course_id = ${scoped.courseId}
        ${sessionExtras}
        ORDER BY s.section ASC, s.id ASC
      `;
    } else if (Number.isFinite(instructorFromHeader)) {
      students = await sql`
        SELECT s.id, s.section
        FROM students s
        WHERE s.course_id IN (
          SELECT id FROM courses
          WHERE instructor_id = ${instructorFromHeader} AND is_active = true
        )
        ${sessionExtras}
        ORDER BY s.section ASC, s.id ASC
      `;
    } else {
      return NextResponse.json(
        {
          error:
            "Select a course (dashboard) or send x-instructor-id to bulk-calculate grades for your courses.",
        },
        { status: 400 },
      );
    }

    let calculated = 0;
    let errors = 0;

    for (const student of students) {
      try {
        const section = student.section || "ALL";
        const result = await recalculateAndSaveGrade(student.id, section);
        if (result) calculated++;
      } catch (err) {
        console.error(`[Bulk Calculate] Error for student ${student.id}:`, err);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Calculated grades for ${calculated} students${errors > 0 ? ` (${errors} errors)` : ""}`,
      calculated,
      errors,
      total: students.length,
    });
  } catch (error) {
    console.error("Error bulk calculating grades:", error);
    return NextResponse.json(
      { error: "Failed to bulk calculate grades" },
      { status: 500 },
    );
  }
}
