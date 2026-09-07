import { type NextRequest, NextResponse } from "next/server"
import { requireCodebenchStudent } from "@/lib/codebench-request-auth"
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
    const { code, description, language = "cpp", studentId } = await request.json()

    const auth = await requireCodebenchStudent(request, studentId != null ? String(studentId) : null)
    if (!auth.ok) return auth.response

    if (!code && !description) {
      return NextResponse.json({ error: "Code or description is required" }, { status: 400 })
    }

    if (!isOpenAIConfigured || !openai) {
      return NextResponse.json({
        pseudocode: "AI pseudocode generation is not configured.",
        algorithm: "N/A",
        flowchart: "N/A",
      })
    }

    // Detect if input is a description/question or actual code
    const isDescription = description || (code && (
      code.toLowerCase().includes("write") || 
      code.toLowerCase().includes("create") || 
      code.toLowerCase().includes("make") ||
      code.toLowerCase().includes("how to") ||
      code.toLowerCase().includes("help me") ||
      (!code.includes("{") && !code.includes(";") && !code.includes("(") && code.trim().length < 100)
    ))

    const prompt = code && !isDescription
      ? `Generate structured pseudocode for this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``
      : `The student wants to: ${description || code}\n\nProvide guidelines and teaching on how to approach this problem. Show the algorithm steps using pseudocode, but DO NOT write actual code. Guide them to write it themselves.`

    const systemPrompt = isDescription
      ? `You are an expert computer science educator. Help students learn to write code by providing DETAILED VISUAL GUIDELINES with DIAGRAMS, STRUCTURED PSEUDOCODE, and STEP-BY-STEP TEACHING, NOT writing code for them.

CRITICAL RULES:
- NEVER write actual code implementations
- ALWAYS include ASCII flow diagrams and visual representations
- Use structured, well-formatted pseudocode with clear indentation
- Break down the problem into detailed numbered steps with explanations
- Create visual flow charts using ASCII art (boxes, arrows, decision diamonds)
- Use markdown formatting for better readability
- Provide comprehensive teaching explanations (400-500 words)
- Include detailed step-by-step breakdowns that teach concepts

REQUIRED FORMAT:
1. **Problem Analysis** (detailed overview explaining what needs to be done and why)
2. **Algorithm Flow Diagram** (ASCII art with boxes and arrows showing complete logic flow)
3. **Step-by-Step Pseudocode** (well-indented, structured, with inline comments explaining each step)
4. **Detailed Teaching Steps** (numbered list explaining each major step in detail):
   - What each step does
   - Why it's necessary
   - How it connects to the next step
   - Common mistakes to avoid
5. **Key Concepts** (bullet points explaining important programming concepts used)
6. **Guiding Questions** (questions to help students think through the problem)
7. **Implementation Tips** (practical advice for writing the actual code)

Format your response as JSON:
{
  "pseudocode": "well-formatted structured pseudocode with proper indentation, inline comments explaining each step, showing the complete approach and algorithm steps",
  "algorithm": "comprehensive algorithm description with detailed visual flow diagram in ASCII art format (use boxes, arrows, decision diamonds). Include explanations for each decision point and process step.",
  "flowchart": "detailed ASCII flowchart representation showing the complete logic flow with START, PROCESS, DECISION, and END boxes. Include labels explaining what happens at each step."
}

EXAMPLE FLOW DIAGRAM FORMAT:
\`\`\`
┌─────────────────┐
│   START         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Input: ...     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Process: ...  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Output: ...    │
└─────────────────┘
\`\`\`

Focus on teaching with visual aids, not providing code solutions.`
      : `You are an expert computer science educator. Generate VISUAL pseudocode with DIAGRAMS and STRUCTURED FORMATTING.

CRITICAL RULES:
- NEVER write actual code implementations
- ALWAYS include ASCII flow diagrams showing the algorithm flow
- Create clear, structured pseudocode with proper indentation
- Use visual flow charts with boxes, arrows, and decision diamonds
- Format output with markdown (headers, code blocks, lists)
- Keep explanations concise but visual (200-300 words)

REQUIRED FORMAT:
1. Algorithm Overview (brief explanation)
2. Flow Diagram (ASCII art visualization)
3. Structured Pseudocode (well-indented, clear structure)
4. Key Steps Breakdown (numbered list)

Format your response as JSON:
{
  "pseudocode": "well-formatted structured pseudocode with proper indentation showing algorithm steps",
  "algorithm": "high-level algorithm description with ASCII flow diagram (use boxes, arrows, decision diamonds)",
  "flowchart": "detailed ASCII flowchart representation showing the complete logic flow"
}

EXAMPLE FLOW DIAGRAM FORMAT:
\`\`\`
┌─────────────────┐
│   START         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Initialize     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Loop/Process  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Return Result │
└─────────────────┘
\`\`\`

Use clear visual separators, proper indentation, and structured formatting.`

    const { content: rawContent } = await createForFeature(openai, "codebench", {

      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    })

    let response
    try {
      response = JSON.parse(rawContent || "{}")
    } catch (parseError) {
      console.error("[Pseudocode API] JSON parse error:", parseError)
      return NextResponse.json({
        pseudocode: "Failed to parse pseudocode response. Please try again.",
        algorithm: "N/A",
        flowchart: "N/A",
      })
    }

    // Format the response with proper structure for better display
    const formattedPseudocode = response.pseudocode || "Unable to generate pseudocode."
    const formattedAlgorithm = response.algorithm || "N/A"
    const formattedFlowchart = response.flowchart || "N/A"
    
    // Create a well-formatted markdown response that combines all elements
    // This will be displayed in the chat interface with proper formatting
    const combinedResponse = `## 📊 Algorithm Overview\n\n${formattedAlgorithm}\n\n---\n\n## 🔄 Flow Diagram\n\n\`\`\`\n${formattedFlowchart}\n\`\`\`\n\n---\n\n## 📝 Structured Pseudocode\n\n\`\`\`pseudocode\n${formattedPseudocode}\n\`\`\``
    
    return NextResponse.json({
      pseudocode: combinedResponse,
      algorithm: formattedAlgorithm,
      flowchart: formattedFlowchart,
      // Also return individual fields for backward compatibility
      rawPseudocode: formattedPseudocode,
      rawAlgorithm: formattedAlgorithm,
      rawFlowchart: formattedFlowchart,
    })
  } catch (error) {
    console.error("[Pseudocode API] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate pseudocode" },
      { status: 500 }
    )
  }
}

