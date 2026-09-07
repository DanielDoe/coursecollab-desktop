import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCodebenchStudent } from "@/lib/codebench-request-auth"
import { ensureCodebenchStudioEventsSchema } from "@/lib/codebench-studio-schema"

export const dynamic = "force-dynamic"

const EVENT_TYPES = new Set([
  "run",
  "compile_success",
  "compile_error",
  "runtime_exit",
  "cora_tool",
  "save",
  "suggest_fix",
])

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const auth = await requireCodebenchStudent(request, body.studentId != null ? String(body.studentId) : null)
    if (!auth.ok) return auth.response

    const type = typeof body.type === "string" ? body.type : ""
    if (!EVENT_TYPES.has(type)) {
      return NextResponse.json({ error: "Unknown event type." }, { status: 400 })
    }

    await ensureCodebenchStudioEventsSchema()
    const courseRows = await sql`
      SELECT course_id FROM students WHERE id = ${auth.studentDbId} LIMIT 1
    `
    const courseId = Number(courseRows[0]?.course_id) || null
    await sql`
      INSERT INTO codebench_studio_events (
        student_id, course_id, event_type, language, error_family, error_message, tool, file_name, success
      ) VALUES (
        ${auth.studentDbId},
        ${courseId},
        ${type},
        ${typeof body.language === "string" ? body.language.slice(0, 32) : null},
        ${typeof body.errorFamily === "string" ? body.errorFamily.slice(0, 48) : null},
        ${typeof body.errorMessage === "string" ? body.errorMessage.slice(0, 400) : null},
        ${typeof body.tool === "string" ? body.tool.slice(0, 48) : null},
        ${typeof body.fileName === "string" ? body.fileName.slice(0, 80) : null},
        ${typeof body.success === "boolean" ? body.success : null}
      )
    `
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[codebench studio-events]", error)
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
