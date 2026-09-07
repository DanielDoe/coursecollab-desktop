import { type NextRequest, NextResponse } from "next/server"
import { createForFeature } from "@/lib/resolve-feature-ai-model"
import { sql } from "@/lib/db"
import OpenAI from "openai"



interface SampleAnswer {
  approach: string
  description: string
  code: string
}

export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    const { questionId, questionText, questionType, correctAnswer, hint } = await request.json()

    if (!questionId || !questionText || !questionType) {
      return NextResponse.json({ 
        error: "Missing required fields: questionId, questionText, and questionType are required" 
      }, { status: 400 })
    }

    // Check if OpenAI API key is configured
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        error: "OpenAI API key not configured"
      }, { status: 500 })
    }

    // Only generate sample answers for AI-gradable question types
    const aiGradableTypes = ['code_write', 'code_explain', 'code_problem', 'debug_code', 'code_debug']
    if (!aiGradableTypes.includes(questionType.toLowerCase())) {
      return NextResponse.json({
        error: "Sample answers can only be generated for AI-gradable question types"
      }, { status: 400 })
    }

    console.log("[Sample Answers] Generating sample answers for question:", questionId)

    // Build the prompt for generating sample answers
    const prompt = buildSampleAnswersPrompt(questionType, questionText, correctAnswer, hint)

    const openai = new OpenAI({ apiKey: apiKey })
    const { content: resultText } = await createForFeature(openai, "question_generation", {

      messages: [
        {
          role: "system",
          content: `You are an expert programming instructor creating sample solutions for students. 
You must provide 2-3 different approaches to solve the same problem, ranging from basic to advanced.

IMPORTANT: You MUST respond with valid JSON only. No markdown, no code blocks, just pure JSON.

Your response must follow this exact JSON structure:
{
  "sampleAnswers": [
    {
      "approach": "Basic",
      "description": "Simple, straightforward solution",
      "code": "complete working code here"
    },
    {
      "approach": "Intermediate", 
      "description": "Solution with some improvements",
      "code": "complete working code here"
    },
    {
      "approach": "Advanced",
      "description": "Robust solution with best practices",
      "code": "complete working code here"
    }
  ]
}

Guidelines:
1. Provide 2-3 different approaches (Basic, Intermediate, Advanced)
2. Each approach should be complete, working code
3. Show progression from simple to more sophisticated
4. Use clear, educational variable names
5. Include proper includes and main function where needed
6. Make each solution educational and easy to understand
7. Focus on teaching good programming practices`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    })
    
    console.log("[Sample Answers] Raw AI response:", resultText)

    // Parse the AI response
    let sampleAnswers: SampleAnswer[]
    try {
      const parsed = JSON.parse(resultText)
      console.log("[Sample Answers] Parsed response:", parsed)
      
      // Handle different response formats
      if (Array.isArray(parsed)) {
        sampleAnswers = parsed
      } else if (parsed.samples && Array.isArray(parsed.samples)) {
        sampleAnswers = parsed.samples
      } else if (parsed.sampleAnswers && Array.isArray(parsed.sampleAnswers)) {
        sampleAnswers = parsed.sampleAnswers
      } else {
        // Try to extract array from any property
        const arrayProperty = Object.values(parsed).find(val => Array.isArray(val))
        if (arrayProperty && Array.isArray(arrayProperty)) {
          sampleAnswers = arrayProperty
        } else {
          throw new Error("No array found in response")
        }
      }
    } catch (parseError) {
      console.error("[Sample Answers] Failed to parse AI response:", parseError)
      console.error("[Sample Answers] Raw response:", resultText)
      throw new Error("Failed to parse AI response")
    }

    // Validate the sample answers structure
    if (!Array.isArray(sampleAnswers) || sampleAnswers.length === 0) {
      throw new Error("Invalid sample answers format")
    }

    // Ensure each sample answer has required fields
    sampleAnswers = sampleAnswers.map((answer, index) => ({
      approach: answer.approach || `Approach ${index + 1}`,
      description: answer.description || "Sample solution",
      code: answer.code || ""
    }))

    console.log("[Sample Answers] Generated", sampleAnswers.length, "sample answers")

    // Store the sample answers in the database
    await sql`
      UPDATE quiz_questions 
      SET sample_answers = ${JSON.stringify(sampleAnswers)}
      WHERE id = ${questionId}
    `

    console.log("[Sample Answers] Sample answers saved to database for question:", questionId)

    return NextResponse.json({
      success: true,
      sampleAnswers,
      message: `Generated ${sampleAnswers.length} sample answers successfully`
    })

  } catch (error) {
    console.error("[Sample Answers] Fatal error:", error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Failed to generate sample answers"
      },
      { status: 500 }
    )
  }
}

function buildSampleAnswersPrompt(
  questionType: string,
  questionText: string,
  correctAnswer?: string,
  hint?: string
): string {
  let prompt = `Question Type: ${questionType}\n\n`
  prompt += `Question:\n${questionText}\n\n`

  if (correctAnswer) {
    prompt += `Expected Output/Solution:\n${correctAnswer}\n\n`
  }

  if (hint) {
    prompt += `Hint/Rubric:\n${hint}\n\n`
  }

  prompt += `Please generate 2-3 different sample solutions for this question showing different approaches:

1. Basic Approach: Simple, straightforward solution that solves the problem correctly
2. Intermediate Approach: Solution with some improvements like error handling or better structure  
3. Advanced Approach: Robust solution with best practices, validation, and documentation

Each solution should be complete, working code that students can learn from. Make sure to show progression from simple to sophisticated approaches.

Remember to respond with valid JSON only, following the exact structure specified in the system prompt.`

  return prompt
}
