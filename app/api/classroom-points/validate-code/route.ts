import { NextRequest, NextResponse } from "next/server";
import { createForFeature } from "@/lib/resolve-feature-ai-model";
import { getSQL } from "@/lib/db";
import OpenAI from "openai";
import { formatCanonicalReferenceAnswerForPrompt } from "@/lib/resolve-reference-answer-for-ai";

const sqlInstance = getSQL();

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ValidationRequest {
  code: string;
  assignmentTitle: string;
  assignmentDescription: string | null;
  studentName?: string;
  /** Base64 data URL (image/png, image/jpeg, …) from classroom plot upload */
  plotImage?: string | null;
}

interface BatchValidationRequest {
  submissions: Array<{
    id: number;
    code: string;
    assignmentTitle: string;
    assignmentDescription: string | null;
    studentName: string;
    studentId: number;
    plotImage?: string | null;
  }>;
}

// Single validation
export async function POST(request: NextRequest) {
  try {
    const { requireClassroomPointsInstructor } = await import("@/lib/classroom-points-request-auth")
    const scope = await requireClassroomPointsInstructor(request)
    if (!scope.ok) return scope.response

    const body: ValidationRequest | BatchValidationRequest = await request.json();
    
    // Check if it's a batch request
    if ('submissions' in body && Array.isArray(body.submissions)) {
      return await handleBatchValidation(body as BatchValidationRequest);
    }
    
    return await handleSingleValidation(body as ValidationRequest);
  } catch (error: any) {
    console.error("[Code Validation] Error:", error);
    return NextResponse.json(
      { error: "Failed to validate code", details: error.message },
      { status: 500 }
    );
  }
}

async function handleSingleValidation(request: ValidationRequest) {
  const { code, assignmentTitle, assignmentDescription, studentName, plotImage } = request;
  
  if (!code || !assignmentTitle) {
    return NextResponse.json(
      { error: "Code and assignment title are required" },
      { status: 400 }
    );
  }

  const description = assignmentDescription || assignmentTitle;
  
  try {
    const validationResult = await validateCodeWithAI(code, assignmentTitle, description, plotImage);
    return NextResponse.json(validationResult);
  } catch (error: any) {
    console.error("[Code Validation] AI validation error:", error);
    // Return default pass if AI fails
    return NextResponse.json({
      matches: true,
      points: 2.5,
      remark: "AI validation unavailable, default points awarded",
      confidence: 0.5
    });
  }
}

export async function handleBatchValidation(request: BatchValidationRequest) {
  const { submissions } = request;
  const batchSize = 10;
  const results: any[] = [];
  
  // Process in batches of 10
  for (let i = 0; i < submissions.length; i += batchSize) {
    const batch = submissions.slice(i, i + batchSize);
    
    try {
      const batchResults = await Promise.all(
        batch.map(async (submission) => {
          try {
            const description = submission.assignmentDescription || submission.assignmentTitle;
            const validation = await validateCodeWithAI(
              submission.code,
              submission.assignmentTitle,
              description,
              submission.plotImage
            );
            return {
              id: submission.id,
              studentId: submission.studentId,
              ...validation
            };
          } catch (error: any) {
            console.error(`[Code Validation] Error validating submission ${submission.id}:`, error);
            return {
              id: submission.id,
              studentId: submission.studentId,
              matches: true,
              points: 2.5,
              remark: "AI validation failed, default points awarded",
              confidence: 0.5
            };
          }
        })
      );
      results.push(...batchResults);
    } catch (error) {
      console.error(`[Code Validation] Batch error:`, error);
      // Add default results for failed batch
      batch.forEach(submission => {
        results.push({
          id: submission.id,
          studentId: submission.studentId,
          matches: true,
          points: 2.5,
          remark: "AI validation failed, default points awarded",
          confidence: 0.5
        });
      });
    }
  }
  
  return NextResponse.json({ results });
}

function parseAndNormalizeValidation(content: string): {
  matches: boolean;
  points: number;
  remark: string;
  confidence: number;
} {
  let result: Record<string, unknown>;
  try {
    const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      result = JSON.parse(jsonMatch[1]);
    } else {
      result = JSON.parse(content);
    }
  } catch {
    const matches =
      content.toLowerCase().includes("match") || content.toLowerCase().includes("correct");
    result = {
      matches,
      points: matches ? 2.5 : 0,
      remark: "AI response parsing failed, default evaluation",
      confidence: 0.5,
    };
  }

  return {
    matches: Boolean(result.matches),
    points: Math.max(0, Math.min(2.5, parseFloat(String(result.points)) || 2.5)),
    remark: String(result.remark || "No remark provided").substring(0, 500),
    confidence: Math.max(0, Math.min(1, parseFloat(String(result.confidence)) || 0.5)),
  };
}

export async function validateCodeWithAI(
  code: string,
  title: string,
  description: string,
  plotImage?: string | null,
  expectedAnswer?: string | null,
): Promise<{ matches: boolean; points: number; remark: string; confidence: number }> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    console.warn("[Code Validation] OPENAI_API_KEY not set, returning default validation");
    return {
      matches: true,
      points: 2.5,
      remark: "AI validation not configured",
      confidence: 0.5
    };
  }

  const hasPlot = typeof plotImage === "string" && plotImage.length > 100;
  const referenceBlock = expectedAnswer?.trim()
    ? `\n${formatCanonicalReferenceAnswerForPrompt(expectedAnswer.trim())}\n`
    : "";

  const prompt = hasPlot
    ? `You are a reviewer for programming coursework. The student submitted code and an image of their plot/figure.

Assignment Title: ${title}
Assignment Description: ${description}
${referenceBlock}
Student Code (may be C++, MATLAB, or similar):
\`\`\`
${code}
\`\`\`

You are also given an image of their plot/figure.

Instructions:
1. Check whether the code and (when relevant) the plot together address what the assignment asks for.
2. When a CANONICAL REFERENCE ANSWER is provided, grade every submission against that exact reference — do not invent different expected results.
3. If the assignment requires a plot/figure, the uploaded image should reasonably match (axes, shape, labels as appropriate). If no plot was needed, ignore image details.
4. Do not nitpick minor style; focus on whether the submission matches the assignment intent.
5. Award points from 0 to 2.5. Award 2.5 when the submission clearly matches the assignment (or reference answer when provided).
6. Respond in JSON only.

Respond in JSON format:
{
  "matches": true/false,
  "points": 0-2.5,
  "remark": "brief explanation",
  "confidence": 0.0-1.0
}`
    : `You are a code reviewer. Analyze the following code and determine if it implements what the assignment description requires.

Assignment Title: ${title}
Assignment Description: ${description}
${referenceBlock}
Student Code:
\`\`\`
${code}
\`\`\`

Instructions:
1. Check if the code attempts to implement what the assignment description asks for
2. When a CANONICAL REFERENCE ANSWER is provided, grade against that exact reference for consistency across all students
3. Do NOT check for minor style issues or code quality — only intent/correctness vs assignment
4. Award points from 0 to 2.5 based on how well the code matches the description (or reference answer)
5. If the code clearly doesn't match the assignment (e.g., wrong problem, template code, unrelated code), award 0 points
6. If the code matches the assignment description (or reference answer), award 2.5 points
7. Provide a brief remark explaining your decision

Respond in JSON format:
{
  "matches": true/false,
  "points": 0-2.5,
  "remark": "brief explanation",
  "confidence": 0.0-1.0
}`;

  try {
    if (hasPlot && plotImage) {
      const visionRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0,
          max_tokens: 600,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You are a code and figure reviewer. Compare the assignment to the student's code and plot image. Always respond with valid JSON only.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: plotImage } },
              ],
            },
          ],
        }),
      });
      const visionData = await visionRes.json();
      const content = visionData?.choices?.[0]?.message?.content as string | undefined;
      if (!visionRes.ok || !content) {
        console.warn("[Code Validation] Vision path failed, falling back to text-only:", visionData?.error?.message);
        return validateCodeWithAI(code, title, description, null);
      }
      return parseAndNormalizeValidation(content);
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });
    const { content } = await createForFeature(openai, "classroom_points", {

      messages: [
        {
          role: "system",
          content: "You are a code reviewer. Analyze code and determine if it matches assignment requirements. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0,
      max_tokens: 500
    });
    
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    return parseAndNormalizeValidation(content);
  } catch (error: any) {
    console.error("[Code Validation] OpenAI request error:", error);
    throw error;
  }
}
