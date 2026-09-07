import { NextRequest, NextResponse } from "next/server"
import { requireCodebenchStudent } from "@/lib/codebench-request-auth"
import { studioPromptBlock } from "@/lib/codebench-studio-analytics"
import { enrichReplaySteps, parseReplayStepsFromApi } from "@/lib/codebench-replay"
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
    const { code, language = "cpp", studentId, learningMode = "intermediate", studioContext } = await request.json()

    const auth = await requireCodebenchStudent(request, studentId != null ? String(studentId) : null)
    if (!auth.ok) return auth.response

    if (!code) {
      return NextResponse.json({ error: "Code required" }, { status: 400 })
    }

    const knownSteps = enrichReplaySteps(code, [])

    if (!isOpenAIConfigured || !openai) {
      return NextResponse.json({ steps: knownSteps })
    }

    const systemPrompt = `You are an expert ${language} instructor simulating line-by-line execution for students.
Return ONLY valid JSON: {"steps":[...]}

Each step MUST include:
- lineNumber (number)
- code (exact source line being executed)
- title (short, action-oriented, e.g. "Check loop condition")
- phase (one of: setup, loop, condition, body, update, output, return, call)
- concept (e.g. "Loop condition", "Variable update")
- explanation (2-4 complete sentences: what executes, why, what changes in memory)
- variables (object of ALL relevant names → current values after this step)
- changedVariables (array of names that changed this step)
- condition (optional, when evaluating if/loop)
- result (optional, outcome of condition)
- consoleOutput (optional, exact stdout if a print occurs)
- teachingNote (optional, one practical tip for beginners)
- bullets (optional, array of 1-3 short takeaway strings)
- deepInsight (optional, one paragraph connecting this step to broader CS concepts)

${learningMode === "beginner"
  ? "Use plain language. Explain like tutoring a first-year student. Never skip loop iterations — show each i value and sum update."
  : learningMode === "expert"
  ? "Include subtle notes on complexity and correctness where relevant."
  : "Be thorough: every loop iteration should appear as separate condition + body steps when the loop runs fewer than 8 times."}

Simulate REAL execution order. Minimum 8 steps for non-trivial programs. JSON only.${studioPromptBlock(studioContext)}`

    const { content } = await createForFeature(openai, "codebench", {
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Return {"steps":[...]} for this ${language} program:\n\n\`\`\`${language}\n${code}\n\`\`\``,
        },
      ],
      temperature: 0.35,
      max_tokens: 8192,
      response_format: { type: "json_object" },
    })

    if (!content) {
      return NextResponse.json({ steps: enrichReplaySteps(code, []) })
    }

    const parsed = parseReplayStepsFromApi(content)
    const steps = enrichReplaySteps(code, parsed)
    return NextResponse.json({ steps })
  } catch (error) {
    console.error("Replay API error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate replay" },
      { status: 500 },
    )
  }
}
