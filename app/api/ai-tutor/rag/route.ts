import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { createForFeature } from "@/lib/resolve-feature-ai-model"
import OpenAI from "openai"
import { generateEmbedding, formatVectorForPg } from "@/lib/embeddings"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { resolveStudentCourseContextByDbId } from "@/lib/student-course-scope"
import { searchReleasedLectureEmbeddings } from "@/lib/cora/apis/released-lecture-embeddings"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export const dynamic = "force-dynamic"

/**
 * RAG (Retrieval Augmented Generation) Endpoint
 * Answers questions based on course lecture materials
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response
    const studentId = auth.studentDbId

    const { message, context = {} } = await request.json()

    if (!message || !message.trim()) {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      )
    }

    const courseId = (await resolveStudentCourseContextByDbId(studentId))?.courseId ?? null
    if (courseId == null) {
      return NextResponse.json({ success: false, error: "No enrolled course for RAG." }, { status: 403 })
    }

    // 1. Generate embedding for the question
    const questionEmbedding = await generateEmbedding(message)
    const vectorString = formatVectorForPg(questionEmbedding)

    // 2. Course-scoped, published-lecture search (join + draft heuristics)
    const relevantDocs = await searchReleasedLectureEmbeddings({
      courseId,
      vectorString,
      limit: 5,
    })


    // 3. Build context from relevant documents
    let contextText = ''
    const sources: any[] = []

    if (relevantDocs.length > 0) {
      contextText = relevantDocs
        .filter((doc: any) => parseFloat(doc.similarity) > 0.7)  // Only use highly relevant
        .map((doc: any) => {
          sources.push({
            source: doc.source,
            week: doc.week_number,
            page: doc.page_number,
            similarity: parseFloat(doc.similarity).toFixed(3)
          })
          return `[Source: ${doc.source}${doc.week_number ? ` - Week ${doc.week_number}` : ''}]\n${doc.content}`
        })
        .join('\n\n---\n\n')
    }

    // 4. Generate response with RAG context
    const systemPrompt = contextText
      ? `You are a C++ programming tutor for the ELEG2025 course.

IMPORTANT: Answer based PRIMARILY on the course materials provided below. These are from the actual lectures.

COURSE MATERIALS:
${contextText}

If the answer is in the course materials, cite the source (e.g., "According to Week 3 lecture...").
If the question isn't covered in the materials, you can provide general C++ knowledge but mention "This isn't directly covered in our lectures yet, but here's the general concept..."`
      : `You are a C++ programming tutor. Note: No specific course materials were found for this question, so provide general C++ knowledge.`

    const studentNumeric = studentId != null ? parseInt(String(studentId), 10) : NaN
    const usageContext =
      Number.isFinite(studentNumeric) && studentNumeric > 0
        ? {
            actor: { userId: studentNumeric, userRole: "student" as const },
            feature: "RAG" as const,
            module: "ai-tutor-rag",
          }
        : undefined

    const { content } = await createForFeature(openai, "tutor", {
      usageContext,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      temperature: 0.6,
      max_tokens: 1500
    })

    const response = content || ""

    // 5. Save conversation
    const conversationId = await sql`
      INSERT INTO ai_tutor_conversations (
        student_id, message, response, topic, created_at
      ) VALUES (
        ${studentId || null},
        ${message},
        ${response},
        ${context.topic || 'General'},
        NOW()
      )
      RETURNING id
    `

    // 6. Store question embedding for future similarity search
    try {
      await sql`
        INSERT INTO question_embeddings (
          conversation_id,
          question,
          embedding,
          topic,
          student_id
        ) VALUES (
          ${conversationId[0].id},
          ${message},
          ${vectorString}::vector,
          ${context.topic || 'General'},
          ${studentId || null}
        )
      `
    } catch (embError) {
      console.error('[RAG] Failed to store question embedding:', embError)
      // Non-critical, continue
    }

    return NextResponse.json({
      success: true,
      response,
      sources,
      usedRAG: sources.length > 0,
      topic: context.topic || 'General'
    })

  } catch (error: any) {
    console.error("[RAG Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to process RAG request",
        details: error.message 
      },
      { status: 500 }
    )
  }
}

