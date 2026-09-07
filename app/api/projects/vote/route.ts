import { NextRequest, NextResponse } from "next/server"
import { getSQL } from "@/lib/db"
import { requireProjectReadAccess, studentDbIdFromGroupsRequest } from "@/lib/project-request-auth"

const sql = getSQL()

export const dynamic = "force-dynamic"

// Vote on a project (upvote/downvote)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, voterId, voteType } = body

    if (!projectId || !voterId || !voteType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const access = await requireProjectReadAccess(request, Number(projectId))
    if (!access.ok) return access.response
    const studentDbId = await studentDbIdFromGroupsRequest(request)
    if (studentDbId == null || studentDbId !== Number(voterId)) {
      return NextResponse.json({ error: "Student authentication required" }, { status: 401 })
    }

    if (!['upvote', 'downvote'].includes(voteType)) {
      return NextResponse.json({ error: "Invalid vote type" }, { status: 400 })
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
      SELECT id FROM students WHERE id = ${voterId}
    `

    if (student.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    // Insert or update vote
    const result = await sql`
      INSERT INTO project_votes (project_id, voter_id, vote_type)
      VALUES (${projectId}, ${voterId}, ${voteType})
      ON CONFLICT (project_id, voter_id) 
      DO UPDATE SET vote_type = ${voteType}, updated_at = NOW()
      RETURNING id, vote_type
    `

    return NextResponse.json({ 
      success: true, 
      voteId: result[0].id,
      voteType: result[0].vote_type 
    })

  } catch (error) {
    console.error("Error voting on project:", error)
    return NextResponse.json({ error: "Failed to vote on project" }, { status: 500 })
  }
}

// Get votes for a project
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 })
    }

    const access = await requireProjectReadAccess(request, Number(projectId))
    if (!access.ok) return access.response

    // Get vote counts
    const voteStats = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE vote_type = 'upvote') as upvotes,
        COUNT(*) FILTER (WHERE vote_type = 'downvote') as downvotes,
        COUNT(*) as total_votes
      FROM project_votes 
      WHERE project_id = ${projectId}
    `

    // Get individual votes (for checking if user has voted)
    const voterId = searchParams.get("voterId")
    let userVote = null
    
    if (voterId) {
      const userVoteResult = await sql`
        SELECT vote_type FROM project_votes 
        WHERE project_id = ${projectId} AND voter_id = ${voterId}
      `
      userVote = userVoteResult[0]?.vote_type || null
    }

    return NextResponse.json({
      upvotes: parseInt(voteStats[0]?.upvotes) || 0,
      downvotes: parseInt(voteStats[0]?.downvotes) || 0,
      totalVotes: parseInt(voteStats[0]?.total_votes) || 0,
      userVote,
    })

  } catch (error) {
    console.error("Error fetching project votes:", error)
    return NextResponse.json({ error: "Failed to fetch votes" }, { status: 500 })
  }
}

// Remove vote
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")
    const voterId = searchParams.get("voterId")

    if (!projectId || !voterId) {
      return NextResponse.json({ error: "Project ID and voter ID required" }, { status: 400 })
    }

    const access = await requireProjectReadAccess(request, Number(projectId))
    if (!access.ok) return access.response
    const studentDbId = await studentDbIdFromGroupsRequest(request)
    if (studentDbId == null || studentDbId !== Number(voterId)) {
      return NextResponse.json({ error: "Student authentication required" }, { status: 401 })
    }

    await sql`
      DELETE FROM project_votes 
      WHERE project_id = ${projectId} AND voter_id = ${voterId}
    `

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error("Error removing vote:", error)
    return NextResponse.json({ error: "Failed to remove vote" }, { status: 500 })
  }
}







