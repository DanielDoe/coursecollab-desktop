import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import { normalizeImportOptionsForStorage } from "@/lib/question-type-schema"



const BATCH_SIZE = 10
const BATCH_DELAY_MS = 3000 // 3 seconds
const QUESTION_DELAY_MS = 300 // 300ms between each question

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function normalizeQuestion(q: any, defaultTopic: string) {
  console.log("[v0] Normalizing question:", JSON.stringify(q, null, 2))

  const type = q.type || q.question_type
  const question = q.question || q.question_text
  const difficulty = q.difficulty || "medium"
  const hint = q.hint || null

  console.log("[v0] Question type:", type, "Difficulty:", difficulty)

  let options: any[] = []

  if (type === "true_false") {
    const correctAnswer = q.correct_answer
    console.log("[v0] True/False question, correct answer (raw):", correctAnswer, "type:", typeof correctAnswer)

    // Handle both boolean and string inputs
    let correctAnswerStr: string
    if (typeof correctAnswer === "boolean") {
      correctAnswerStr = correctAnswer ? "True" : "False"
    } else {
      correctAnswerStr = String(correctAnswer)
    }

    console.log("[v0] True/False question, normalized answer:", correctAnswerStr)

    options = [
      { option_text: "True", is_correct: correctAnswerStr === "True" },
      { option_text: "False", is_correct: correctAnswerStr === "False" },
    ]
  } else if (
    type === "mcq" ||
    type === "code_output" ||
    type === "code_debug" ||
    type === "fill_code" ||
    type === "scenario_match"
  ) {
    // MCQ and code-based questions with single correct answer
    const correctAnswer = q.correct_answer || q.answer
    let optionsList = q.options || q.choices || []

    // If no options provided, generate them from correct answer
    if (optionsList.length === 0 && correctAnswer) {
      console.log(`[v0] ${type} question has no options, generating from correct answer:`, correctAnswer)

      // For code output questions, generate plausible wrong answers
      if (type === "code_output") {
        optionsList = [correctAnswer, "Compilation error", "Runtime error", "No output"]
      } else {
        // For other types, create at least 2 options
        optionsList = [correctAnswer, "Other"]
      }
    }

    console.log(`[v0] ${type} question, correct answer:`, correctAnswer, "Options:", optionsList)

    options = optionsList.map((opt: string) => ({
      option_text: opt,
      is_correct: opt === correctAnswer,
    }))
  } else if (type === "select_all" || type === "multi_output") {
    const correctAnswers = Array.isArray(q.correct_answer) ? q.correct_answer : [q.correct_answer]
    let optionsList = q.options || q.choices || []

    if (optionsList.length === 0 && correctAnswers.length > 0) {
      console.log(`[v0] ${type} question, generating options from correct answers:`, correctAnswers)
      // Add the correct answers plus some common wrong options
      optionsList = [...correctAnswers, "Compilation error", "Runtime error", "No output"]

      options = optionsList.map((opt: string) => ({
        option_text: opt,
        is_correct: correctAnswers.includes(opt),
      }))
    } else if (optionsList.length > 0) {
      console.log(`[v0] ${type} question, correct answers:`, correctAnswers, "Options:", optionsList)
      options = optionsList.map((opt: string) => ({
        option_text: opt,
        is_correct: correctAnswers.includes(opt),
      }))
    } else {
      // Fallback: use correct answers as all options
      options = correctAnswers.map((opt: string) => ({
        option_text: opt,
        is_correct: true,
      }))
    }
  } else if (type === "code_reorder") {
    const correctOrder = Array.isArray(q.correct_answer) ? q.correct_answer : []
    let optionsList = q.options || []

    // If no options provided, extract numbered lines from question text
    if (optionsList.length === 0 && question) {
      const lines = question.split("\n").filter((line: string) => /^\d+\)/.test(line.trim()))
      optionsList = lines.map((line: string) => line.trim())
      console.log("[v0] code_reorder question, extracted lines:", optionsList)
    }

    console.log("[v0] code_reorder question, correct order:", correctOrder, "Options:", optionsList)

    // Store the correct order as a comma-separated string in the first option
    // and store each line as additional options for display
    options = [
      { option_text: correctOrder.join(","), is_correct: true },
      ...optionsList.map((opt: string, idx: number) => ({
        option_text: opt,
        is_correct: false,
      })),
    ]
  } else if (type === "trace_logic") {
    // Trace logic - typically has a text answer
    const correctAnswer = q.correct_answer || q.answer
    console.log("[v0] trace_logic question, correct answer:", correctAnswer)

    // Create options with the correct answer and some dummy options for validation
    options = [
      { option_text: correctAnswer, is_correct: true },
      { option_text: "Other", is_correct: false },
    ]
  } else if (q.options && Array.isArray(q.options) && typeof q.options[0] === "object") {
    console.log("[v0] Options already in object format")
    options = q.options
  }

  console.log("[v0] Normalized options:", options)

  return {
    question_text: question,
    question_type: type,
    difficulty,
    topic: defaultTopic,
    hint,
    options,
  }
}

export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  console.log("[v0] Import API called")

  try {
    const body = await request.json()
    console.log("[v0] Request body received, questions count:", body.questions?.length, "Topic:", body.topic)

    const { questions, topic } = body

    if (!questions || !Array.isArray(questions)) {
      console.log("[v0] Invalid questions data:", typeof questions)
      return NextResponse.json({ error: "Invalid questions data" }, { status: 400 })
    }

    if (!topic || typeof topic !== "string" || !topic.trim()) {
      console.log("[v0] Topic validation failed:", topic)
      return NextResponse.json({ error: "Topic is required for importing questions" }, { status: 400 })
    }

    const topicName = topic.trim()
    console.log("[v0] Processing topic:", topicName)
    let topicId: number

    try {
      const existingTopic = await sql`
        SELECT id FROM question_bank_topics WHERE name = ${topicName}
      `
      console.log("[v0] Existing topic query result:", existingTopic)

      if (existingTopic.length > 0) {
        topicId = existingTopic[0].id
        console.log("[v0] Using existing topic ID:", topicId)
      } else {
        const [newTopic] = await sql`
          INSERT INTO question_bank_topics (name)
          VALUES (${topicName})
          RETURNING id
        `
        topicId = newTopic.id
        console.log("[v0] Created new topic with ID:", topicId)
      }
    } catch (dbError) {
      console.error("[v0] Database error while handling topic:", dbError)
      throw dbError
    }

    let imported = 0
    let failed = 0
    let skipped = 0
    const errors: string[] = []

    console.log("[v0] Starting batch processing:", questions.length, "questions in batches of", BATCH_SIZE)

    for (let batchStart = 0; batchStart < questions.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, questions.length)
      const batch = questions.slice(batchStart, batchEnd)
      const batchNumber = Math.floor(batchStart / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(questions.length / BATCH_SIZE)

      console.log(`[v0] Processing batch ${batchNumber}/${totalBatches} (questions ${batchStart + 1}-${batchEnd})`)

      // Process each question in the current batch
      for (let i = 0; i < batch.length; i++) {
        const q = batch[i]
        const questionNumber = batchStart + i + 1
        console.log(`[v0] Processing question ${questionNumber}/${questions.length}`)

        try {
          const normalized = normalizeQuestion(q, topicName)
          console.log("[v0] Normalized question:", normalized.question_text?.substring(0, 50))

          // Validate required fields
          if (
            !normalized.question_text ||
            !normalized.question_type ||
            !normalized.options ||
            normalized.options.length < 2
          ) {
            console.log("[v0] Validation failed for question")
            failed++
            errors.push(`Skipped invalid question: ${normalized.question_text?.substring(0, 50) || "Unknown"}`)
            continue
          }

          // Check if at least one option is correct
          const hasCorrect = normalized.options.some((opt: any) => opt.is_correct)
          if (!hasCorrect) {
            console.log("[v0] No correct answer found for question")
            failed++
            errors.push(`Skipped question without correct answer: ${normalized.question_text.substring(0, 50)}`)
            continue
          }

          console.log("[v0] Checking for duplicate question...")
          const existingQuestion = await sql`
            SELECT id FROM question_bank 
            WHERE question_text = ${normalized.question_text} 
            AND topic_id = ${topicId}
          `

          if (existingQuestion.length > 0) {
            console.log("[v0] Question already exists, skipping:", existingQuestion[0].id)
            skipped++
            continue
          }

          console.log("[v0] Inserting question into database...")
          const storage = normalizeImportOptionsForStorage(normalized.options, normalized.question_type)
          const [newQuestion] = await sql`
            INSERT INTO question_bank (
              question_text,
              question_type,
              difficulty,
              topic,
              topic_id,
              hint,
              options,
              correct_answer
            ) VALUES (
              ${normalized.question_text},
              ${normalized.question_type},
              ${normalized.difficulty},
              ${normalized.topic},
              ${topicId},
              ${normalized.hint},
              ${JSON.stringify(storage.options)}::jsonb,
              ${JSON.stringify(storage.correct_answer ?? "")}::jsonb
            )
            RETURNING id
          `
          console.log("[v0] Question inserted with ID:", newQuestion.id, "with canonical options schema")

          imported++

          if (i < batch.length - 1) {
            console.log(`[v0] Waiting ${QUESTION_DELAY_MS}ms before next question...`)
            await delay(QUESTION_DELAY_MS)
          }
        } catch (error) {
          console.error("[v0] Failed to import question:", error)
          failed++
          errors.push(
            `Failed to import: ${q.question?.substring(0, 50) || q.question_text?.substring(0, 50) || "Unknown"}`,
          )
        }
      }

      if (batchEnd < questions.length) {
        console.log(`[v0] Batch ${batchNumber} complete. Waiting ${BATCH_DELAY_MS}ms before next batch...`)
        await delay(BATCH_DELAY_MS)
      }
    }

    console.log("[v0] Import completed. Imported:", imported, "Skipped:", skipped, "Failed:", failed)
    if (errors.length > 0) {
      console.log("[v0] Errors:", errors)
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      failed,
      errors: errors.slice(0, 10),
    })
  } catch (error) {
    console.error("[v0] Import error:", error)
    console.error("[v0] Error stack:", error instanceof Error ? error.stack : "No stack")
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to import questions",
      },
      { status: 500 },
    )
  }
}
