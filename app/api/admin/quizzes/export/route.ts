import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const searchParams = request.nextUrl.searchParams
    const quizId = searchParams.get("quiz_id")
    const format = searchParams.get("format") || "json"

    if (!quizId) {
      return NextResponse.json({ error: "Quiz ID is required" }, { status: 400 })
    }

    // Fetch quiz data
    const quizData = await sql`
      SELECT * FROM quizzes WHERE id = ${quizId}
    `

    if (quizData.length === 0) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    const quiz = quizData[0]

    const questions = await sql`
      SELECT * FROM quiz_questions WHERE quiz_id = ${quizId} ORDER BY question_order
    `

    // Fetch tags for questions
    const questionIds = questions.map((q) => q.id)
    const tags =
      questionIds.length > 0
        ? await sql`
          SELECT qt.question_id, t.name as tag_name
          FROM question_tags qt
          JOIN tags t ON qt.tag_id = t.id
          WHERE qt.question_id = ANY(${questionIds})
        `
        : []

    // Group tags by question
    const tagsByQuestion: Record<number, string[]> = {}
    tags.forEach((tag: any) => {
      if (!tagsByQuestion[tag.question_id]) {
        tagsByQuestion[tag.question_id] = []
      }
      tagsByQuestion[tag.question_id].push(tag.tag_name)
    })

    if (format === "csv") {
      // CSV format
      const csvRows = [
        [
          "Question Text",
          "Option A",
          "Option B",
          "Option C",
          "Option D",
          "Option E",
          "Correct Answer",
          "Question Type",
          "Time Limit",
          "Tags",
        ].join(","),
      ]

      questions.forEach((q: any) => {
        const tags = tagsByQuestion[q.id] || []
        csvRows.push(
          [
            `"${q.question_text.replace(/"/g, '""')}"`,
            `"${q.option_a?.replace(/"/g, '""') || ""}"`,
            `"${q.option_b?.replace(/"/g, '""') || ""}"`,
            `"${q.option_c?.replace(/"/g, '""') || ""}"`,
            `"${q.option_d?.replace(/"/g, '""') || ""}"`,
            `"${q.option_e?.replace(/"/g, '""') || ""}"`,
            q.correct_answer,
            q.question_type || "MCQ",
            q.time_limit || "",
            `"${tags.join("; ")}"`,
          ].join(","),
        )
      })

      const csvContent = csvRows.join("\n")

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${quiz.title.replace(/[^a-z0-9]/gi, "_")}_export.csv"`,
        },
      })
    } else {
      // JSON format
      const exportData = {
        quiz: {
          title: quiz.title,
          description: quiz.description,
          time_limit: quiz.time_limit,
        },
        questions: questions.map((q: any) => ({
          question_text: q.question_text,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          option_e: q.option_e,
          correct_answer: q.correct_answer,
          question_type: q.question_type || "MCQ",
          time_limit: q.time_limit,
          tags: tagsByQuestion[q.id] || [],
        })),
      }

      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${quiz.title.replace(/[^a-z0-9]/gi, "_")}_export.json"`,
        },
      })
    }
  } catch (error) {
    console.error("[v0] Failed to export quiz:", error)
    return NextResponse.json({ error: "Failed to export quiz" }, { status: 500 })
  }
}
