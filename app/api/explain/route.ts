import { type NextRequest, NextResponse } from "next/server"
import { requireCodebenchCoraStudent } from "@/lib/codebench-request-auth"
import { codebenchUsageContext, jsonFromCodebenchCoraError } from "@/lib/codebench-cora-usage"
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
    const { code, language = "cpp", studentId, learningMode = "intermediate" } = await request.json()

    const auth = await requireCodebenchCoraStudent(request, studentId != null ? String(studentId) : null)
    if (!auth.ok) return auth.response

    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 })
    }

    if (!isOpenAIConfigured || !openai) {
      return NextResponse.json({
        explanation: "AI explanation is not configured. Please contact your instructor.",
      })
    }

    const { content: explanation } = await createForFeature(openai, "codebench", {
      usageContext: codebenchUsageContext(auth.studentDbId, "CODE_HELP", "codebench-explain"),
      messages: [
        {
          role: "system",
          content: `You are an expert ${language} programming tutor. Explain code in detail with:
1. Step-by-step execution flow
2. What each section does
3. Key concepts and patterns used
4. Visual diagrams using ASCII art or markdown
5. Real-world analogies when helpful

${learningMode === "beginner"
  ? "Use simple language, metaphors, and visual descriptions. Explain like teaching a complete beginner. Use analogies (e.g., 'Think of an array like a row of mailboxes')."
  : learningMode === "expert"
  ? "Focus on engineering-level review: performance implications, modern best practices, edge cases, and advanced concepts. Mention things like smart pointers, RAII, move semantics, etc."
  : "Explain algorithmic logic and intermediate concepts. Discuss time/space complexity, design patterns, and common pitfalls."}

Use markdown formatting with:
- ### for sections
- **bold** for important concepts
- \`code\` for inline code
- \`\`\`${language} code blocks for examples
- Numbered lists for steps
- Bullet points for features

Make explanations clear and educational, suitable for ${learningMode} level students learning ${language}.`,
        },
        {
          role: "user",
          content: `Please explain this ${language} code in detail:\n\n\`\`\`${language}\n${code}\n\`\`\``,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    })

    const explanationText = explanation || "Unable to generate explanation"

    return NextResponse.json({ explanation: explanationText })
  } catch (error) {
    console.error("[Explain API] Error:", error)
    return jsonFromCodebenchCoraError(error, "Failed to explain code")
  }
}
