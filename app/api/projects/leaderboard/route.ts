import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { checkMembershipAccess, createAccessDeniedResponse } from "@/lib/membership-guard"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { sanitizeProjectLeaderboardEntry } from "@/lib/student-privacy"
import { requireProjectsListScope } from "@/lib/project-request-auth"

export const dynamic = "force-dynamic"
export const revalidate = 0

// Get project leaderboard
export async function GET(request: NextRequest) {
  try {
    const scope = await requireProjectsListScope(request)
    if (!scope.ok) return scope.response
    const gCourseScope = scope.gCourseScope

    const { searchParams } = new URL(request.url)
    const session = searchParams.get("session")
    const timeframe = searchParams.get("timeframe") || "all" // all, week, month
    const limit = parseInt(searchParams.get("limit") || "20")
    const studentId = searchParams.get("studentId")
    const sessionVariants = session ? normalizedSectionVariantsForSql(session) : []

    // Check leaderboard access (Explorer+ required)
    if (studentId) {
      const access = await checkMembershipAccess(parseInt(studentId), "leaderboard")
      if (!access.allowed) {
        return NextResponse.json(
          createAccessDeniedResponse("Leaderboard", access.upgradeRequired!, access.tier),
          { status: 403 }
        )
      }
    }

    // Get top projects by STAR RATING SCORE (0-50 points)
    let topProjects
    if (session) {
      topProjects = await sql`
        SELECT 
          p.id, 
          p.title, 
          p.summary, 
          p.target_platform,
          p.project_link,
          g.session, 
          p.created_at,
          COALESCE(ps.total_score, 0) as engagement_score,
          COALESCE(ps.student_votes_count, 0) + COALESCE(ps.instructor_votes_count, 0) as vote_count,
          COALESCE(p.like_count, 0) as like_count,
          COALESCE(p.comment_count, 0) as comment_count,
          COALESCE(ps.student_points, 0) as student_points,
          COALESCE(ps.instructor_points, 0) as instructor_points,
          COALESCE(ps.student_avg_rating, 0) as student_avg_rating,
          COALESCE(ps.instructor_avg_rating, 0) as instructor_avg_rating,
          g.name as group_name, 
          s.full_name as leader_name, 
          s.student_id as leader_student_id,
          0 as vote_ratio,
          0 as recent_activity
        FROM projects p
        JOIN groups g ON p.group_id = g.id
        JOIN students s ON g.created_by = s.id
        LEFT JOIN project_scores ps ON p.id = ps.project_id
        WHERE p.status = 'approved' AND TRIM(g.session) = ANY(${sessionVariants}::text[])
          AND (${gCourseScope})
        ORDER BY ps.total_score DESC NULLS LAST, p.created_at DESC
        LIMIT ${limit}
      `
    } else if (timeframe === "week") {
      topProjects = await sql`
        SELECT 
          p.id, p.title, p.summary, p.target_platform, p.project_link, g.session, p.created_at,
          COALESCE(ps.total_score, 0) as engagement_score,
          COALESCE(ps.student_votes_count, 0) + COALESCE(ps.instructor_votes_count, 0) as vote_count,
          COALESCE(p.like_count, 0) as like_count,
          COALESCE(p.comment_count, 0) as comment_count,
          COALESCE(ps.student_points, 0) as student_points,
          COALESCE(ps.instructor_points, 0) as instructor_points,
          COALESCE(ps.student_avg_rating, 0) as student_avg_rating,
          COALESCE(ps.instructor_avg_rating, 0) as instructor_avg_rating,
          g.name as group_name, s.full_name as leader_name, s.student_id as leader_student_id,
          0 as vote_ratio,
          0 as recent_activity
        FROM projects p
        JOIN groups g ON p.group_id = g.id
        JOIN students s ON g.created_by = s.id
        LEFT JOIN project_scores ps ON p.id = ps.project_id
        WHERE p.status = 'approved' AND p.created_at >= NOW() - INTERVAL '7 days'
          AND (${gCourseScope})
        ORDER BY ps.total_score DESC NULLS LAST, p.created_at DESC
        LIMIT ${limit}
      `
    } else if (timeframe === "month") {
      topProjects = await sql`
        SELECT 
          p.id, p.title, p.summary, p.target_platform, p.project_link, g.session, p.created_at,
          COALESCE(ps.total_score, 0) as engagement_score,
          COALESCE(ps.student_votes_count, 0) + COALESCE(ps.instructor_votes_count, 0) as vote_count,
          COALESCE(p.like_count, 0) as like_count,
          COALESCE(p.comment_count, 0) as comment_count,
          COALESCE(ps.student_points, 0) as student_points,
          COALESCE(ps.instructor_points, 0) as instructor_points,
          COALESCE(ps.student_avg_rating, 0) as student_avg_rating,
          COALESCE(ps.instructor_avg_rating, 0) as instructor_avg_rating,
          g.name as group_name, s.full_name as leader_name, s.student_id as leader_student_id,
          0 as vote_ratio,
          0 as recent_activity
        FROM projects p
        JOIN groups g ON p.group_id = g.id
        JOIN students s ON g.created_by = s.id
        LEFT JOIN project_scores ps ON p.id = ps.project_id
        WHERE p.status = 'approved' AND p.created_at >= NOW() - INTERVAL '30 days'
          AND (${gCourseScope})
        ORDER BY ps.total_score DESC NULLS LAST, p.created_at DESC
        LIMIT ${limit}
      `
    } else {
      topProjects = await sql`
        SELECT 
          p.id, p.title, p.summary, p.target_platform, p.project_link, g.session, p.created_at,
          COALESCE(ps.total_score, 0) as engagement_score,
          COALESCE(ps.student_votes_count, 0) + COALESCE(ps.instructor_votes_count, 0) as vote_count,
          COALESCE(p.like_count, 0) as like_count,
          COALESCE(p.comment_count, 0) as comment_count,
          COALESCE(ps.student_points, 0) as student_points,
          COALESCE(ps.instructor_points, 0) as instructor_points,
          COALESCE(ps.student_avg_rating, 0) as student_avg_rating,
          COALESCE(ps.instructor_avg_rating, 0) as instructor_avg_rating,
          g.name as group_name, s.full_name as leader_name, s.student_id as leader_student_id,
          0 as vote_ratio,
          0 as recent_activity
        FROM projects p
        JOIN groups g ON p.group_id = g.id
        JOIN students s ON g.created_by = s.id
        LEFT JOIN project_scores ps ON p.id = ps.project_id
        WHERE p.status = 'approved'
          AND (${gCourseScope})
        ORDER BY ps.total_score DESC NULLS LAST, p.created_at DESC
        LIMIT ${limit}
      `
    }
    
    // Get engagement statistics using new star rating scores
    let stats
    if (session) {
      stats = await sql`
        SELECT 
          COUNT(p.id) as total_projects,
          SUM(COALESCE(ps.student_votes_count, 0) + COALESCE(ps.instructor_votes_count, 0)) as total_votes,
          SUM(COALESCE(p.like_count, 0)) as total_likes,
          SUM(COALESCE(p.comment_count, 0)) as total_comments,
          AVG(ps.total_score) as avg_engagement,
          MAX(ps.total_score) as max_engagement
        FROM projects p
        JOIN groups g ON p.group_id = g.id
        LEFT JOIN project_scores ps ON p.id = ps.project_id
        WHERE p.status = 'approved' AND TRIM(g.session) = ANY(${sessionVariants}::text[])
          AND (${gCourseScope})
      `
    } else {
      stats = await sql`
        SELECT 
          COUNT(p.id) as total_projects,
          SUM(COALESCE(ps.student_votes_count, 0) + COALESCE(ps.instructor_votes_count, 0)) as total_votes,
          SUM(COALESCE(p.like_count, 0)) as total_likes,
          SUM(COALESCE(p.comment_count, 0)) as total_comments,
          AVG(ps.total_score) as avg_engagement,
          MAX(ps.total_score) as max_engagement
        FROM projects p
        JOIN groups g ON p.group_id = g.id
        LEFT JOIN project_scores ps ON p.id = ps.project_id
        WHERE p.status = 'approved'
          AND (${gCourseScope})
      `
    }
    
    // Get top performers by session using star rating scores
    const sessionLeaders = await sql`
      SELECT 
        g.session,
        COUNT(p.id) as project_count,
        AVG(ps.total_score) as avg_engagement,
        MAX(ps.total_score) as top_score
      FROM projects p
      JOIN groups g ON p.group_id = g.id
      LEFT JOIN project_scores ps ON p.id = ps.project_id
      WHERE p.status = 'approved'
        AND (${gCourseScope})
      GROUP BY g.session
      ORDER BY avg_engagement DESC NULLS LAST
    `
    
    // Get trending projects (simplified - use engagement score)
    const trendingProjects = topProjects.slice(0, 10).map(p => ({
      id: p.id,
      title: p.title,
      engagement_score: p.engagement_score,
      recent_comments: 0,
      recent_likes: 0
    }))

    let currentStudentRosterId: string | null = null
    if (studentId) {
      const rosterRows = await sql`
        SELECT student_id FROM students WHERE id = ${parseInt(studentId, 10)} LIMIT 1
      `
      if (rosterRows.length > 0) {
        currentStudentRosterId = String(rosterRows[0].student_id)
      }
    }

    const mappedLeaderboard = topProjects.map((project, index) => ({
      rank: index + 1,
      id: project.id,
      title: project.title,
      summary: project.summary,
      platform: project.target_platform || 'Not specified',
      projectLink: project.project_link || null,
      timeline: 'N/A',
      session: project.session,
      createdAt: project.created_at,
      engagementScore: parseFloat(project.engagement_score) || 0,
      totalScore: parseFloat(project.engagement_score) || 0,
      studentPoints: parseFloat(project.student_points) || 0,
      instructorPoints: parseFloat(project.instructor_points) || 0,
      voteCount: parseInt(project.vote_count) || 0,
      likeCount: parseInt(project.like_count) || 0,
      commentCount: parseInt(project.comment_count) || 0,
      voteRatio: parseFloat(project.engagement_score) || 0,
      recentActivity: parseInt(project.recent_activity) || 0,
      groupName: project.group_name,
      leaderName: project.leader_name,
      leaderStudentId: project.leader_student_id
    }))

    const leaderboard = currentStudentRosterId
      ? mappedLeaderboard.map((entry) =>
          sanitizeProjectLeaderboardEntry(entry, currentStudentRosterId!, entry.rank as number)
        )
      : mappedLeaderboard

    return NextResponse.json({
      leaderboard,
      stats: {
        totalProjects: parseInt(stats[0]?.total_projects) || 0,
        totalVotes: parseInt(stats[0]?.total_votes) || 0,
        totalLikes: parseInt(stats[0]?.total_likes) || 0,
        totalComments: parseInt(stats[0]?.total_comments) || 0,
        avgEngagement: Math.round((parseFloat(stats[0]?.avg_engagement) || 0) * 10) / 10,
        maxEngagement: parseInt(stats[0]?.max_engagement) || 0
      },
      sessionLeaders: sessionLeaders.map(session => ({
        session: session.session,
        projectCount: parseInt(session.project_count) || 0,
        avgEngagement: Math.round((parseFloat(session.avg_engagement) || 0) * 10) / 10,
        topScore: parseInt(session.top_score) || 0
      })),
      trending: trendingProjects.map(project => ({
        id: project.id,
        title: project.title,
        engagementScore: project.engagement_score,
        recentComments: project.recent_comments,
        recentLikes: project.recent_likes,
        trendingScore: project.recent_comments * 2 + project.recent_likes
      })),
      privacyMode: Boolean(studentId),
    })

  } catch (error) {
    console.error("Error fetching leaderboard:", error)
    return NextResponse.json({ 
      error: "Failed to fetch leaderboard",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
