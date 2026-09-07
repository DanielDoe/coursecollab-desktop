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
    const { code, language = "cpp", studentId, compilerOutput, studioContext } = await request.json()

    const auth = await requireCodebenchStudent(request, studentId != null ? String(studentId) : null)
    if (!auth.ok) return auth.response

    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 })
    }

    if (!isOpenAIConfigured || !openai) {
      return NextResponse.json({
        errors: [],
        fixes: [],
        correctedCode: code,
        explanation: "AI debugging is not configured. Please contact your instructor.",
      })
    }

    const usageContext = {
      actor: { userId: auth.studentDbId, userRole: "student" as const },
      feature: "CODE_DEBUG" as const,
      module: "codebench-debug",
    }

    const { content: completionContent } = await createForFeature(openai, "codebench", {
      usageContext,
      messages: [
        {
          role: "system",
          content: `You are an expert ${language} debugging tutor. Help students FIND and UNDERSTAND bugs, then GUIDE them to fix errors themselves. DO NOT write complete fixed code.

CRITICAL RULES:
- NEVER write complete corrected code implementations
- Point out errors with visual indicators (line numbers, arrows)
- Explain WHY errors occur with simple diagrams
- Provide GUIDANCE and HINTS, not complete solutions
- Ask guiding questions: "What do you think might be wrong here?"
- Give step-by-step debugging approach
- If asked for complete solution: "I can guide you, but try fixing it yourself first!"

Format your response as JSON with this structure:
{
  "errors": ["error1 description", "error2 description", ...],
  "fixes": ["hint/guidance for fix1", "hint/guidance for fix2", ...],
  "correctedCode": "DO NOT provide complete code - provide only small code snippets showing the FIX for each error, not the entire program",
  "explanation": "detailed explanation of bugs with visual guides, WHY they occur, and step-by-step guidance on how to fix them. Use markdown with ❌ for errors, ⚠️ for warnings, and visual flow diagrams.",
  "errorDetails": [
    { "lineNumber": <1-based line number>, "lineContent": "<exact line of code as it appears in the source>", "description": "<brief error description>" },
    ...
  ]
}

CRITICAL for line numbers:
- Line numbers are 1-based: first line of code is line 1, not line 0.
- Count ALL lines including empty lines and comments.
- "lineContent" must be the EXACT line of code at that line number (copy it character-for-character from the source).
- Double-check: count lines from the top of the code block to verify each lineNumber.

Focus on teaching debugging skills, not fixing code for them.${studioPromptBlock(studioContext)}`,
        },
        {
          role: "user",
          content: [
            compilerOutput
              ? `The student pressed Run. Compiler / runtime output:\n\`\`\`\n${String(compilerOutput).slice(0, 2500)}\n\`\`\`\nStart from the first diagnostic. Explain what went wrong and how they can fix it themselves.\n\n`
              : "",
            `Please debug this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``,
          ].join(""),
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
      console.error("[Debug API] JSON parse error:", parseError)
      return NextResponse.json({
        errors: [],
        fixes: [],
        correctedCode: code,
        explanation: "Failed to parse debug response. Please try again.",
        lineNumbers: [],
      })
    }

    // Validate and correct line numbers by matching code content
    const codeLines = code.split('\n')
    const explanation = response.explanation || ""
    const lineNumberCorrections: Record<number, number> = {}

    function findLineByContent(reportedCode: string): number | null {
      const normalized = (reportedCode || "").trim()
      if (!normalized) return null
      const idx = codeLines.findIndex((line: string) => {
        const trimmed = line.trim()
        return trimmed === normalized || trimmed.includes(normalized) || normalized.includes(trimmed)
      })
      return idx >= 0 ? idx + 1 : null
    }

    // Validate errorDetails (structured format with lineContent)
    const errorDetails = response.errorDetails || []
    for (const err of errorDetails) {
      const reported = parseInt(err.lineNumber) || 0
      const lineContent = (err.lineContent || "").trim()
      if (reported < 1 || reported > codeLines.length || !lineContent) continue

      const actualAtReported = codeLines[reported - 1]?.trim() || ""
      const matches = actualAtReported === lineContent || actualAtReported.includes(lineContent) || lineContent.includes(actualAtReported)

      if (!matches) {
        const correctLine = findLineByContent(lineContent)
        if (correctLine != null && correctLine !== reported) {
          lineNumberCorrections[reported] = correctLine
          console.log(`[Debug API] Corrected line ${reported} -> ${correctLine} by code matching`)
        }
      }
    }

    // Extract line numbers from explanation text (fallback)
    const extractedLineNumbers: number[] = []
    const lineNumberPatterns = [
      /line\s+(\d+)/gi,
      /line\s+number\s+(\d+)/gi,
      /on\s+line\s+(\d+)/gi,
      /at\s+line\s+(\d+)/gi,
      /line\s+(\d+):/gi,
    ]
    lineNumberPatterns.forEach((pattern) => {
      for (const match of explanation.matchAll(pattern)) {
        const lineNum = parseInt(match[1])
        if (lineNum >= 1 && lineNum <= codeLines.length) extractedLineNumbers.push(lineNum)
      }
    })
    const uniqueLineNumbers = [...new Set(extractedLineNumbers)].sort((a, b) => a - b)

    return NextResponse.json({
      errors: response.errors || [],
      fixes: response.fixes || [],
      correctedCode: response.correctedCode || code,
      explanation: response.explanation || "No issues found.",
      lineNumbers: uniqueLineNumbers,
      lineNumberCorrections: Object.keys(lineNumberCorrections).length > 0 ? lineNumberCorrections : undefined,
    })
  } catch (error) {
    console.error("[Debug API] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to debug code" },
      { status: 500 }
    )
  }
}

