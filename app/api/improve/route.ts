import { type NextRequest, NextResponse } from "next/server"
import { requireCodebenchStudent } from "@/lib/codebench-request-auth"
import { studioPromptBlock } from "@/lib/codebench-studio-analytics"
import { createForFeature } from "@/lib/resolve-feature-ai-model"
import OpenAI from "openai"

const isOpenAIConfigured = !!process.env.OPENAI_API_KEY
const openai = isOpenAIConfigured ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const { code, language = "cpp", studentId, studioContext } = await request.json()

    const auth = await requireCodebenchStudent(request, studentId != null ? String(studentId) : null)
    if (!auth.ok) return auth.response

    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 })
    }

    if (!isOpenAIConfigured || !openai) {
      return NextResponse.json({
        improvedCode: code,
        diffSummary: "AI improvement is not configured.",
        principles: [],
      })
    }

    const usageContext = {
      actor: { userId: auth.studentDbId, userRole: "student" as const },
      feature: "CODE_HELP" as const,
      module: "codebench-improve",
    }

    const { content: completionContent } = await createForFeature(openai, "codebench", {
      usageContext,
      messages: [
        {
          role: "system",
          content: `You are an expert ${language} code reviewer and educator. GUIDE students to improve their code themselves. DO NOT write complete improved code for them.

CRITICAL RULES:
- NEVER write complete improved code implementations
- Explain best practices with visual comparisons
- Use before/after examples (conceptual, not full code)
- Provide GUIDANCE on what to improve and WHY
- Ask: "How could you make this more efficient?"
- If asked for complete code: "I'll explain the concept, then you implement it!"

Format your response as JSON:
{
  "improvedCode": "DO NOT provide complete improved code - provide only small code snippets showing IMPROVEMENTS for specific sections, not the entire program",
  "diffSummary": "summary of areas to improve with explanations and guidance on how to improve them. Use markdown with ✅ for good practices, ❌ for areas to improve, and visual comparisons.",
  "principles": ["principle1 with explanation", "principle2 with explanation", ...]
}

Focus on teaching code improvement principles, not writing improved code for them.${studioPromptBlock(studioContext)}`,
        },
        {
          role: "user",
          content: `Please improve this ${language} code using best practices:\n\n\`\`\`${language}\n${code}\n\`\`\``,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    })

    let response
    try {
      response = JSON.parse(completionContent || "{}")
    } catch (parseError) {
      console.error("[Improve API] JSON parse error:", parseError)
      return NextResponse.json({
        improvedCode: code,
        diffSummary: "Failed to parse improvement response. Please try again.",
        principles: [],
      })
    }

    return NextResponse.json({
      improvedCode: response.improvedCode || code,
      diffSummary: response.diffSummary || "No changes suggested.",
      principles: response.principles || [],
    })
  } catch (error) {
    console.error("[Improve API] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to improve code" },
      { status: 500 }
    )
  }
}

