import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { requireProjectReadAccess } from "@/lib/project-request-auth"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"



export const dynamic = "force-dynamic"

/**
 * POST /api/projects/vote-stars
 * Submit a star rating (1-5) for a project
 * Supports both student and instructor voting
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, voterId, voterType, rating, comment } = body

    // Validation
    if (!projectId || !voterId || !voterType || rating === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: projectId, voterId, voterType, rating" },
        { status: 400 }
      )
    }

    if (!['student', 'instructor'].includes(voterType)) {
      return NextResponse.json(
        { error: "Invalid voter type. Must be 'student' or 'instructor'" },
        { status: 400 }
      )
    }

    const readAccess = await requireProjectReadAccess(request, Number(projectId))
    if (!readAccess.ok) return readAccess.response
    if (voterType === "instructor") {
      const session = await requireInstructorSession(request)
      if (!session.ok) return session.response
      if (session.instructorId !== Number(voterId)) {
        return NextResponse.json({ error: "Instructor authentication required" }, { status: 401 })
      }
    } else {
      const bound = await requireBoundStudentCaller(request, String(voterId))
      if (!bound.ok) return bound.response
    }

    // No validation on rating value - we accept any decimal 0-5
    // Instructor: 0-20 points converted to 0-5 (e.g., 18 pts = 4.5)
    // Student: always 1 (not used in calculation)

    // Check if project exists and is approved
    const project = await sql`
      SELECT id, status FROM projects 
      WHERE id = ${projectId} AND status = 'approved' AND deleted_at IS NULL
    `

    if (project.length === 0) {
      return NextResponse.json(
        { error: "Project not found or not approved" },
        { status: 404 }
      )
    }

    // Verify voter exists (check appropriate table based on voter type)
    if (voterType === 'student') {
      const student = await sql`SELECT id FROM students WHERE id = ${voterId}`
      if (student.length === 0) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 })
      }
    } else if (voterType === 'instructor') {
      const instructor = await sql`SELECT id FROM instructors WHERE id = ${voterId}`
      if (instructor.length === 0) {
        return NextResponse.json({ error: "Instructor not found" }, { status: 404 })
      }
    }

    // Calculate actual points from rating
    // Instructor: rating is already points/4, so points = rating * 4
    // Student: 1 vote = 1 point
    const points = voterType === 'instructor' ? rating * 4 : 1;

    // Insert or update the rating with actual points
    const result = await sql`
      INSERT INTO project_votes_stars (
        project_id, voter_id, voter_type, rating, points, comment, updated_at
      )
      VALUES (
        ${projectId}, ${voterId}, ${voterType}, ${rating}, ${points}, ${comment || null}, NOW()
      )
      ON CONFLICT (project_id, voter_id, voter_type) 
      DO UPDATE SET 
        rating = ${rating},
        points = ${points},
        comment = ${comment || null}, 
        updated_at = NOW()
      RETURNING id, rating, points, voter_type
    `

    // The trigger will automatically update project_scores

    return NextResponse.json({
      success: true,
      voteId: result[0].id,
      rating: result[0].rating,
      points: result[0].points,
      voterType: result[0].voter_type,
      message: "Score submitted successfully"
    })

  } catch (error) {
    console.error("Error submitting star rating:", error)
    return NextResponse.json(
      { error: "Failed to submit rating" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/projects/vote-stars
 * Get voting statistics for a project
 * Returns breakdown by student/instructor votes and total score
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")
    const voterId = searchParams.get("voterId")
    const voterType = searchParams.get("voterType")

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID required" },
        { status: 400 }
      )
    }

    const access = await requireProjectReadAccess(request, Number(projectId))
    if (!access.ok) return access.response

    // Get overall project score
    const scoreData = await sql`
      SELECT 
        student_votes_count,
        instructor_votes_count,
        student_avg_rating,
        instructor_avg_rating,
        student_points,
        instructor_points,
        total_score,
        last_updated
      FROM project_scores
      WHERE project_id = ${projectId}
    `

    // Get individual voter's rating if voterId provided
    let userVote = null
    if (voterId && voterType) {
      const userVoteResult = await sql`
        SELECT rating, comment, created_at, updated_at
        FROM project_votes_stars
        WHERE project_id = ${projectId} 
        AND voter_id = ${voterId} 
        AND voter_type = ${voterType}
      `
      userVote = userVoteResult[0] || null
    }

    // Get rating distribution
    const ratingDistribution = await sql`
      SELECT 
        rating,
        voter_type,
        COUNT(*) as count
      FROM project_votes_stars
      WHERE project_id = ${projectId}
      GROUP BY rating, voter_type
      ORDER BY rating DESC, voter_type
    `

    const score = scoreData[0] || {
      student_votes_count: 0,
      instructor_votes_count: 0,
      student_avg_rating: 0,
      instructor_avg_rating: 0,
      student_points: 0,
      instructor_points: 0,
      total_score: 0
    }

    return NextResponse.json({
      projectId: parseInt(projectId),
      score: {
        studentVotes: parseInt(score.student_votes_count) || 0,
        instructorVotes: parseInt(score.instructor_votes_count) || 0,
        studentAvgRating: parseFloat(score.student_avg_rating) || 0,
        instructorAvgRating: parseFloat(score.instructor_avg_rating) || 0,
        studentPoints: parseFloat(score.student_points) || 0,
        instructorPoints: parseFloat(score.instructor_points) || 0,
        totalScore: parseFloat(score.total_score) || 0,
        lastUpdated: score.last_updated
      },
      userVote: userVote ? {
        rating: userVote.rating,
        comment: userVote.comment,
        createdAt: userVote.created_at,
        updatedAt: userVote.updated_at
      } : null,
      ratingDistribution: ratingDistribution.map(r => ({
        rating: r.rating,
        voterType: r.voter_type,
        count: parseInt(r.count)
      })),
    })

  } catch (error) {
    console.error("Error fetching star rating data:", error)
    return NextResponse.json(
      { error: "Failed to fetch rating data" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/projects/vote-stars
 * Remove a star rating (allow users to retract their vote)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")
    const voterId = searchParams.get("voterId")
    const voterType = searchParams.get("voterType")

    if (!projectId || !voterId || !voterType) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      )
    }

    const access = await requireProjectReadAccess(request, Number(projectId))
    if (!access.ok) return access.response
    if (voterType === "instructor") {
      const session = await requireInstructorSession(request)
      if (!session.ok) return session.response
      if (session.instructorId !== Number(voterId)) {
        return NextResponse.json({ error: "Instructor authentication required" }, { status: 401 })
      }
    } else {
      const bound = await requireBoundStudentCaller(request, String(voterId))
      if (!bound.ok) return bound.response
    }

    const result = await sql`
      DELETE FROM project_votes_stars
      WHERE project_id = ${projectId}
      AND voter_id = ${voterId}
      AND voter_type = ${voterType}
      RETURNING id
    `

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Vote not found" },
        { status: 404 }
      )
    }

    // The trigger will automatically update project_scores

    return NextResponse.json({
      success: true,
      message: "Rating removed successfully"
    })

  } catch (error) {
    console.error("Error removing star rating:", error)
    return NextResponse.json(
      { error: "Failed to remove rating" },
      { status: 500 }
    )
  }
}

