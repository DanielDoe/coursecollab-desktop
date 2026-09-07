import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import {
  countPlaygroundRows,
  logPlaygroundDeleteAudit,
} from "@/lib/playground-delete-audit"
import {
  checkStudentRecordDeleteAllowed,
  logStudentDataDeleteAudit,
  PROTECTED_STUDENT_DATA_TYPES,
  studentDataDeleteGuardResponse,
} from "@/lib/student-data-protection"

export const dynamic = 'force-dynamic'
export const runtime = "nodejs"
export const maxDuration = 120

/**
 * POST /api/instructor/data-management/clear
 * Clear specific data types
 * Body: { dataTypes: string[] } - array of data type names to clear
 */
export async function POST(request: NextRequest) {
  try {
    // Verify instructor authentication
    const instructorSession = request.headers.get("authorization") || request.headers.get("x-instructor-id")
    
    if (!instructorSession) {
      return NextResponse.json({ error: "Instructor authentication required" }, { status: 401 })
    }

    const body = await request.json()
    const { dataTypes, confirmPhrase } = body

    if (!Array.isArray(dataTypes) || dataTypes.length === 0) {
      return NextResponse.json({ error: "dataTypes array is required" }, { status: 400 })
    }

    const protectedSelected = dataTypes.filter((t: string) =>
      (PROTECTED_STUDENT_DATA_TYPES as readonly string[]).includes(t),
    )
    if (protectedSelected.length > 0) {
      const rowEstimate =
        protectedSelected.includes("playgroundSessions")
          ? (await countPlaygroundRows({})).results
          : 1
      const guard = checkStudentRecordDeleteAllowed({
        bulk: true,
        confirmPhrase,
        affectedRowEstimate: Math.max(rowEstimate, 1),
        operation: `Clear data types: ${protectedSelected.join(", ")}`,
      })
      if (guard.blocked) return studentDataDeleteGuardResponse(guard)
    }

    const cleared: string[] = []
    const errors: string[] = []

    // Define clearing operations
    const clearOperations: Record<string, () => Promise<void>> = {
      students: async () => {
        // Clear in order to respect foreign keys
        await sql`DELETE FROM quiz_attempts`
        await sql`DELETE FROM quiz_answers`
        await sql`DELETE FROM group_members`
        await sql`DELETE FROM groups`
        await sql`DELETE FROM students`
        cleared.push("students")
      },
      groups: async () => {
        await sql`DELETE FROM group_members`
        await sql`DELETE FROM groups`
        cleared.push("groups")
      },
      projects: async () => {
        await sql`DELETE FROM projects`
        cleared.push("projects")
      },
      quizAttempts: async () => {
        await sql`DELETE FROM quiz_answers`
        await sql`DELETE FROM quiz_attempts`
        cleared.push("quizAttempts")
      },
      quizAnswers: async () => {
        await sql`DELETE FROM quiz_answers`
        cleared.push("quizAnswers")
      },
      quizzes: async () => {
        await sql`DELETE FROM quiz_questions`
        await sql`DELETE FROM quizzes`
        cleared.push("quizzes")
      },
      homeworks: async () => {
        await sql`DELETE FROM homeworks`
        cleared.push("homeworks")
      },
      midsemExams: async () => {
        await sql`DELETE FROM midsem_exams`
        cleared.push("midsemExams")
      },
      finalExams: async () => {
        await sql`DELETE FROM final_exams`
        cleared.push("finalExams")
      },
      practiceAssessments: async () => {
        await sql`DELETE FROM practice_assessments`
        cleared.push("practiceAssessments")
      },
      practiceAttempts: async () => {
        await sql`DELETE FROM practice_answers`
        await sql`DELETE FROM practice_attempts`
        cleared.push("practiceAttempts")
      },
      playgroundSessions: async () => {
        const rowsBefore = await countPlaygroundRows({})
        await sql`DELETE FROM playground_answers`
        await sql`DELETE FROM playground_results`
        await sql`DELETE FROM playground_sessions`
        await logPlaygroundDeleteAudit({
          source: "api:instructor/data-management/clear",
          actorType: "instructor",
          actorId: Number.parseInt(String(instructorSession), 10) || null,
          rowsBefore,
          rowsDeleted: {
            answers: rowsBefore.answers,
            results: rowsBefore.results,
            sessions: rowsBefore.sessions,
          },
          metadata: { dataType: "playgroundSessions" },
        })
        cleared.push("playgroundSessions")
      },
      userQuizzes: async () => {
        await sql`DELETE FROM user_quiz_answers`
        await sql`DELETE FROM user_quiz_attempts`
        await sql`DELETE FROM user_quiz_questions`
        await sql`DELETE FROM user_quizzes`
        cleared.push("userQuizzes")
      },
      announcements: async () => {
        await sql`DELETE FROM announcements`
        cleared.push("announcements")
      },
      lectures: async () => {
        await sql`DELETE FROM lecture_slides`
        await sql`DELETE FROM lectures`
        cleared.push("lectures")
      },
      forumPosts: async () => {
        await sql`DELETE FROM forum_replies`
        await sql`DELETE FROM forum_posts`
        cleared.push("forumPosts")
      },
      classroomPoints: async () => {
        await sql`DELETE FROM classroom_points_answers`
        await sql`DELETE FROM classroom_points_attempts`
        await sql`DELETE FROM classroom_points_questions`
        await sql`DELETE FROM classroom_points`
        cleared.push("classroomPoints")
      },
    }

    // Execute clearing operations
    for (const dataType of dataTypes) {
      try {
        if (clearOperations[dataType]) {
          await clearOperations[dataType]()
        } else {
          errors.push(`Unknown data type: ${dataType}`)
        }
      } catch (error: any) {
        console.error(`[Clear Data] Error clearing ${dataType}:`, error)
        errors.push(`${dataType}: ${error.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      cleared,
      errors: errors.length > 0 ? errors : undefined,
      message: `Cleared ${cleared.length} data type(s)${errors.length > 0 ? ` with ${errors.length} error(s)` : ""}`,
    })
  } catch (error: any) {
    console.error("[Clear Data] Error:", error)
    return NextResponse.json(
      { error: "Failed to clear data", details: error.message },
      { status: 500 }
    )
  }
}

