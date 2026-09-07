import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { requireCodebenchStudent } from "@/lib/codebench-request-auth"
import { createForFeature } from "@/lib/resolve-feature-ai-model"
import { extensionForLanguage, type CodebenchLanguageId } from "@/lib/codebench-languages"
import { heuristicFileName, sanitizeIdeName } from "@/lib/codebench-ide-workspace"

export async function POST(request: NextRequest) {
  try {
    let body: { code?: unknown; language?: unknown; studentId?: unknown; projectName?: unknown } = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const claimed = body.studentId != null ? String(body.studentId) : null
    const bound = await requireCodebenchStudent(request, claimed)
    if (!bound.ok) return bound.response

    const code = typeof body.code === "string" ? body.code : ""
    if (!code.trim()) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 })
    }

    const language = (typeof body.language === "string" ? body.language : "cpp") as CodebenchLanguageId
    const fallback = heuristicFileName(code, language)
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ filename: fallback, projectHint: null, source: "heuristic" })
    }

    const openai = new OpenAI({ apiKey: openaiApiKey })
    const ext = extensionForLanguage(language)
    const { content } = await createForFeature(openai, "codebench", {
      messages: [
        {
          role: "system",
          content:
            "You name student source files for CourseCollab CodeBench. Return compact JSON only. Prefer descriptive snake_case or PascalCase stems that match the language. Never invent path folders. Never use untitled, main, or temp unless the code is empty boilerplate.",
        },
        {
          role: "user",
          content: `Suggest a filename for this ${language} file. Extension must be .${ext}.
Current project name: ${typeof body.projectName === "string" ? body.projectName : "My Project"}

\`\`\`${language}
${code.slice(0, 4000)}
\`\`\`

Return JSON: { "filename": "example.${ext}", "projectHint": "optional-short-project-name-or-null" }`,
        },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    })

    let filename = fallback
    let projectHint: string | null = null
    try {
      const parsed = content ? JSON.parse(content) : {}
      if (typeof parsed.filename === "string" && parsed.filename.trim()) {
        filename = sanitizeIdeName(parsed.filename)
        if (!filename.includes(".")) filename = `${filename}.${ext}`
      }
      if (typeof parsed.projectHint === "string" && parsed.projectHint.trim()) {
        projectHint = sanitizeIdeName(parsed.projectHint)
      }
    } catch {
      filename = fallback
    }

    return NextResponse.json({ filename, projectHint, source: "cora" })
  } catch (error) {
    console.error("[codebench/name-file]", error)
    return NextResponse.json({ error: "Could not name file" }, { status: 500 })
  }
}
