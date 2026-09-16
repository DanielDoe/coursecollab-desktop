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

    // Split code into lines for validation
    const codeLines = code.split('\n')
    
    const systemPrompt = `You are an expert ${language} code reviewer. Identify suspicious lines that might cause bugs.

CRITICAL: Line numbers must be 1-based (first line is line 1, not line 0). Count ALL lines including empty lines.

Return a JSON object with a "suspiciousLines" array, where each item contains:
{
  "lineNumber": <exact line number (1-based, counting from first line of code including empty lines)>,
  "code": "<the exact line of code as it appears in the source>",
  "issue": "<brief description of potential issue>",
  "question": "<multiple choice question asking student to identify the problem>",
  "options": [
    {
      "id": "a",
      "text": "<option text>",
      "correct": true/false,
      "explanation": "<why this is correct/incorrect>"
    },
    ...
  ],
  "explanation": "<detailed explanation of the issue>"
}

IMPORTANT: 
- Line numbers start at 1 (first line is line 1)
- Include empty lines in your count
- The "code" field must match EXACTLY the line of code at that line number
- Double-check your line numbers by counting from the top of the code

${learningMode === "beginner"
  ? "Focus on common beginner mistakes. Use simple language."
  : learningMode === "expert"
  ? "Focus on subtle bugs, edge cases, and advanced issues."
  : "Focus on logical errors and common pitfalls."}

Identify 3-5 suspicious lines. Don't give away the answer - make students think!`

    const usageContext = {
      actor: { userId: auth.studentDbId, userRole: "student" as const },
      feature: "CODE_HELP" as const,
      module: "codebench-error-spotting",
      billable: true as const,
    }

    const { content } = await createForFeature(openai, "codebench", {

      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Find suspicious lines in this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``,
        },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
      usageContext,
    })
    if (!content) {
      return NextResponse.json({ error: "No analysis generated" }, { status: 500 })
    }

    try {
      const parsed = JSON.parse(content)
      let suspiciousLines = parsed.suspiciousLines || []
      
      // Validate and correct line numbers by matching code
      suspiciousLines = suspiciousLines.map((line: any) => {
        const reportedLineNumber = parseInt(line.lineNumber) || 0
        const reportedCode = (line.code || '').trim()
        
        // Validate line number is within bounds
        if (reportedLineNumber < 1 || reportedLineNumber > codeLines.length) {
          // Try to find the line by matching code content
          const matchingLineIndex = codeLines.findIndex((codeLine, idx) => {
            const normalizedCodeLine = codeLine.trim()
            const normalizedReported = reportedCode.trim()
            // Exact match or contains the reported code
            return normalizedCodeLine === normalizedReported || 
                   normalizedCodeLine.includes(normalizedReported) ||
                   normalizedReported.includes(normalizedCodeLine)
          })
          
          if (matchingLineIndex !== -1) {
            // Convert 0-based index to 1-based line number
            line.lineNumber = matchingLineIndex + 1
            line.code = codeLines[matchingLineIndex]
            console.log(`[Error Spotting] Corrected line number from ${reportedLineNumber} to ${line.lineNumber} by code matching`)
          } else {
            // If we can't find it, skip this line
            console.warn(`[Error Spotting] Could not validate line ${reportedLineNumber} with code "${reportedCode}"`)
            return null
          }
        } else {
          // Validate the code matches what's actually on that line
          const actualLineCode = codeLines[reportedLineNumber - 1]?.trim() || ''
          const reportedCodeTrimmed = reportedCode.trim()
          
          // If codes don't match, try to find the correct line
          if (actualLineCode !== reportedCodeTrimmed && 
              !actualLineCode.includes(reportedCodeTrimmed) && 
              !reportedCodeTrimmed.includes(actualLineCode)) {
            // Search for matching line
            const matchingLineIndex = codeLines.findIndex((codeLine) => {
              const normalized = codeLine.trim()
              return normalized === reportedCodeTrimmed || 
                     normalized.includes(reportedCodeTrimmed) ||
                     reportedCodeTrimmed.includes(normalized)
            })
            
            if (matchingLineIndex !== -1) {
              line.lineNumber = matchingLineIndex + 1
              line.code = codeLines[matchingLineIndex]
              console.log(`[Error Spotting] Corrected line number from ${reportedLineNumber} to ${line.lineNumber} by code content matching`)
            } else {
              // Keep original but update code to match actual line
              line.code = codeLines[reportedLineNumber - 1] || reportedCode
            }
          } else {
            // Codes match, ensure we have the exact line
            line.code = codeLines[reportedLineNumber - 1] || reportedCode
          }
        }
        
        return line
      }).filter((line: any) => line !== null) // Remove invalid lines
      
      void import("@/lib/cora/insights/codebench-mistakes").then(({ recordCodebenchMistakeFindings }) =>
        recordCodebenchMistakeFindings({
          studentId: auth.studentDbId,
          module: "codebench-error-spotting",
          feature: "CODE_HELP",
          findings: suspiciousLines.flatMap((line: { issue?: string; explanation?: string }) => [
            line?.issue,
            line?.explanation,
          ]),
          code,
        }),
      ).catch(() => undefined)

      return NextResponse.json({ suspiciousLines })
    } catch (parseError) {
      console.error("Failed to parse error spotting:", parseError)
      return NextResponse.json({ error: "Failed to parse analysis" }, { status: 500 })
    }
  } catch (error) {
    console.error("Error spotting API error:", error)
    return jsonFromCodebenchCoraError(error, "Failed to analyze code")
  }
}


