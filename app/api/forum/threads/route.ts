import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"
export const revalidate = 20 // Cache for 20 seconds (forum updates moderately)
export const maxDuration = 30

export async function GET(request: NextRequest) {
  const perfStart = Date.now()
  
  try {
    const { searchParams } = new URL(request.url)
    const tag = searchParams.get("tag")
    const search = searchParams.get("search")
    const sortBy = searchParams.get("sortBy") || "recent"

    let threads

    if (tag) {
      threads = await sql`
        SELECT 
          t.*,
          s.full_name as author_name,
          COALESCE(sr.points, 0) as author_reputation
        FROM forum_threads t
        LEFT JOIN students s ON t.student_id = s.id
        LEFT JOIN student_reputation sr ON t.student_id = sr.student_id
        WHERE ${tag} = ANY(t.tags)
        ORDER BY 
          CASE WHEN ${sortBy} = 'popular' THEN t.upvotes - t.downvotes END DESC,
          CASE WHEN ${sortBy} = 'recent' THEN t.created_at END DESC
      `
    } else if (search) {
      threads = await sql`
        SELECT 
          t.*,
          s.full_name as author_name,
          COALESCE(sr.points, 0) as author_reputation
        FROM forum_threads t
        LEFT JOIN students s ON t.student_id = s.id
        LEFT JOIN student_reputation sr ON t.student_id = sr.student_id
        WHERE t.title ILIKE ${"%" + search + "%"} OR t.description ILIKE ${"%" + search + "%"}
        ORDER BY 
          CASE WHEN ${sortBy} = 'popular' THEN t.upvotes - t.downvotes END DESC,
          CASE WHEN ${sortBy} = 'recent' THEN t.created_at END DESC
      `
    } else {
      threads = await sql`
        SELECT 
          t.*,
          s.full_name as author_name,
          COALESCE(sr.points, 0) as author_reputation
        FROM forum_threads t
        LEFT JOIN students s ON t.student_id = s.id
        LEFT JOIN student_reputation sr ON t.student_id = sr.student_id
        ORDER BY 
          CASE WHEN ${sortBy} = 'popular' THEN t.upvotes - t.downvotes END DESC,
          CASE WHEN ${sortBy} = 'recent' THEN t.created_at END DESC
      `
    }

    console.log(`[Perf] /api/forum/threads GET completed in ${Date.now() - perfStart}ms (${threads.length} threads)`)
    
    return NextResponse.json({ threads })
  } catch (error) {
    console.error("Failed to fetch forum threads:", error)
    console.log(`[Perf] /api/forum/threads GET failed after ${Date.now() - perfStart}ms`)
    return NextResponse.json({ error: "Failed to fetch forum threads" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { studentId, title, description, codeSnippet, tags, isAnonymous } = body

    if (!studentId || !title || !description) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO forum_threads (student_id, title, description, code_snippet, tags, is_anonymous)
      VALUES (${studentId}, ${title}, ${description}, ${codeSnippet || null}, ${tags || []}, ${isAnonymous || false})
      RETURNING *
    `

    // Award reputation points for creating a thread
    await sql`
      INSERT INTO student_reputation (student_id, points)
      VALUES (${studentId}, 5)
      ON CONFLICT (student_id) 
      DO UPDATE SET points = student_reputation.points + 5, updated_at = CURRENT_TIMESTAMP
    `

    return NextResponse.json({ thread: result[0] })
  } catch (error) {
    console.error("Failed to create forum thread:", error)
    return NextResponse.json({ error: "Failed to create forum thread" }, { status: 500 })
  }
}
