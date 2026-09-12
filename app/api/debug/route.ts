import { type NextRequest, NextResponse } from "next/server"
import { requireCodebenchStudent } from "@/lib/codebench-request-auth"
import { studioPromptBlock } from "@/lib/codebench-studio-analytics"
import { jsonFromCodebenchCoraError } from "@/lib/codebench-cora-usage"
import { createForFeature } from "@/lib/resolve-feature-ai-model"
import OpenAI from "openai"

const isOpenAIConfigured = !!process.env.OPENAI_API_KEY
const openai = isOpenAIConfigured ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null

export const dynamic = "force-dynamic"
export const maxDuration = 30

const SUGGEST_FIX_SYSTEM = (language: string, studioContext: unknown) => `You fix ${language} compiler errors from build output. The user clicked Suggest fix — they want the error fixed, not a lesson.

Rules:
- No teaching, conceptual explanations, or guiding questions
- No full corrected program — only the minimal line-level fix if needed
- Use the first compiler diagnostic

JSON only:
{
  "errors": ["Line N: brief error"],
  "fixes": ["exact edit in plain English"],
  "correctedCode": "corrected line(s) only, not the whole file",
  "explanation": "Under 40 words. Two lines: **Line N:** what's wrong (≤8 words). **Fix:** exact edit. No teaching.",
  "errorDetails": [
    { "lineNumber": <1-based>, "lineContent": "<exact source line>", "description": "<≤8 words>" }
  ]
}

Line numbers are 1-based. Match lineContent exactly from the source.${studioPromptBlock(studioContext)}`

const DEBUG_TUTOR_SYSTEM = (language: string, studioContext: unknown) => `You are an expert ${language} debugging tutor. Help students FIND and UNDERSTAND bugs, then GUIDE them to fix errors themselves. DO NOT write complete fixed code.

CRITICAL RULES:
- NEVER write complete corrected code implementations
- Point out errors with line numbers
- Provide GUIDANCE and HINTS, not complete solutions
- Give a step-by-step debugging approach

Format your response as JSON with this structure:
{
  "errors": ["error1 description", "error2 description", ...],
  "fixes": ["hint/guidance for fix1", "hint/guidance for fix2", ...],
  "correctedCode": "small snippets showing each fix only, not the entire program",
  "explanation": "Markdown under 100 words. List errors and hints. No walls of text.",
  "errorDetails": [
    { "lineNumber": <1-based line number>, "lineContent": "<exact line of code>", "description": "<brief error description>" },
    ...
  ]
}

Line numbers are 1-based.${studioPromptBlock(studioContext)}`

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
      billable: true as const,
    }

    const hasCompilerOutput = Boolean(String(compilerOutput || "").trim())

    const { content: completionContent } = await createForFeature(openai, "codebench", {
      usageContext,
      messages: [
        {
          role: "system",
          content: hasCompilerOutput
            ? SUGGEST_FIX_SYSTEM(language, studioContext)
            : DEBUG_TUTOR_SYSTEM(language, studioContext),
        },
        {
          role: "user",
          content: hasCompilerOutput
            ? [
                `Compiler output:\n\`\`\`\n${String(compilerOutput).slice(0, 2500)}\n\`\`\``,
                `Fix the first error only.\n\n\`\`\`${language}\n${code}\n\`\`\``,
              ].join("\n\n")
            : `Please debug this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``,
        },
      ],
      temperature: 0.2,
      max_tokens: hasCompilerOutput ? 400 : 2000,
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
    return jsonFromCodebenchCoraError(error, "Failed to debug code")
  }
}
