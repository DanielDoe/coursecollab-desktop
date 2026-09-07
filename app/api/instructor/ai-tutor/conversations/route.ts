import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { ensureFacultyCoraThreadsSchema } from "@/lib/cora/faculty-cora-threads"
import { facultyCoraCapability } from "@/lib/cora/faculty-capabilities"
import {
  aggregateCoraModules,
  aggregateCoraTopics,
  loadCoraInsightTurns,
} from "@/lib/cora/instructor-cora-insights"
import { listConsentedStudentIds } from "@/lib/cora/instructor-share-consent"

export const dynamic = "force-dynamic"

function parseMessages(raw: unknown): Array<{ role?: string; content?: string }> {
  if (Array.isArray(raw)) return raw as Array<{ role?: string; content?: string }>
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

export async function GET(request: NextRequest) {
  const instructorId = request.headers.get("x-instructor-id")
  if (!instructorId) {
    return NextResponse.json({ error: "Unauthorized", conversations: [] }, { status: 401 })
  }

  const scope = await requireInstructorCourse(request)
  const courseId = scope.ok ? scope.course.id : Number(request.headers.get("x-course-id") || 0)
  const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10) || 1)
  const limit = Math.min(25, Math.max(5, parseInt(request.nextUrl.searchParams.get("limit") ?? "8", 10) || 8))
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase()

  try {
    const turns = await loadCoraInsightTurns({
      instructorId: Number(instructorId),
      courseId: courseId || undefined,
    })
    const consented = await listConsentedStudentIds(turns.map((turn) => turn.studentId))

    const anonymous = {
      themes: aggregateCoraTopics(turns, 6).map((row) => ({
        topic: row.topic,
        questions: row.questions,
        students: row.students,
      })),
      modules: aggregateCoraModules(turns).slice(0, 6).map((row) => ({
        module: row.module,
        questions: row.questions,
        students: row.students,
      })),
      hiddenStudents: new Set(turns.map((t) => t.studentId)).size - consented.size,
    }

    const grouped = new Map<
      string,
      {
        id: string
        student_name: string
        student_id: string
        topic: string
        module_source: string
        turn_count: number
        last_active: Date
        summary: string
      }
    >()

    for (const turn of turns) {
      if (!consented.has(turn.studentId)) continue
      const key = `${turn.studentId}|${turn.topic}|${turn.module}`
      const existing = grouped.get(key)
      if (existing) {
        existing.turn_count += 1
        if (turn.createdAt > existing.last_active) existing.last_active = turn.createdAt
      } else {
        grouped.set(key, {
          id: key,
          student_name: turn.studentName,
          student_id: turn.studentCode,
          topic: turn.topic,
          module_source: turn.module,
          turn_count: 1,
          last_active: turn.createdAt,
          summary: `Asked about ${turn.topic} in ${turn.module}`,
        })
      }
    }

    await ensureFacultyCoraThreadsSchema()
    const faculty = courseId
      ? await sql`
          SELECT id, title, preview, messages, updated_at, capability_id
          FROM instructor_cora_threads
          WHERE instructor_id = ${Number(instructorId)}
            AND course_id = ${courseId}
            AND archived_at IS NULL
          ORDER BY updated_at DESC
          LIMIT 20
        `.catch(() => [])
      : []

    const conversations = [
      ...[...grouped.values()].map((row) => ({
        id: row.id,
        source: "student-assistant" as const,
        student_name: row.student_name,
        student_id: row.student_id,
        topic: row.topic,
        module_source: row.module_source,
        turn_count: row.turn_count,
        timestamp: row.last_active.toLocaleString(),
        created_at: row.last_active.toISOString(),
        summary: `${row.summary} · ${row.turn_count} turn${row.turn_count === 1 ? "" : "s"}`,
      })),
      ...(faculty as Array<Record<string, unknown>>).map((row) => {
        const capability = row.capability_id ? facultyCoraCapability(String(row.capability_id)) : null
        const messages = parseMessages(row.messages)
        return {
          id: `fac-${row.id}`,
          source: "faculty-copilot" as const,
          student_name: "You (Cora Copilot)",
          student_id: "faculty",
          topic: capability?.title ?? "Copilot",
          module_source: "Cora Copilot",
          turn_count: messages.length || 1,
          timestamp: new Date(String(row.updated_at)).toLocaleString(),
          created_at: new Date(String(row.updated_at)).toISOString(),
          summary: String(row.title ?? "Copilot thread"),
        }
      }),
    ]
      .filter((row) => {
        if (!query) return true
        return [row.student_name, row.topic, row.module_source, row.summary]
          .join(" ")
          .toLowerCase()
          .includes(query)
      })
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))

    const total = conversations.length
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const currentPage = Math.min(page, totalPages)
    const start = (currentPage - 1) * limit

    return NextResponse.json({
      conversations: conversations.slice(start, start + limit),
      page: currentPage,
      limit,
      total,
      totalPages,
      anonymous: {
        themes: anonymous.themes,
        modules: anonymous.modules,
        hiddenStudents: Math.max(0, anonymous.hiddenStudents),
        note: "Class-wide themes are anonymous. Named summaries appear only when a student opts in under Cora Preferences.",
      },
    })
  } catch (error) {
    console.error("[AI Tutor Conversations] Error:", error)
    return NextResponse.json({ conversations: [], error: "Failed to load conversations" }, { status: 500 })
  }
}
