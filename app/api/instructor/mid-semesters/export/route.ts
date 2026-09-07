import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const examId = searchParams.get("exam_id")
    const format = searchParams.get("format") || "json"

    if (!examId) {
      return NextResponse.json({ error: "Exam ID is required" }, { status: 400 })
    }

    // Get instructor session from headers
    const authHeader = request.headers.get("authorization") || request.headers.get("cookie")
    
    // For now, fetch the exam without instructor validation
    // TODO: Add proper session-based instructor authentication
    const examData = await sql`
      SELECT * FROM quizzes 
      WHERE id = ${examId} AND assessment_type = 'mid_semester'
    `

    if (examData.length === 0) {
      return NextResponse.json({ error: "Mid-semester exam not found" }, { status: 404 })
    }

    const exam = examData[0]

    // Fetch questions
    const questions = await sql`
      SELECT 
        id,
        quiz_id,
        question_order,
        question_type,
        question_text,
        option_a,
        option_b,
        option_c,
        option_d,
        option_e,
        correct_answer,
        points,
        max_points,
        time_limit,
        hint,
        hint_penalty,
        sample_answers,
        ai_expected_solution,
        explanation,
        difficulty,
        topic,
        evaluation_mode,
        created_at
      FROM quiz_questions 
      WHERE quiz_id = ${examId} 
      ORDER BY question_order
    `

    if (format === "csv") {
      // CSV format
      const csvRows = [
        [
          "Order",
          "Type",
          "Question Text",
          "Option A",
          "Option B",
          "Option C",
          "Option D",
          "Option E",
          "Correct Answer",
          "Points",
          "Max Points",
          "Time Limit (s)",
          "Difficulty",
          "Topic",
          "Explanation",
        ].join(","),
      ]

      questions.forEach((q: any) => {
        csvRows.push(
          [
            q.question_order,
            q.question_type || "mcq",
            `"${(q.question_text || "").replace(/"/g, '""').replace(/\n/g, ' ')}"`,
            `"${(q.option_a || "").replace(/"/g, '""')}"`,
            `"${(q.option_b || "").replace(/"/g, '""')}"`,
            `"${(q.option_c || "").replace(/"/g, '""')}"`,
            `"${(q.option_d || "").replace(/"/g, '""')}"`,
            `"${(q.option_e || "").replace(/"/g, '""')}"`,
            `"${(q.correct_answer || "").replace(/"/g, '""')}"`,
            q.points || 1,
            q.max_points || q.points || 1,
            q.time_limit || exam.time_per_question || 60,
            q.difficulty || "medium",
            q.topic || "",
            `"${(q.explanation || "").replace(/"/g, '""').replace(/\n/g, ' ')}"`,
          ].join(","),
        )
      })

      const csvContent = csvRows.join("\n")

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${exam.title.replace(/[^a-z0-9]/gi, "_")}_export.csv"`,
        },
      })
    } else {
      // JSON format
      const exportData = {
        exam: {
          id: exam.id,
          title: exam.title,
          description: exam.description,
          coverage: exam.coverage,
          assessment_type: exam.assessment_type,
          time_per_question: exam.time_per_question,
          is_public: exam.is_public,
          available_from: exam.available_from,
          available_until: exam.available_until,
          retake_enabled: exam.retake_enabled,
          retake_limit: exam.retake_limit,
          retake_policy: exam.retake_policy,
          created_at: exam.created_at,
          updated_at: exam.updated_at,
        },
        questions: questions.map((q: any) => ({
          question_order: q.question_order,
          question_type: q.question_type || "mcq",
          question_text: q.question_text,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          option_e: q.option_e,
          correct_answer: q.correct_answer,
          points: q.points || 1,
          max_points: q.max_points || q.points || 1,
          time_limit: q.time_limit,
          hint: q.hint,
          hint_penalty: q.hint_penalty,
          sample_answers: q.sample_answers,
          ai_expected_solution: q.ai_expected_solution,
          explanation: q.explanation,
          difficulty: q.difficulty,
          topic: q.topic,
          evaluation_mode: q.evaluation_mode,
        })),
        metadata: {
          total_questions: questions.length,
          total_points: questions.reduce((sum: number, q: any) => sum + (q.points || 1), 0),
          export_date: new Date().toISOString(),
        },
      }

      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${exam.title.replace(/[^a-z0-9]/gi, "_")}_export.json"`,
        },
      })
    }
  } catch (error) {
    console.error("[Mid-Semester Export] Failed to export exam:", error)
    console.error("[Mid-Semester Export] Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      {
        error: "Failed to export mid-semester exam",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

