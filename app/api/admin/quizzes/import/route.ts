import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const format = formData.get("format") as string

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const content = await file.text()
    let quizData: any

    if (format === "csv") {
      // Parse CSV
      const lines = content.split("\n").filter((line) => line.trim())
      const headers = lines[0]
        .split(",")
        .map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase())

      // Resolve by header name so files exported before "Option E" existed still
      // import correctly; fall back to the original fixed column order.
      const columnIndex = (name: string, legacyIndex: number) => {
        const found = headers.indexOf(name)
        return found === -1 ? legacyIndex : found
      }
      const idx = {
        question_text: columnIndex("question text", 0),
        option_a: columnIndex("option a", 1),
        option_b: columnIndex("option b", 2),
        option_c: columnIndex("option c", 3),
        option_d: columnIndex("option d", 4),
        option_e: headers.indexOf("option e"),
        correct_answer: columnIndex("correct answer", 5),
        question_type: columnIndex("question type", 6),
        time_limit: columnIndex("time limit", 7),
        tags: columnIndex("tags", 8),
      }

      const questions = []
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || []
        const cleanValues = values.map((v) => v.replace(/^"|"$/g, "").replace(/""/g, '"'))
        const at = (index: number) => (index >= 0 ? cleanValues[index] : undefined)

        questions.push({
          question_text: at(idx.question_text) || "",
          option_a: at(idx.option_a) || "",
          option_b: at(idx.option_b) || "",
          option_c: at(idx.option_c) || "",
          option_d: at(idx.option_d) || "",
          option_e: at(idx.option_e) || "",
          correct_answer: at(idx.correct_answer) || "A",
          question_type: at(idx.question_type) || "MCQ",
          time_limit: at(idx.time_limit) ? Number.parseInt(at(idx.time_limit)!) : null,
          tags: at(idx.tags)
            ? at(idx.tags)!
                .split(";")
                .map((t: string) => t.trim())
            : [],
        })
      }

      quizData = {
        quiz: {
          title: file.name.replace(/\.[^/.]+$/, ""),
          description: "Imported quiz",
          time_per_question: 60,
        },
        questions,
      }
    } else {
      // Parse JSON
      quizData = JSON.parse(content)
    }

    // Create quiz
    const quizResult = await sql`
      INSERT INTO quizzes (title, description, time_per_question, is_public, created_by)
      VALUES (${quizData.quiz.title}, ${quizData.quiz.description}, ${quizData.quiz.time_per_question}, false, 1)
      RETURNING id
    `

    const quizId = quizResult[0].id

    // Insert questions and tags
    for (let i = 0; i < quizData.questions.length; i++) {
      const q = quizData.questions[i]

      const questionResult = await sql`
        INSERT INTO quiz_questions (
          quiz_id, question_text, option_a, option_b, option_c, option_d, option_e, 
          correct_answer, question_type, question_order, time_limit
        )
        VALUES (
          ${quizId}, ${q.question_text}, ${q.option_a || null}, ${q.option_b || null}, 
          ${q.option_c || null}, ${q.option_d || null}, ${q.option_e || null}, ${q.correct_answer}, 
          ${q.question_type || "MCQ"}, ${i + 1}, ${q.time_limit || null}
        )
        RETURNING id
      `

      const questionId = questionResult[0].id

      // Add tags if present
      if (q.tags && q.tags.length > 0) {
        for (const tagName of q.tags) {
          if (!tagName) continue

          // Get or create tag
          const existingTag = await sql`
            SELECT id FROM tags WHERE name = ${tagName}
          `

          let tagId
          if (existingTag.length > 0) {
            tagId = existingTag[0].id
          } else {
            const newTag = await sql`
              INSERT INTO tags (name) VALUES (${tagName}) RETURNING id
            `
            tagId = newTag[0].id
          }

          // Link tag to question
          await sql`
            INSERT INTO question_tags (question_id, tag_id)
            VALUES (${questionId}, ${tagId})
            ON CONFLICT DO NOTHING
          `
        }
      }
    }

    return NextResponse.json({ quizId, message: "Quiz imported successfully" })
  } catch (error) {
    console.error("[v0] Failed to import quiz:", error)
    return NextResponse.json({ error: "Failed to import quiz" }, { status: 500 })
  }
}
