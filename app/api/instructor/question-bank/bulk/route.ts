import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    const instructorId = request.nextUrl.searchParams.get("instructorId")
    const body = await request.json()
    
    if (!instructorId) {
      return NextResponse.json({ error: "Instructor ID required" }, { status: 400 })
    }

    const { questions } = body

    if (!questions || !Array.isArray(questions)) {
      return NextResponse.json({ error: "Questions array required" }, { status: 400 })
    }

    const insertedQuestions = []
    
    for (const question of questions) {
      const result = await sql`
        INSERT INTO questions (
          question_text, question_type, difficulty, topic, tags, question_data, instructor_id
        ) VALUES (
          ${question.question_text}, ${question.question_type}, ${question.difficulty}, 
          ${question.topic}, ${JSON.stringify(question.tags || [])}, 
          ${JSON.stringify(question.question_data)}, ${instructorId}
        ) RETURNING *
      `
      insertedQuestions.push(result[0])
    }

    return NextResponse.json({ 
      message: `${insertedQuestions.length} questions imported successfully`,
      questions: insertedQuestions 
    })
  } catch (error) {
    console.error("Error importing questions:", error)
    return NextResponse.json({ error: "Failed to import questions" }, { status: 500 })
  }
}

