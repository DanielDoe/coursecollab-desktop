import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET - Search students by name or ID
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query");
    const section = searchParams.get("section");

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: "Query must be at least 2 characters" },
        { status: 400 }
      );
    }

    let students;
    if (section) {
      students = await sql`
        SELECT s.id, s.full_name, s.student_id, sess.code as section
        FROM students s
        JOIN sessions sess ON s.session_id = sess.id
        WHERE sess.code = ${section}
          AND (
            s.full_name ILIKE ${`%${query}%`}
            OR s.student_id ILIKE ${`%${query}%`}
          )
        ORDER BY s.full_name
        LIMIT 20
      `;
    } else {
      students = await sql`
        SELECT s.id, s.full_name, s.student_id, sess.code as section
        FROM students s
        JOIN sessions sess ON s.session_id = sess.id
        WHERE s.full_name ILIKE ${`%${query}%`}
          OR s.student_id ILIKE ${`%${query}%`}
        ORDER BY s.full_name
        LIMIT 20
      `;
    }

    return NextResponse.json({
      success: true,
      students: students.map((s: any) => ({
        id: s.id,
        full_name: s.full_name,
        student_id: s.student_id,
        section: s.section,
      })),
    });
  } catch (error) {
    console.error("Error searching students:", error);
    return NextResponse.json(
      { error: "Failed to search students" },
      { status: 500 }
    );
  }
}
