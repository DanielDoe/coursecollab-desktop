import { NextRequest, NextResponse } from "next/server"
import { requireCodebenchCoraStudent } from "@/lib/codebench-request-auth"
import { jsonFromCodebenchCoraError } from "@/lib/codebench-cora-usage"
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
    const { code, language = "cpp", studentId, learningMode = "intermediate" } = await request.json()

    const auth = await requireCodebenchCoraStudent(request, studentId != null ? String(studentId) : null)
    if (!auth.ok) return auth.response

    if (!code || !isOpenAIConfigured || !openai) {
      return NextResponse.json({ error: "Code and AI configuration required" }, { status: 400 })
    }

    const systemPrompt = `You are an expert ${language} code reviewer focusing on style, readability, and engineering best practices.

Return a JSON object with an "issues" array, where each item contains:
{
  "lineNumber": <line number>,
  "code": "<the actual line or code block>",
  "category": "naming" | "formatting" | "complexity" | "pattern" | "efficiency" | "comments",
  "severity": "info" | "warning" | "error",
  "issue": "<description of the issue>",
  "suggestion": "<how to fix it>",
  "principle": "<engineering principle violated, e.g., 'SRP: Single Responsibility Principle'>",
  "example": "<example of better code>"
}

${learningMode === "beginner"
  ? "Focus on basic style: naming conventions, formatting, simple comments."
  : learningMode === "expert"
  ? "Focus on advanced topics: cyclomatic complexity, design patterns, performance optimization, modern C++ features."
  : "Focus on intermediate topics: code organization, readability, common anti-patterns."}

Review the code for professional engineering standards.`

    const usageContext = {
      actor: { userId: auth.studentDbId, userRole: "student" as const },
      feature: "CODE_HELP" as const,
      module: "codebench-style-review",
      billable: true as const,
    }

    const { content } = await createForFeature(openai, "codebench", {

      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Review this ${language} code for style and readability:\n\n\`\`\`${language}\n${code}\n\`\`\``,
        },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
      usageContext,
    })
    if (!content) {
      return NextResponse.json({ error: "No review generated" }, { status: 500 })
    }

    try {
      const parsed = JSON.parse(content)
      return NextResponse.json({ issues: parsed.issues || [] })
    } catch (parseError) {
      console.error("Failed to parse style review:", parseError)
      return NextResponse.json({ error: "Failed to parse review" }, { status: 500 })
    }
  } catch (error) {
    console.error("Style review API error:", error)
    return jsonFromCodebenchCoraError(error, "Failed to review code")
  }
}


