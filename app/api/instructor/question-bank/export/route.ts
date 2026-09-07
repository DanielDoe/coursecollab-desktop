import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const instructorId = request.nextUrl.searchParams.get("instructorId")
    const format = request.nextUrl.searchParams.get("format") || "json"
    
    if (!instructorId) {
      return NextResponse.json({ error: "Instructor ID required" }, { status: 400 })
    }

    const questions = await sql`
      SELECT 
        question_text,
        question_type,
        difficulty,
        topic,
        tags,
        question_data,
        created_at
      FROM questions 
      WHERE instructor_id = ${instructorId}
      ORDER BY created_at DESC
    `

    if (format === "csv") {
      // Convert to CSV format
      const csvHeaders = "Question Text,Type,Difficulty,Topic,Tags,Created At\n"
      const csvRows = questions.map(q => 
        `"${q.question_text}","${q.question_type}","${q.difficulty}","${q.topic}","${q.tags}","${q.created_at}"`
      ).join("\n")
      
      return new NextResponse(csvHeaders + csvRows, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": "attachment; filename=questions.csv"
        }
      })
    }

    return NextResponse.json({ questions })
  } catch (error) {
    console.error("Error exporting questions:", error)
    return NextResponse.json({ error: "Failed to export questions" }, { status: 500 })
  }
}

