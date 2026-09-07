import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireProjectReadAccess, studentDbIdFromGroupsRequest } from "@/lib/project-request-auth"

export const dynamic = "force-dynamic"

// Like/unlike a project
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, likerId } = body

    if (!projectId || !likerId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const access = await requireProjectReadAccess(request, Number(projectId))
    if (!access.ok) return access.response
    const studentDbId = await studentDbIdFromGroupsRequest(request)
    if (studentDbId == null || studentDbId !== Number(likerId)) {
      return NextResponse.json({ error: "Student authentication required" }, { status: 401 })
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
      SELECT id FROM students WHERE id = ${likerId}
    `

    if (student.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    // Check if already liked
    const existingLike = await sql`
      SELECT id FROM project_likes WHERE project_id = ${projectId} AND liker_id = ${likerId}
    `

    if (existingLike.length > 0) {
      // Unlike
      await sql`
        DELETE FROM project_likes WHERE project_id = ${projectId} AND liker_id = ${likerId}
      `
      return NextResponse.json({ success: true, liked: false })
    } else {
      // Like
      const result = await sql`
        INSERT INTO project_likes (project_id, liker_id)
        VALUES (${projectId}, ${likerId})
        RETURNING id
      `
      return NextResponse.json({ success: true, liked: true, likeId: result[0].id })
    }

  } catch (error) {
    console.error("Error liking project:", error)
    return NextResponse.json({ error: "Failed to like project" }, { status: 500 })
  }
}

// Get likes for a project
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 })
    }

    const access = await requireProjectReadAccess(request, Number(projectId))
    if (!access.ok) return access.response

    // Get like count
    const likeCount = await sql`
      SELECT COUNT(*) as count FROM project_likes WHERE project_id = ${projectId}
    `

    // Check if user has liked
    const likerId = searchParams.get("likerId")
    let userLiked = false
    
    if (likerId) {
      const userLike = await sql`
        SELECT id FROM project_likes WHERE project_id = ${projectId} AND liker_id = ${likerId}
      `
      userLiked = userLike.length > 0
    }

    return NextResponse.json({
      likeCount: parseInt(likeCount[0]?.count) || 0,
      userLiked
    })

  } catch (error) {
    console.error("Error fetching project likes:", error)
    return NextResponse.json({ error: "Failed to fetch likes" }, { status: 500 })
  }
}







