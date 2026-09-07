import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = 'force-dynamic'
export const runtime = "nodejs"

/**
 * GET /api/instructor/data-management/stats
 * Get statistics for all data types
 */
export async function GET(request: NextRequest) {
  try {
    // Verify instructor authentication
    const instructorSession = request.headers.get("authorization") || request.headers.get("x-instructor-id")
    
    if (!instructorSession) {
      return NextResponse.json({ error: "Instructor authentication required" }, { status: 401 })
    }

    // Helper function to safely get count from a table
    const getTableCount = async (tableName: string): Promise<number> => {
      try {
        // First check if table exists
        const tableExists = await sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = ${tableName}
          )
        `
        
        if (!tableExists[0]?.exists) {
          console.log(`[Stats] Table ${tableName} does not exist`)
          return 0
        }

        // Get count (handle deleted_at if it exists)
        try {
          // Try with deleted_at filter first (for soft-deleted records)
          const result = await sql`
            SELECT COUNT(*) as count 
            FROM ${sql.unsafe(tableName)} 
            WHERE deleted_at IS NULL
          `
          const count = Number(result[0]?.count || 0)
          if (count > 0) {
            console.log(`[Stats] ${tableName}: ${count} records`)
          }
          return count
        } catch (e: any) {
          // If deleted_at doesn't exist or column doesn't exist, get all records
          try {
            const result = await sql`
              SELECT COUNT(*) as count 
              FROM ${sql.unsafe(tableName)}
            `
            const count = Number(result[0]?.count || 0)
            if (count > 0) {
              console.log(`[Stats] ${tableName}: ${count} records (no deleted_at column)`)
            }
            return count
          } catch (error2: any) {
            console.error(`[Stats] Error counting ${tableName}:`, error2.message)
            return 0
          }
        }
      } catch (error: any) {
        console.error(`[Stats] Error checking ${tableName}:`, error.message)
        return 0
      }
    }

    // Get counts for all data types (with error handling)
    const [
      students,
      groups,
      groupMembers,
      projects,
      quizzes,
      homeworks,
      midsemExams,
      finalExams,
      practiceAssessments,
      quizAttempts,
      quizAnswers,
      quizQuestions,
      practiceAttempts,
      practiceAnswers,
      playgroundSessions,
      playgroundResults,
      userQuizzes,
      userQuizAttempts,
      announcements,
      lectures,
      lectureSlides,
      forumPosts,
      forumReplies,
      classroomPoints,
    ] = await Promise.all([
      getTableCount('students'),
      getTableCount('groups'),
      getTableCount('group_members'),
      getTableCount('projects'),
      getTableCount('quizzes'),
      getTableCount('homeworks'),
      getTableCount('midsem_exams'),
      getTableCount('final_exams'),
      getTableCount('practice_assessments'),
      getTableCount('quiz_attempts'),
      getTableCount('quiz_answers'),
      getTableCount('quiz_questions'),
      getTableCount('practice_attempts'),
      getTableCount('practice_answers'),
      getTableCount('playground_sessions'),
      getTableCount('playground_results'),
      getTableCount('user_quizzes'),
      getTableCount('user_quiz_attempts'),
      getTableCount('announcements'),
      getTableCount('lectures'),
      getTableCount('lecture_slides'),
      getTableCount('forum_posts'),
      getTableCount('forum_replies'),
      getTableCount('classroom_points'),
    ])

    const stats = {
      students,
      groups,
      groupMembers,
      projects,
      quizzes,
      homeworks,
      midsemExams,
      finalExams,
      practiceAssessments,
      quizAttempts,
      quizAnswers,
      quizQuestions,
      practiceAttempts,
      practiceAnswers,
      playgroundSessions,
      playgroundResults,
      userQuizzes,
      userQuizAttempts,
      announcements,
      lectures,
      lectureSlides,
      forumPosts,
      forumReplies,
      classroomPoints,
    }

    // Log summary
    const totalRecords = Object.values(stats).reduce((sum, count) => sum + count, 0)
    console.log(`[Stats] Total records across all tables: ${totalRecords.toLocaleString()}`)
    console.log(`[Stats] Summary:`, {
      students,
      groups,
      projects,
      quizzes,
      homeworks,
      midsemExams,
      finalExams,
      quizAttempts,
      quizAnswers,
    })

    return NextResponse.json({ stats })
  } catch (error: any) {
    console.error("[Data Management Stats] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch statistics", details: error.message },
      { status: 500 }
    )
  }
}

