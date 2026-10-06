import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { listStudentOpenPlaygroundLobbies } from "@/lib/playground-open-lobby"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"
import { resolveStudentCourseContextForRequest } from "@/lib/student-course-scope"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const studentId = request.nextUrl.searchParams.get("studentId")
  const auth = await requireBoundStudentCaller(request, studentId)
  if (!auth.ok) return auth.response

  try {
    const ctx = await resolveStudentCourseContextForRequest(request, auth.studentDbId)
    if (!ctx?.courseId) {
      return NextResponse.json({ lobbies: [] })
    }

    const profile = (await sql`
      SELECT student_id
      FROM students
      WHERE id = ${auth.studentDbId} AND deleted_at IS NULL
      LIMIT 1
    `) as { student_id: string }[]
    const rosterStudentId = profile[0]?.student_id
    if (!rosterStudentId) {
      return NextResponse.json({ lobbies: [] })
    }

    const lobbies = await listStudentOpenPlaygroundLobbies(ctx, String(rosterStudentId))
    return NextResponse.json({ lobbies })
  } catch (error) {
    console.error("[playground open-lobbies]", error)
    return NextResponse.json({ error: "Could not load open playground lobbies." }, { status: 500 })
  }
}
