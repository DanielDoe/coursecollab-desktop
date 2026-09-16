import { NextRequest, NextResponse } from "next/server"
import { requireCodebenchCoraStudent } from "@/lib/codebench-request-auth"
import { codebenchUsageContext, jsonFromCodebenchCoraError } from "@/lib/codebench-cora-usage"
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
    const bound = await requireCodebenchCoraStudent(request, claimed)
    if (!bound.ok) return bound.response

    const code = typeof body.code === "string" ? body.code : ""
    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 })
    }

    // Analyze code concepts using AI (OpenAI)
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 })
    }

    const openai = new OpenAI({ apiKey: openaiApiKey })

    const analysisPrompt = `Analyze this C++ code and provide a detailed concept analysis in JSON format:

\`\`\`cpp
${code}
\`\`\`

Return a JSON object with:
{
  "concepts": {
    "loops": <0-100 score>,
    "pointers": <0-100 score>,
    "oop": <0-100 score>,
    "recursion": <0-100 score>,
    "arrays": <0-100 score>,
    "stl": <0-100 score>
  },
  "weaknesses": ["concept1", "concept2"],
  "strengths": ["concept1", "concept2"],
  "proficiencyScore": <0-100>,
  "level": "Beginner" | "Intermediate" | "Advanced",
  "mainWeakness": "concept name",
  "mostImproved": "concept name",
  "recommendedPractice": "topic name",
  "recommendations": ["recommendation1", "recommendation2", "recommendation3"]
}

Be specific and educational. Do not provide full code solutions.`

    const { content } = await createForFeature(openai, "codebench", {
      usageContext: codebenchUsageContext(bound.studentDbId, "ANALYTICS", "codebench-analyze"),
      messages: [
        {
          role: "system",
          content:
            "You are an expert C++ code analyzer. Analyze code concepts, identify weaknesses and strengths, and provide educational recommendations. Always return valid JSON.",
        },
        { role: "user", content: analysisPrompt },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    })

    if (!content) {
      return NextResponse.json({ error: "No analysis received" }, { status: 500 })
    }

    try {
      const analysis = JSON.parse(content)
      return NextResponse.json(analysis)
    } catch (parseError) {
      console.error("Failed to parse analysis:", parseError)
      return NextResponse.json({ error: "Failed to parse analysis" }, { status: 502 })
    }
  } catch (error) {
    console.error("Code analysis error:", error)
    return jsonFromCodebenchCoraError(error, "Internal server error")
  }
}

