import { NextRequest, NextResponse } from "next/server"
import { requireCodebenchStudent } from "@/lib/codebench-request-auth"
import { createForFeature } from "@/lib/resolve-feature-ai-model"
import OpenAI from "openai"

const isOpenAIConfigured = !!process.env.OPENAI_API_KEY
const openai = isOpenAIConfigured
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null

export async function POST(request: NextRequest) {
  try {
    const { code, language = "cpp", studentId, question, learningMode = "intermediate" } = await request.json()

    const auth = await requireCodebenchStudent(request, studentId != null ? String(studentId) : null)
    if (!auth.ok) return auth.response

    if (!code || !question || !isOpenAIConfigured || !openai) {
      return NextResponse.json({ error: "Code, question, and AI configuration required" }, { status: 400 })
    }

    const systemPrompt = `You are an expert ${language} code simulator. Answer "What if?" questions by simulating code changes.

Return a JSON object with a "scenarios" array, where each item contains:
{
  "id": "<unique id>",
  "question": "<the what-if question>",
  "change": "<description of the change>",
  "outcome": "<what happens when this change is made>",
  "explanation": "<detailed explanation of why this happens>",
  "codeSnippet": "<modified code snippet if applicable>",
  "variables": { "<var_name>": <value> },
  "warnings": ["<warning1>", "<warning2>"]
}

${learningMode === "beginner"
  ? "Use simple language and visual descriptions. Focus on understanding the basics."
  : learningMode === "expert"
  ? "Focus on performance implications, edge cases, and advanced consequences."
  : "Explain algorithmic and logical consequences clearly."}

Simulate the scenario and explain the outcomes clearly.`

    const { content } = await createForFeature(openai, "codebench", {

      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Original code:\n\`\`\`${language}\n${code}\n\`\`\`\n\nQuestion: ${question}`,
        },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    })
    if (!content) {
      return NextResponse.json({ error: "No simulation generated" }, { status: 500 })
    }

    try {
      const parsed = JSON.parse(content)
      return NextResponse.json({ scenarios: parsed.scenarios || [] })
    } catch (parseError) {
      console.error("Failed to parse what-if:", parseError)
      return NextResponse.json({ error: "Failed to parse simulation" }, { status: 500 })
    }
  } catch (error) {
    console.error("What-if API error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to simulate scenario" },
      { status: 500 }
    )
  }
}


