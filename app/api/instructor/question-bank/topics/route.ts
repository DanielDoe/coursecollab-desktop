import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorQuestionBankScope } from "@/lib/instructor-question-bank-scope"



// GET - List all topics with question counts
export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorQuestionBankScope(request)
    if (!scope.ok) return scope.response
    const { qbScope } = scope

    console.log("[v0] Fetching topics from question_bank...")

    const topics = await sql`
      SELECT 
        ROW_NUMBER() OVER (ORDER BY topic) as id,
        topic as name,
        NULL as description,
        MIN(created_at) as created_at,
        COUNT(*) as question_count
      FROM question_bank
      WHERE topic IS NOT NULL AND topic != ''
      AND deleted_at IS NULL
      AND (${qbScope})
      GROUP BY topic
      ORDER BY topic
    `

    console.log(`[v0] Successfully fetched ${topics.length} topics`)
    return NextResponse.json({ topics })
  } catch (error: any) {
    console.error("[v0] Failed to fetch topics - Database error:", error)
    console.error("[v0] Error details:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
    })
    return NextResponse.json(
      {
        error: "Failed to fetch topics",
        details: error.message,
      },
      { status: 500 },
    )
  }
}

/** Assign an existing topic label to one or more bank questions (creates the topic when first question is tagged). */
export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorQuestionBankScope(request)
    if (!scope.ok) return scope.response
    const { qbScope } = scope

    const body = await request.json()
    const name = String(body.name ?? "").trim()
    const questionIds = Array.isArray(body.questionIds)
      ? body.questionIds.map((id: unknown) => Number(id)).filter((id: number) => Number.isFinite(id))
      : []

    if (!name) {
      return NextResponse.json({ error: "Topic name is required" }, { status: 400 })
    }
    if (questionIds.length === 0) {
      return NextResponse.json({ error: "Select at least one question" }, { status: 400 })
    }

    const result = await sql`
      UPDATE question_bank
      SET topic = ${name}, updated_at = NOW()
      WHERE id = ANY(${questionIds}::int[])
        AND deleted_at IS NULL
        AND (${qbScope})
    `

    return NextResponse.json({
      success: true,
      topicName: name,
      questionsUpdated: result.length,
    })
  } catch (error: unknown) {
    console.error("[question-bank/topics POST]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to assign topic" },
      { status: 500 },
    )
  }
}

// DELETE - Soft delete all topics and questions
export async function DELETE(request: NextRequest) {
  try {
    const scope = await requireInstructorQuestionBankScope(request)
    if (!scope.ok) return scope.response
    const { qbScope } = scope

    // Get instructor info for deleted_by
    const instructorSession = request.headers.get('instructor-session')
    let deletedBy = 'instructor'
    if (instructorSession) {
      try {
        const instructorInfo = await sql`
          SELECT username FROM instructor_users WHERE session = ${instructorSession}
        `
        if (instructorInfo.length > 0) {
          deletedBy = instructorInfo[0].username
        }
      } catch (error) {
        console.log("Could not get instructor username:", error)
      }
    }

    // Soft delete all questions
    const result = await sql`
      UPDATE question_bank 
      SET deleted_at = NOW(), deleted_by = ${deletedBy}
      WHERE deleted_at IS NULL
        AND (${qbScope})
    `

    return NextResponse.json({ 
      success: true, 
      message: "All topics and questions moved to trash successfully",
      questionsDeleted: result.length
    })
  } catch (error: any) {
    console.error("[v0] Failed to clear all topics:", error)
    return NextResponse.json({ error: "Failed to clear all topics" }, { status: 500 })
  }
}

