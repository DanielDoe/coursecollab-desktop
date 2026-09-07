import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { generateEmbedding, formatVectorForPg } from "@/lib/embeddings"

export const dynamic = "force-dynamic"

/**
 * Find similar questions that were asked before
 * Uses embedding similarity search
 */
export async function POST(request: NextRequest) {
  try {
    const { question, limit = 5, similarityThreshold = 0.8 } = await request.json()

    if (!question || !question.trim()) {
      return NextResponse.json(
        { success: false, error: "Question is required" },
        { status: 400 }
      )
    }

    // Generate embedding for the question
    const questionEmbedding = await generateEmbedding(question)
    const vectorString = formatVectorForPg(questionEmbedding)

    // Find similar questions using vector similarity
    const similarQuestions = await sql`
      SELECT 
        qe.id,
        qe.question,
        qe.topic,
        aitc.response,
        aitc.created_at,
        s.full_name as student_name,
        1 - (qe.embedding <=> ${vectorString}::vector) as similarity
      FROM question_embeddings qe
      JOIN ai_tutor_conversations aitc ON qe.conversation_id = aitc.id
      LEFT JOIN students s ON qe.student_id = s.id
      WHERE qe.embedding IS NOT NULL
      ORDER BY qe.embedding <=> ${vectorString}::vector
      LIMIT ${limit}
    `

    // Filter by similarity threshold
    const filtered = similarQuestions.filter((q: any) => 
      parseFloat(q.similarity) >= similarityThreshold
    )


    return NextResponse.json({
      success: true,
      similarQuestions: filtered.map((q: any) => ({
        id: q.id,
        question: q.question,
        response: q.response,
        topic: q.topic,
        similarity: parseFloat(q.similarity).toFixed(3),
        askedBy: q.student_name,
        askedAt: q.created_at
      })),
      count: filtered.length,
      threshold: similarityThreshold
    })

  } catch (error: any) {
    console.error("[Similar Questions Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to find similar questions",
        details: error.message,
        similarQuestions: []
      },
      { status: 500 }
    )
  }
}

