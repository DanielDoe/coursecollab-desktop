import { NextRequest, NextResponse } from "next/server"
import { requireCodebenchStudent } from "@/lib/codebench-request-auth"
import { createForFeature } from "@/lib/resolve-feature-ai-model"
import OpenAI from "openai"

export async function POST(request: NextRequest) {
  try {
    let body: { code?: unknown; studentId?: unknown } = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const claimed = body.studentId != null ? String(body.studentId) : null
    const bound = await requireCodebenchStudent(request, claimed)
    if (!bound.ok) return bound.response

    const code = typeof body.code === "string" ? body.code : ""
    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 })
    }

    // Generate learning plan using AI
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 })
    }

    const openai = new OpenAI({ apiKey: openaiApiKey })

    const planPrompt = `Based on this C++ code, create a personalized weekly learning plan in JSON format:

\`\`\`cpp
${code}
\`\`\`

Return a JSON object with:
{
  "weekly_plan": "A detailed paragraph describing the weekly learning strategy",
  "tasks": ["task1", "task2", "task3", "task4", "task5"],
  "study_time_minutes": <number>
}

Focus on improving weaknesses and building on strengths. Be specific and actionable.`

    const { content } = await createForFeature(openai, "codebench", {

      messages: [
        {
          role: "system",
          content:
            "You are an expert programming tutor. Create personalized learning plans that help students improve their coding skills. Always return valid JSON.",
        },
        { role: "user", content: planPrompt },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    })

    if (!content) {
      return NextResponse.json({ error: "No plan received" }, { status: 500 })
    }

    try {
      const plan = JSON.parse(content)
      return NextResponse.json(plan)
    } catch (parseError) {
      console.error("Failed to parse plan:", parseError)
      return NextResponse.json({ error: "Failed to parse learning plan" }, { status: 502 })
    }
  } catch (error) {
    console.error("Learning plan error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

