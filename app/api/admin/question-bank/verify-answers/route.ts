import { NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import { createForFeature } from "@/lib/resolve-feature-ai-model"
import OpenAI from "openai"


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { topicName } = await request.json()

    if (!topicName) {
      return NextResponse.json({ error: "Topic name required" }, { status: 400 })
    }

    // Fetch all questions in this topic
    const questions = await sql`
      SELECT 
        id,
        question_text,
        question_type,
        options,
        correct_answer,
        explanation
      FROM question_bank
      WHERE topic = ${topicName}
        AND deleted_at IS NULL
      ORDER BY id
    `

    if (questions.length === 0) {
      return NextResponse.json({
        success: true,
        results: [],
        message: "No questions found in this topic"
      })
    }

    console.log(`[AI Verify] Processing ${questions.length} questions in topic "${topicName}"`)

    // Process questions in batches to avoid overwhelming the API
    const batchSize = 5
    const results = []

    for (let i = 0; i < questions.length; i += batchSize) {
      const batch = questions.slice(i, Math.min(i + batchSize, questions.length))
      
      console.log(`[AI Verify] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(questions.length/batchSize)}`)

      const batchResults = await Promise.all(
        batch.map(async (question) => {
          try {
            // Only verify MCQ, True/False, and Select All questions
            if (!['mcq', 'true_false', 'select_all'].includes(question.question_type)) {
              return {
                questionId: question.id,
                questionText: question.question_text,
                questionType: question.question_type,
                currentAnswer: question.correct_answer,
                needsUpdate: false,
                skipped: true,
                reason: "Question type not suitable for automated verification"
              }
            }

            // Prepare options for AI (parse from JSONB)
            const options = []
            try {
              const optionsData = typeof question.options === 'string' 
                ? JSON.parse(question.options) 
                : question.options
              
              if (optionsData && typeof optionsData === 'object') {
                if (optionsData.A || optionsData.a) options.push(`A: ${optionsData.A || optionsData.a}`)
                if (optionsData.B || optionsData.b) options.push(`B: ${optionsData.B || optionsData.b}`)
                if (optionsData.C || optionsData.c) options.push(`C: ${optionsData.C || optionsData.c}`)
                if (optionsData.D || optionsData.d) options.push(`D: ${optionsData.D || optionsData.d}`)
                if (optionsData.E || optionsData.e) options.push(`E: ${optionsData.E || optionsData.e}`)
              }
            } catch (error) {
              console.log(`[AI Verify] Could not parse options for Q${question.id}`)
            }

            // Create prompt for AI
            const prompt = `You are a C++ programming expert. Analyze this question and determine the correct answer.

Question Type: ${question.question_type}
Question: ${question.question_text}

${options.length > 0 ? `Options:\n${options.join('\n')}` : ''}

Current Answer in Database: ${question.correct_answer}

Instructions:
1. Carefully analyze the question and code (if present)
2. Determine the correct answer
3. Compare with the current answer in the database
4. Respond ONLY in this JSON format:
{
  "correct_answer": "X",
  "is_current_correct": true/false,
  "reasoning": "Brief explanation of why this is the correct answer"
}

For ${question.question_type === 'select_all' ? 'select_all questions, provide the answer as a JSON array like ["A", "B"]' : 'single-choice questions, provide just the letter (A, B, C, D, or E)'}
For true_false questions, A = True, B = False

Be precise and factual. Only suggest changes if you're certain the current answer is wrong.`

            // Call ChatGPT
            const { content: aiContent } = await createForFeature(openai, "verify_answers", {

              messages: [
                {
                  role: "system",
                  content: "You are a C++ programming expert helping to verify quiz question answers. Be precise and only suggest changes when you're certain."
                },
                {
                  role: "user",
                  content: prompt
                }
              ],
              temperature: 0.1,
              max_tokens: 500,
              response_format: { type: "json_object" }
            })

            const aiResponse = JSON.parse(aiContent || "{}")

            // Normalize answers for comparison
            const normalizeAnswer = (ans: any, type: string) => {
              if (type === 'select_all') {
                try {
                  // Handle jsonb column that might already be parsed
                  let parsed = ans
                  if (typeof ans === 'string') {
                    parsed = JSON.parse(ans)
                  }
                  return Array.isArray(parsed) ? parsed.sort() : [String(parsed)]
                } catch {
                  return [String(ans)]
                }
              }
              // For single choice, extract the value if it's jsonb
              let value = ans
              if (typeof ans === 'object' && ans !== null) {
                // If it's a jsonb object, try to extract a value
                value = ans.answer || ans.value || JSON.stringify(ans)
              }
              return typeof value === 'string' ? value.trim().toUpperCase() : String(value).trim().toUpperCase()
            }

            const currentNormalized = normalizeAnswer(question.correct_answer, question.question_type)
            const suggestedNormalized = normalizeAnswer(aiResponse.correct_answer, question.question_type)

            const needsUpdate = question.question_type === 'select_all'
              ? JSON.stringify(currentNormalized) !== JSON.stringify(suggestedNormalized)
              : currentNormalized !== suggestedNormalized

            return {
              questionId: question.id,
              questionText: question.question_text,
              questionType: question.question_type,
              questionOrder: i + batch.indexOf(question) + 1,
              currentAnswer: question.correct_answer,
              suggestedAnswer: aiResponse.correct_answer,
              needsUpdate: needsUpdate,
              reasoning: aiResponse.reasoning,
              confidence: aiResponse.is_current_correct ? "high" : "review_needed"
            }

          } catch (error) {
            console.error(`[AI Verify] Error verifying question ${question.id}:`, error)
            return {
              questionId: question.id,
              questionText: question.question_text,
              questionType: question.question_type,
              currentAnswer: question.correct_answer,
              needsUpdate: false,
              error: error instanceof Error ? error.message : "Verification failed",
              skipped: true
            }
          }
        })
      )

      results.push(...batchResults)

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < questions.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    // Summary
    const needsUpdate = results.filter(r => r.needsUpdate)
    const verified = results.filter(r => !r.needsUpdate && !r.skipped)
    const skipped = results.filter(r => r.skipped)

    console.log(`[AI Verify] Complete: ${needsUpdate.length} need update, ${verified.length} verified, ${skipped.length} skipped`)

    return NextResponse.json({
      success: true,
      results: results,
      summary: {
        total: questions.length,
        verified: verified.length,
        needsUpdate: needsUpdate.length,
        skipped: skipped.length
      }
    })

  } catch (error) {
    console.error("[AI Verify] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to verify answers"
      },
      { status: 500 }
    )
  }
}


