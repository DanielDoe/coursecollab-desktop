import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireBoundStudentCaller, requireCallerStudentDbId } from "@/lib/student-api-auth"

export const dynamic = "force-dynamic"

function claimedStudentId(value: unknown): string | null {
  if (value == null) return null
  const text = String(value).trim()
  return text ? text : null
}

// GET - Fetch study goals
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const studentId = searchParams.get("studentId")

    const auth = await requireBoundStudentCaller(request, studentId)
    if (!auth.ok) return auth.response

    const goals = await sql`
      SELECT 
        id,
        goal_type,
        title,
        description,
        target_date,
        is_completed,
        progress,
        priority,
        topics,
        created_at,
        completed_at
      FROM study_goals
      WHERE student_id = ${auth.studentDbId}
      ORDER BY 
        is_completed ASC,
        CASE priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        target_date ASC
    `

    return NextResponse.json({
      success: true,
      goals
    })
  } catch (error: any) {
    console.error("[Study Goals GET Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch goals" },
      { status: 500 }
    )
  }
}

// POST - Create new study goal
export async function POST(request: NextRequest) {
  try {
    const {
      studentId,
      goalType = 'custom',
      title,
      description,
      targetDate,
      priority = 'medium',
      topics = []
    } = await request.json()

    const auth = await requireBoundStudentCaller(request, claimedStudentId(studentId))
    if (!auth.ok) return auth.response

    if (!title) {
      return NextResponse.json(
        { success: false, error: "title is required" },
        { status: 400 }
      )
    }

    const result = await sql`
      INSERT INTO study_goals (
        student_id,
        goal_type,
        title,
        description,
        target_date,
        priority,
        topics
      ) VALUES (
        ${auth.studentDbId},
        ${goalType},
        ${title},
        ${description || null},
        ${targetDate || null},
        ${priority},
        ${JSON.stringify(topics)}
      )
      RETURNING *
    `

    return NextResponse.json({
      success: true,
      goal: result[0]
    })
  } catch (error: any) {
    console.error("[Study Goals POST Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to create goal" },
      { status: 500 }
    )
  }
}

// PUT - Update study goal
export async function PUT(request: NextRequest) {
  try {
    const caller = await requireCallerStudentDbId(request)
    if (!caller.ok) return caller.response

    const {
      goalId,
      isCompleted,
      progress,
      title,
      description
    } = await request.json()

    if (!goalId) {
      return NextResponse.json(
        { success: false, error: "goalId is required" },
        { status: 400 }
      )
    }

    const existing = await sql`
      SELECT student_id FROM study_goals WHERE id = ${goalId} LIMIT 1
    `
    if (!existing.length || Number(existing[0].student_id) !== caller.studentDbId) {
      return NextResponse.json(
        { success: false, error: "Goal not found" },
        { status: 404 }
      )
    }

    const result = await sql`
      UPDATE study_goals
      SET 
        is_completed = COALESCE(${isCompleted}, is_completed),
        progress = COALESCE(${progress}, progress),
        title = COALESCE(${title}, title),
        description = COALESCE(${description}, description),
        completed_at = CASE WHEN ${isCompleted} = true THEN NOW() ELSE completed_at END
      WHERE id = ${goalId}
        AND student_id = ${caller.studentDbId}
      RETURNING *
    `

    if (!result.length) {
      return NextResponse.json(
        { success: false, error: "Goal not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      goal: result[0]
    })
  } catch (error: any) {
    console.error("[Study Goals PUT Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to update goal" },
      { status: 500 }
    )
  }
}
