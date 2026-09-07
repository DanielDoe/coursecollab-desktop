import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = sessionStorage.getItem("adminId")
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch all questions for export
    const questions = await sql`
      SELECT 
        question_text,
        question_type,
        options,
        correct_answer,
        explanation,
        difficulty,
        topic,
        points,
        tags,
        created_at
      FROM questions
      WHERE is_archived = false
      ORDER BY created_at DESC
    `

    // Format for export
    const exportData = {
      exportDate: new Date().toISOString(),
      totalQuestions: questions.length,
      questions: questions.map((q: any) => ({
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        difficulty: q.difficulty,
        topic: q.topic,
        points: q.points,
        tags: q.tags || [],
        created_at: q.created_at,
      }))
    }

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="questions-export-${new Date().toISOString().split('T')[0]}.json"`
      }
    })
  } catch (error) {
    console.error("Failed to export questions:", error)
    return NextResponse.json({ error: "Failed to export questions" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = sessionStorage.getItem("adminId")
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const text = await file.text()
    let importData

    try {
      importData = JSON.parse(text)
    } catch (error) {
      return NextResponse.json({ error: "Invalid JSON file" }, { status: 400 })
    }

    if (!importData.questions || !Array.isArray(importData.questions)) {
      return NextResponse.json({ error: "Invalid file format" }, { status: 400 })
    }

    let importedCount = 0
    let errorCount = 0

    for (const question of importData.questions) {
      try {
        await sql`
          INSERT INTO questions (
            question_text, question_type, options, correct_answer,
            explanation, difficulty, topic, points, tags, created_by
          ) VALUES (
            ${question.question_text}, ${question.question_type}, 
            ${JSON.stringify(question.options || [])}, ${question.correct_answer},
            ${question.explanation || ''}, ${question.difficulty}, 
            ${question.topic}, ${question.points || 1}, 
            ${JSON.stringify(question.tags || [])}, ${adminId}
          )
        `
        importedCount++
      } catch (error) {
        console.error("Failed to import question:", error)
        errorCount++
      }
    }

    return NextResponse.json({ 
      message: `Import completed`,
      imported: importedCount,
      errors: errorCount
    })
  } catch (error) {
    console.error("Failed to import questions:", error)
    return NextResponse.json({ error: "Failed to import questions" }, { status: 500 })
  }
}