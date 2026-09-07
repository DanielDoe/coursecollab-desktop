import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { instructorOwnsSectionVariants } from "@/lib/instructor-section-auth";
import { requireInstructorSession } from "@/lib/instructor-session-auth";
import { resolveOptionalCourseScope } from "@/lib/optional-instructor-course-scope";
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST - Clear all attendance records for a section (soft delete)
export async function POST(req: NextRequest) {
  try {
    const instructor = await requireInstructorSession(req);
    if (!instructor.ok) return instructor.response;

    const body = await req.json();
    const { section } = body;

    if (!section) {
      return NextResponse.json(
        { error: "Section is required" },
        { status: 400 }
      );
    }

    const scoped = await resolveOptionalCourseScope(req);
    if (!scoped.ok) return scoped.response;

    const variants = normalizedSectionVariantsForSql(String(section));
    const ownsSection = await instructorOwnsSectionVariants(
      instructor.instructorId,
      variants,
      scoped.courseId,
    );
    if (!ownsSection) {
      return NextResponse.json(
        { error: "No roster for this section under your account" },
        { status: 403 },
      );
    }

    // Soft delete all records for this section
    const result = await sql`
      UPDATE attendance_records
      SET deleted_at = NOW()
      WHERE section = ${section}
        AND deleted_at IS NULL
      RETURNING id
    `;

    return NextResponse.json({
      success: true,
      message: `Cleared ${result.length} attendance records for section ${section}`,
      count: result.length,
    });
  } catch (error: any) {
    console.error("Error clearing attendance records:", error);
    return NextResponse.json(
      { error: "Failed to clear attendance records", details: error.message },
      { status: 500 }
    );
  }
}
