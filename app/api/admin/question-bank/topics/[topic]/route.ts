import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



// DELETE - Soft delete a topic and all its questions
export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function DELETE(request: Request, { params }: { params: { topic: string } }) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const topicName = decodeURIComponent(params.topic)
    console.log(`[v0] Soft deleting topic: ${topicName}`)

    // First, check if topic exists and get question count
    const questions = await sql`
      SELECT id FROM question_bank 
      WHERE topic = ${topicName}
      AND deleted_at IS NULL
    `

    if (questions.length === 0) {
      return NextResponse.json({ error: "Topic not found or has no active questions" }, { status: 404 })
    }

    const questionIds = questions.map((q) => q.id)
    console.log(`[v0] Found ${questionIds.length} questions to soft delete for topic: ${topicName}`)

    // Get admin info for deleted_by
    const adminSession = request.headers.get('admin-session')
    let deletedBy = 'admin'
    if (adminSession) {
      try {
        const adminInfo = await sql`
          SELECT username FROM admin_users WHERE session = ${adminSession}
        `
        if (adminInfo.length > 0) {
          deletedBy = adminInfo[0].username
        }
      } catch (error) {
        console.log("Could not get admin username:", error)
      }
    }

    // Soft delete all questions in this topic
    const deleteQuestions = await sql`
      UPDATE question_bank 
      SET deleted_at = NOW(), deleted_by = ${deletedBy}
      WHERE topic = ${topicName}
      AND deleted_at IS NULL
    `
    console.log(`[v0] Soft deleted ${questionIds.length} questions from topic: ${topicName}`)

    return NextResponse.json({
      success: true,
      topicName,
      questionsDeleted: questionIds.length,
      message: `Topic "${topicName}" and ${questionIds.length} question(s) moved to trash successfully`
    })
  } catch (error: any) {
    console.error("[v0] Failed to delete topic:", error.message)
    console.error("[v0] Error details:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
    })
    return NextResponse.json(
      {
        error: "Failed to delete topic",
        details: error.message,
      },
      { status: 500 },
    )
  }
}

// PATCH - Rename a topic
export async function PATCH(request: Request, { params }: { params: { topic: string } }) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const topicName = decodeURIComponent(params.topic)
    const { name: newName } = await request.json()

    if (!newName || !newName.trim()) {
      return NextResponse.json({ error: "New topic name is required" }, { status: 400 })
    }

    console.log(`[v0] Renaming topic from "${topicName}" to "${newName}"`)

    // Update all questions with this topic
    const result = await sql`
      UPDATE question_bank 
      SET topic = ${newName.trim()}
      WHERE topic = ${topicName}
    `

    console.log(`[v0] Updated ${result.length} questions`)

    return NextResponse.json({
      success: true,
      oldName: topicName,
      newName: newName.trim(),
      questionsUpdated: result.length,
    })
  } catch (error: any) {
    console.error("[v0] Failed to rename topic:", error.message)
    return NextResponse.json(
      {
        error: "Failed to rename topic",
        details: error.message,
      },
      { status: 500 },
    )
  }
}
