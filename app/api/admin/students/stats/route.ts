import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    // Fetch student management statistics
    const [
      totalStudents,
      activeStudents,
      newEnrollments,
      averagePerformance,
      topPerformers,
      membershipDistribution,
      sessionDistribution,
      recentActivity
    ] = await Promise.all([
      // Total students
      sql`SELECT COUNT(*) as total FROM students`,
      
      // Active students
      sql`SELECT COUNT(*) as active FROM students WHERE is_active = true`,
      
      // New enrollments this month
      sql`SELECT COUNT(*) as new FROM students WHERE created_at > NOW() - INTERVAL '30 days'`,
      
      // Average performance
      sql`
        SELECT AVG(qa.score) as avg_performance
        FROM quiz_attempts qa
        WHERE qa.created_at > NOW() - INTERVAL '30 days'
      `,
      
      // Top performers
      sql`
        SELECT 
          s.full_name as student_name,
          AVG(qa.score) as score,
          COUNT(qa.id) as attempts
        FROM students s
        JOIN quiz_attempts qa ON s.id = qa.student_id
        WHERE qa.created_at > NOW() - INTERVAL '30 days'
        GROUP BY s.id, s.full_name
        ORDER BY score DESC, attempts DESC
        LIMIT 5
      `,
      
      // Membership distribution
      sql`
        SELECT 
          COALESCE(sm.membership_tier, 'Scholar') as tier,
          COUNT(*) as count
        FROM students s
        LEFT JOIN student_memberships sm ON s.id = sm.student_id
        GROUP BY sm.membership_tier
        ORDER BY count DESC
      `,
      
      // Session distribution
      sql`
        SELECT 
          session_code,
          COUNT(*) as count
        FROM students
        GROUP BY session_code
        ORDER BY count DESC
      `,
      
      // Recent activity
      sql`
        SELECT 
          s.full_name as student_name,
          'Quiz attempt' as action,
          qa.created_at as timestamp
        FROM students s
        JOIN quiz_attempts qa ON s.id = qa.student_id
        WHERE qa.created_at > NOW() - INTERVAL '7 days'
        ORDER BY qa.created_at DESC
        LIMIT 10
      `
    ])

    // Format statistics
    const stats = {
      total_students: Number(totalStudents[0]?.total || 0),
      active_students: Number(activeStudents[0]?.active || 0),
      new_enrollments: Number(newEnrollments[0]?.new || 0),
      average_performance: Number(averagePerformance[0]?.avg_performance || 0),
      top_performers: topPerformers.map((p: any) => ({
        student_name: p.student_name,
        score: Number(p.score || 0),
        attempts: Number(p.attempts || 0),
      })),
      membership_distribution: membershipDistribution.reduce((acc: Record<string, number>, row: any) => {
        acc[row.tier] = Number(row.count)
        return acc
      }, {}),
      session_distribution: sessionDistribution.reduce((acc: Record<string, number>, row: any) => {
        acc[row.session_code] = Number(row.count)
        return acc
      }, {}),
      recent_activity: recentActivity.map((a: any) => ({
        student_name: a.student_name,
        action: a.action,
        timestamp: a.timestamp,
      })),
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error("Failed to fetch student stats:", error)
    return NextResponse.json({ error: "Failed to fetch student stats" }, { status: 500 })
  }
}

