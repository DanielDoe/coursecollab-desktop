import { NextRequest, NextResponse } from "next/server";
import { getSQL } from "@/lib/db";
import { requireClassroomPointsInstructor } from "@/lib/classroom-points-request-auth";
import { sqlInstructorStudentScope } from "@/lib/classroom-points-term-scope";

const sql = getSQL();

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET - Fetch all students with their classroom points summary
export async function GET(request: NextRequest) {
  try {
    const scoped = await requireClassroomPointsInstructor(request);
    if (!scoped.ok) return scoped.response;
    const cid = scoped.course.id;
    const studentScope = await sqlInstructorStudentScope(request, cid, sql, {
      sessionCode: new URL(request.url).searchParams.get("session"),
    });

    const { searchParams } = new URL(request.url);
    const session = searchParams.get("session");

    console.log("\n🎯 [Classroom Points Summary API] Fetching students...");
    console.log("   Session filter:", session || "all");

    let summary;

    if (session) {
      // Full section roster with LEFT JOIN — include students with 0 points (matches leaderboard API)
      console.log("   Querying for session:", session);
      summary = await sql`
        SELECT 
          s.id as student_id,
          s.student_id as student_number,
          s.full_name,
          s.section as session,
          COALESCE(SUM(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.points ELSE 0 END), 0) as total_points,
          COUNT(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.id END) as award_count,
          MAX(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.awarded_at END) as last_awarded
        FROM students s
        LEFT JOIN classroom_points cp ON s.id = cp.student_id
          AND (cp.status = 'approved' OR cp.status IS NULL)
        WHERE 1 = 1
          ${studentScope}
        GROUP BY s.id, s.student_id, s.full_name, s.section
        ORDER BY total_points DESC, s.full_name ASC
        LIMIT 500
      `;
    } else {
      // All students in course — full approved totals (no arbitrary row cap)
      console.log("   Querying all students in course scope");
      summary = await sql`
        SELECT 
          s.id as student_id,
          s.student_id as student_number,
          s.full_name,
          s.section as session,
          COALESCE(SUM(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.points ELSE 0 END), 0) as total_points,
          COUNT(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.id END) as award_count,
          MAX(CASE WHEN cp.status = 'approved' OR cp.status IS NULL THEN cp.awarded_at END) as last_awarded
        FROM students s
        LEFT JOIN classroom_points cp ON s.id = cp.student_id
          AND (cp.status = 'approved' OR cp.status IS NULL)
        WHERE 1 = 1
          ${studentScope}
        GROUP BY s.id, s.student_id, s.full_name, s.section
        ORDER BY total_points DESC, s.full_name ASC
        LIMIT 500
      `;
    }

    console.log("✅ [Classroom Points Summary API] Students fetched:", summary.length);
    console.log("   Sample student:", summary[0]);

    return NextResponse.json({
      summary,
      count: summary.length
    });

  } catch (error) {
    console.error("❌ [Classroom Points Summary API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch summary" },
      { status: 500 }
    );
  }
}

