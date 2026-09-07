import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAttemptOwnership, requireCallerStudentDbId } from "@/lib/student-api-auth"
import { resolveStudentDatabaseIdFromParam } from "@/lib/resolve-student-db-id"
import {
  getAttemptScoreHistory,
  getStudentQuizScoreHistory,
} from "@/lib/attempt-score-history"

export const dynamic = "force-dynamic"

function isInstructorRequest(request: NextRequest): boolean {
  return Boolean(
    request.headers.get("authorization")?.trim() ||
      request.headers.get("x-instructor-id")?.trim() ||
      request.headers.get("x-admin-id")?.trim(),
  )
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const attemptIdRaw = searchParams.get("attemptId")
    const quizIdRaw = searchParams.get("quizId")
    const studentIdRaw = searchParams.get("studentId")

    const attemptId = attemptIdRaw ? parseInt(attemptIdRaw, 10) : NaN
    const quizId = quizIdRaw ? parseInt(quizIdRaw, 10) : NaN

    const instructor = isInstructorRequest(request)

    if (quizIdRaw && studentIdRaw && !Number.isNaN(quizId)) {
      const studentDbId = await resolveStudentDatabaseIdFromParam(studentIdRaw)
      if (studentDbId == null) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 })
      }

      if (!instructor) {
        const caller = await requireCallerStudentDbId(request)
        if (!caller.ok) return caller.response
        if (caller.studentDbId !== studentDbId) {
          return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }
      }

      const history = await getStudentQuizScoreHistory(studentDbId, quizId)
      return NextResponse.json({ history, scope: "quiz" })
    }

    if (!attemptIdRaw || Number.isNaN(attemptId) || attemptId <= 0) {
      return NextResponse.json(
        { error: "Provide attemptId or quizId+studentId" },
        { status: 400 },
      )
    }

    if (!instructor) {
      const ownership = await requireAttemptOwnership(request, attemptId)
      if (!ownership.ok) return ownership.response
    }

    const history = await getAttemptScoreHistory(attemptId)
    return NextResponse.json({ history, scope: "attempt" })
  } catch (error) {
    console.error("[attempt-score-history GET]", error)
    return NextResponse.json({ error: "Failed to load score history" }, { status: 500 })
  }
}
