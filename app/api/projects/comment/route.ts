import { NextRequest, NextResponse } from "next/server"
import { getSQL } from "@/lib/db"
import { requireProjectReadAccess, studentDbIdFromGroupsRequest } from "@/lib/project-request-auth"

const sql = getSQL()

export const dynamic = "force-dynamic"

// Add comment to a project
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, commenterId, commentText, parentCommentId } = body

    if (!projectId || !commenterId || !commentText) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const access = await requireProjectReadAccess(request, Number(projectId))
    if (!access.ok) return access.response
    const studentDbId = await studentDbIdFromGroupsRequest(request)
    if (studentDbId == null || studentDbId !== Number(commenterId)) {
      return NextResponse.json({ error: "Student authentication required" }, { status: 401 })
    }

    if (commentText.trim().length === 0) {
      return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 })
    }

    // Check if project exists and is approved
    const project = await sql`
      SELECT id, status FROM projects WHERE id = ${projectId} AND status = 'approved'
    `

    if (project.length === 0) {
      return NextResponse.json({ error: "Project not found or not approved" }, { status: 404 })
    }

    // Check if student exists
    const student = await sql`
      SELECT id, full_name FROM students WHERE id = ${commenterId}
    `

    if (student.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    // If replying to a comment, check if parent comment exists
    if (parentCommentId) {
      const parentComment = await sql`
        SELECT id FROM project_comments WHERE id = ${parentCommentId} AND project_id = ${projectId}
      `
      if (parentComment.length === 0) {
        return NextResponse.json({ error: "Parent comment not found" }, { status: 404 })
      }
    }

    // Insert comment
    const result = await sql`
      INSERT INTO project_comments (project_id, commenter_id, comment_text, parent_comment_id)
      VALUES (${projectId}, ${commenterId}, ${commentText.trim()}, ${parentCommentId || null})
      RETURNING id, created_at
    `

    return NextResponse.json({ 
      success: true, 
      commentId: result[0].id,
      createdAt: result[0].created_at,
      commenterName: student[0].full_name
    })

  } catch (error) {
    console.error("Error adding comment:", error)
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 })
  }
}

// Get comments for a project
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const offset = (page - 1) * limit

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 })
    }

    const access = await requireProjectReadAccess(request, Number(projectId))
    if (!access.ok) return access.response

    // Get comments with commenter info
    const comments = await sql`
      SELECT 
        pc.id,
        pc.comment_text,
        pc.parent_comment_id,
        pc.likes_count,
        pc.created_at,
        pc.updated_at,
        s.full_name as commenter_name,
        s.student_id as commenter_student_id
      FROM project_comments pc
      JOIN students s ON pc.commenter_id = s.id
      WHERE pc.project_id = ${projectId}
      ORDER BY pc.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `

    // Get total count
    const totalCount = await sql`
      SELECT COUNT(*) as count FROM project_comments WHERE project_id = ${projectId}
    `

    return NextResponse.json({
      comments: comments.map(comment => ({
        id: comment.id,
        commentText: comment.comment_text,
        parentCommentId: comment.parent_comment_id,
        likesCount: comment.likes_count,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        commenterName: comment.commenter_name,
        commenterStudentId: comment.commenter_student_id
      })),
      totalCount: parseInt(totalCount[0]?.count) || 0,
      page,
      limit,
      hasMore: offset + comments.length < parseInt(totalCount[0]?.count)
    })

  } catch (error) {
    console.error("Error fetching comments:", error)
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 })
  }
}

// Update comment
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { commentId, commenterId, commentText } = body

    if (!commentId || !commenterId || !commentText) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const studentDbId = await studentDbIdFromGroupsRequest(request)
    if (studentDbId == null || studentDbId !== Number(commenterId)) {
      return NextResponse.json({ error: "Student authentication required" }, { status: 401 })
    }

    if (commentText.trim().length === 0) {
      return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 })
    }

    // Check if comment exists and belongs to commenter
    const comment = await sql`
      SELECT id FROM project_comments WHERE id = ${commentId} AND commenter_id = ${commenterId}
    `

    if (comment.length === 0) {
      return NextResponse.json({ error: "Comment not found or unauthorized" }, { status: 404 })
    }

    // Update comment
    await sql`
      UPDATE project_comments 
      SET comment_text = ${commentText.trim()}, updated_at = NOW()
      WHERE id = ${commentId}
    `

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error("Error updating comment:", error)
    return NextResponse.json({ error: "Failed to update comment" }, { status: 500 })
  }
}

// Delete comment
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const commentId = searchParams.get("commentId")
    const commenterId = searchParams.get("commenterId")

    if (!commentId || !commenterId) {
      return NextResponse.json({ error: "Comment ID and commenter ID required" }, { status: 400 })
    }

    const studentDbId = await studentDbIdFromGroupsRequest(request)
    if (studentDbId == null || studentDbId !== Number(commenterId)) {
      return NextResponse.json({ error: "Student authentication required" }, { status: 401 })
    }

    // Check if comment exists and belongs to commenter
    const comment = await sql`
      SELECT id FROM project_comments WHERE id = ${commentId} AND commenter_id = ${commenterId}
    `

    if (comment.length === 0) {
      return NextResponse.json({ error: "Comment not found or unauthorized" }, { status: 404 })
    }

    // Delete comment (cascade will handle replies)
    await sql`
      DELETE FROM project_comments WHERE id = ${commentId}
    `

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error("Error deleting comment:", error)
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 })
  }
}







