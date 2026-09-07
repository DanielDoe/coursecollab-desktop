import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { studentId, threadId, replyId, voteType } = body

    if (!studentId || !voteType || (!threadId && !replyId)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Check if vote already exists
    const existingVote = await sql`
      SELECT * FROM forum_votes
      WHERE student_id = ${studentId}
        AND (thread_id = ${threadId || null} OR reply_id = ${replyId || null})
    `

    if (existingVote.length > 0) {
      // Update existing vote
      await sql`
        UPDATE forum_votes
        SET vote_type = ${voteType}
        WHERE student_id = ${studentId}
          AND (thread_id = ${threadId || null} OR reply_id = ${replyId || null})
      `
    } else {
      // Insert new vote
      await sql`
        INSERT INTO forum_votes (student_id, thread_id, reply_id, vote_type)
        VALUES (${studentId}, ${threadId || null}, ${replyId || null}, ${voteType})
      `
    }

    // Update vote counts
    if (threadId) {
      const votes = await sql`
        SELECT 
          COUNT(*) FILTER (WHERE vote_type = 'upvote') as upvotes,
          COUNT(*) FILTER (WHERE vote_type = 'downvote') as downvotes
        FROM forum_votes
        WHERE thread_id = ${threadId}
      `

      await sql`
        UPDATE forum_threads
        SET upvotes = ${votes[0].upvotes}, downvotes = ${votes[0].downvotes}
        WHERE id = ${threadId}
      `
    } else if (replyId) {
      const votes = await sql`
        SELECT 
          COUNT(*) FILTER (WHERE vote_type = 'upvote') as upvotes,
          COUNT(*) FILTER (WHERE vote_type = 'downvote') as downvotes
        FROM forum_votes
        WHERE reply_id = ${replyId}
      `

      await sql`
        UPDATE forum_replies
        SET upvotes = ${votes[0].upvotes}, downvotes = ${votes[0].downvotes}
        WHERE id = ${replyId}
      `
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to vote:", error)
    return NextResponse.json({ error: "Failed to vote" }, { status: 500 })
  }
}
