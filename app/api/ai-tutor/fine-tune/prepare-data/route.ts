import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * Prepare fine-tuning dataset from high-quality conversations
 * This generates JSONL file format required by OpenAI fine-tuning
 */
export async function POST(request: NextRequest) {
  try {
    const { 
      minResponseLength = 50,
      maxResponseLength = 2000,
      months = 6,
      limit = 10000
    } = await request.json()


    // Get high-quality conversations for training
    const conversations = await sql`
      SELECT 
        aitc.message,
        aitc.response,
        aitc.topic,
        aitc.response_time,
        s.section
      FROM ai_tutor_conversations aitc
      LEFT JOIN students s ON aitc.student_id = s.id
      WHERE 
        aitc.created_at >= NOW() - INTERVAL '${months} months'
        AND LENGTH(aitc.response) >= ${minResponseLength}
        AND LENGTH(aitc.response) <= ${maxResponseLength}
        AND aitc.response IS NOT NULL
        AND aitc.response != ''
        AND aitc.response_time < 30000  -- Exclude very slow responses (likely errors)
      ORDER BY aitc.created_at DESC
      LIMIT ${limit}
    `


    // Format for OpenAI fine-tuning (JSONL format)
    const trainingExamples = conversations.map((conv: any) => ({
      messages: [
        {
          role: "system",
          content: "You are an expert C++ programming tutor for the ELEG2025 course. Provide clear, accurate, and helpful explanations."
        },
        {
          role: "user",
          content: conv.message
        },
        {
          role: "assistant",
          content: conv.response
        }
      ]
    }))

    // Convert to JSONL (one JSON object per line)
    const jsonl = trainingExamples
      .map(example => JSON.stringify(example))
      .join('\n')

    // Get statistics
    const stats = {
      totalExamples: conversations.length,
      topicDistribution: conversations.reduce((acc: any, conv: any) => {
        acc[conv.topic] = (acc[conv.topic] || 0) + 1
        return acc
      }, {}),
      avgResponseLength: Math.round(
        conversations.reduce((sum: number, conv: any) => 
          sum + conv.response.length, 0
        ) / conversations.length
      ),
      dateRange: {
        oldest: conversations[conversations.length - 1]?.created_at,
        newest: conversations[0]?.created_at
      }
    }

    return NextResponse.json({
      success: true,
      jsonl,  // Ready to download
      stats,
      instructions: {
        step1: "Download the JSONL data from this response",
        step2: "Save as 'training-data.jsonl'",
        step3: "Upload to OpenAI: openai api fine_tuning.jobs.create -t training-data.jsonl -m gpt-4o-mini-2024-07-18",
        step4: "Wait for training (usually 10-20 minutes)",
        step5: "Update AI config to use your fine-tuned model",
        estimatedCost: `$${(conversations.length * 0.008).toFixed(2)}`,  // ~$0.008 per 1K tokens
        estimatedTime: "10-20 minutes"
      }
    })

  } catch (error: any) {
    console.error("[Fine-Tune Prep Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to prepare fine-tuning data",
        details: error.message 
      },
      { status: 500 }
    )
  }
}

