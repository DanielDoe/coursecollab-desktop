import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const quizId = searchParams.get("quizId")
    const studentId = searchParams.get("studentId")

    if (!quizId || !studentId) {
      return NextResponse.json({ error: "Missing quizId or studentId" }, { status: 400 })
    }

    // Get waiting list status for this student
    const waitingStatus = await sql`
      SELECT 
        wl.id,
        wl.position,
        wl.joined_at,
        wl.status,
        q.max_concurrent_students,
        (
          SELECT COUNT(*)
          FROM quiz_attempts qa
          WHERE qa.quiz_id = ${quizId}
            AND qa.started_at IS NOT NULL
            AND qa.completed_at IS NULL
            AND qa.started_at > NOW() - INTERVAL '2 hours'
        ) as active_students,
        (
          SELECT COUNT(*)
          FROM waiting_list wl2
          WHERE wl2.quiz_id = ${quizId}
            AND wl2.status = 'waiting'
            AND wl2.position < wl.position
        ) as students_ahead
      FROM waiting_list wl
      JOIN quizzes q ON wl.quiz_id = q.id
      WHERE wl.quiz_id = ${quizId}
        AND wl.student_id = ${studentId}
        AND wl.status = 'waiting'
      LIMIT 1
    `

    if (waitingStatus.length === 0) {
      // Not in waiting list - check if they can start
      const quizConfig = await sql`
        SELECT max_concurrent_students
        FROM quizzes
        WHERE id = ${quizId}
      `
      
      const maxConcurrent = quizConfig[0]?.max_concurrent_students
      
      if (maxConcurrent !== null && maxConcurrent !== undefined) {
        const activeCountResult = await sql`
          SELECT COUNT(*) as count
          FROM quiz_attempts qa
          WHERE qa.quiz_id = ${quizId}
            AND qa.started_at IS NOT NULL
            AND qa.completed_at IS NULL
            AND qa.started_at > NOW() - INTERVAL '2 hours'
        `
        
        const activeCount = Number(activeCountResult[0]?.count || 0)
        const availableSpots = maxConcurrent - activeCount
        
        return NextResponse.json({
          inWaitingList: false,
          canStart: availableSpots > 0,
          activeStudents: activeCount,
          maxConcurrent,
          availableSpots,
        })
      }
      
      return NextResponse.json({
        inWaitingList: false,
        canStart: true,
      })
    }

    const status = waitingStatus[0]
    const activeStudents = Number(status.active_students || 0)
    const maxConcurrent = Number(status.max_concurrent_students || 0)
    const availableSpots = maxConcurrent - activeStudents
    const studentsAhead = Number(status.students_ahead || 0)

    // Check if they should be admitted (spot available and they're next)
    const shouldBeAdmitted = availableSpots > 0 && studentsAhead === 0

    return NextResponse.json({
      inWaitingList: true,
      position: status.position,
      studentsAhead,
      activeStudents,
      maxConcurrent,
      availableSpots,
      shouldBeAdmitted,
      joinedAt: status.joined_at,
    })
  } catch (error) {
    console.error("[Waiting List Status] Error:", error)
    return NextResponse.json({ error: "Failed to get waiting list status" }, { status: 500 })
  }
}

