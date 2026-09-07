import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { generateEmbedding, formatVectorForPg } from "@/lib/embeddings"

export const dynamic = "force-dynamic"

/**
 * Generate embeddings for lecture content
 * This populates the document_embeddings table for RAG
 */
export async function POST(request: NextRequest) {
  try {
    const { content, source, sourceType, weekNumber, pageNumber, metadata = {} } = await request.json()

    if (!content || !content.trim()) {
      return NextResponse.json(
        { success: false, error: "Content is required" },
        { status: 400 }
      )
    }


    // Generate embedding
    const embedding = await generateEmbedding(content)
    const vectorString = formatVectorForPg(embedding)

    // Store in database
    const result = await sql`
      INSERT INTO document_embeddings (
        content,
        embedding,
        source,
        source_type,
        week_number,
        page_number,
        metadata
      ) VALUES (
        ${content},
        ${vectorString}::vector,
        ${source},
        ${sourceType || 'lecture'},
        ${weekNumber || null},
        ${pageNumber || null},
        ${JSON.stringify(metadata)}
      )
      RETURNING id
    `


    return NextResponse.json({
      success: true,
      message: "Embedding generated and stored successfully",
      embeddingId: result[0].id,
      source
    })

  } catch (error: any) {
    console.error("[Embedding Generation Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to generate embedding",
        details: error.message 
      },
      { status: 500 }
    )
  }
}

/**
 * Batch generate embeddings for multiple documents
 */
export async function PUT(request: NextRequest) {
  try {
    const { documents } = await request.json()

    if (!Array.isArray(documents) || documents.length === 0) {
      return NextResponse.json(
        { success: false, error: "Documents array is required" },
        { status: 400 }
      )
    }

    console.log(`[Embeddings Batch] Processing ${documents.length} documents`)

    const results = []
    let successCount = 0
    let errorCount = 0

    for (const doc of documents) {
      try {
        const embedding = await generateEmbedding(doc.content)
        const vectorString = formatVectorForPg(embedding)

        const result = await sql`
          INSERT INTO document_embeddings (
            content, embedding, source, source_type, week_number, page_number, metadata
          ) VALUES (
            ${doc.content},
            ${vectorString}::vector,
            ${doc.source},
            ${doc.sourceType || 'lecture'},
            ${doc.weekNumber || null},
            ${doc.pageNumber || null},
            ${JSON.stringify(doc.metadata || {})}
          )
          RETURNING id
        `

        results.push({
          source: doc.source,
          embeddingId: result[0].id,
          success: true
        })
        successCount++

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error: any) {
        console.error(`[Embeddings Batch] Error for ${doc.source}:`, error)
        results.push({
          source: doc.source,
          error: error.message,
          success: false
        })
        errorCount++
      }
    }

    console.log(`[Embeddings Batch] Complete: ${successCount} success, ${errorCount} errors`)

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: documents.length,
        successful: successCount,
        failed: errorCount
      }
    })

  } catch (error: any) {
    console.error("[Batch Embedding Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to process batch embeddings",
        details: error.message 
      },
      { status: 500 }
    )
  }
}

