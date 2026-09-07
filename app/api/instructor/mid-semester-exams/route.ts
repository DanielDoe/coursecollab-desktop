import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { normalizeSessionAccessRecordToCanonical } from "@/lib/resolve-session-by-code"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const instructorId = request.nextUrl.searchParams.get("instructorId")
    
    if (!instructorId) {
      return NextResponse.json({ error: "Instructor ID required" }, { status: 400 })
    }

    const midSemesters = await sql`
      SELECT 
        q.*,
        COUNT(qa.id) as total_attempts,
        AVG(qa.score) as average_score,
        COUNT(CASE WHEN qa.completed_at IS NOT NULL THEN 1 END) as completion_count
      FROM quizzes q
      LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id
      WHERE q.instructor_id = ${instructorId} AND q.assessment_type = 'mid_semester'
      GROUP BY q.id
      ORDER BY q.created_at DESC
    `

    return NextResponse.json({ midSemesters })
  } catch (error) {
    console.error("Error fetching mid-semester exams:", error)
    return NextResponse.json({ error: "Failed to fetch mid-semester exams" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const instructorId = request.nextUrl.searchParams.get("instructorId")
    const body = await request.json()
    
    if (!instructorId) {
      return NextResponse.json({ error: "Instructor ID required" }, { status: 400 })
    }

    const {
      title,
      description,
      time_per_question,
      retake_limit,
      difficulty,
      topic,
      session_access,
      questions,
      exam_date
    } = body

    const normalizedSessionAccess = await normalizeSessionAccessRecordToCanonical(
      session_access as Record<string, boolean> | undefined,
    )

    const midSemester = await sql`
      INSERT INTO quizzes (
        title, description, assessment_type, instructor_id,
        time_per_question, retake_limit, difficulty, topic,
        session_access, question_count, is_active, is_saved,
        available_from, available_until
      ) VALUES (
        ${title}, ${description}, 'mid_semester', ${instructorId},
        ${time_per_question}, ${retake_limit}, ${difficulty}, ${topic},
        ${JSON.stringify(normalizedSessionAccess)}, ${questions.length}, true, true,
        ${exam_date || 'NOW()'}, ${exam_date ? `'${exam_date}'::timestamp + INTERVAL '3 hours'` : 'NOW() + INTERVAL \'3 hours\''}
      ) RETURNING *
    `

    const midSemesterId = midSemester[0].id

    // Batch create session access records (1 insert instead of 2N queries)
    const sessionCodes = Object.keys(normalizedSessionAccess)
    if (sessionCodes.length > 0) {
      const sessionAccessJson = JSON.stringify(normalizedSessionAccess)
      await sql`
        INSERT INTO quiz_session_access (quiz_id, session_id, is_active, updated_at)
        SELECT ${midSemesterId}, s.id, (${sessionAccessJson}::jsonb->>s.code)::boolean, CURRENT_TIMESTAMP
        FROM sessions s
        WHERE s.code = ANY(${sessionCodes})
        ON CONFLICT (quiz_id, session_id) DO UPDATE SET
          is_active = EXCLUDED.is_active,
          updated_at = CURRENT_TIMESTAMP
      `
    }

    return NextResponse.json({ midSemester: midSemester[0] })
  } catch (error) {
    console.error("Error creating mid-semester exam:", error)
    return NextResponse.json({ error: "Failed to create mid-semester exam" }, { status: 500 })
  }
}

