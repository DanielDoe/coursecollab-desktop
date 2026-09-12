import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCodebenchStudent } from "@/lib/codebench-request-auth"
import { validateStudentLiveSnapshotAccess } from "@/lib/codebench-live-snapshot-validation"
import { ensureCodebenchLiveSnapshotsSchema } from "@/lib/codebench-live-session-schema"

export const dynamic = "force-dynamic"

const MAX_CODE_CHARS = 80_000
const MAX_REPLAY_EVENTS = 800

function trimReplay(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null
  const replay = raw as { startTime?: number; events?: unknown[]; initialDocument?: string }
  if (!Array.isArray(replay.events) || replay.events.length === 0) return null
  return {
    startTime: typeof replay.startTime === "number" ? replay.startTime : Date.now(),
    initialDocument:
      typeof replay.initialDocument === "string" ? replay.initialDocument.slice(0, MAX_CODE_CHARS) : "",
    events: replay.events.slice(-MAX_REPLAY_EVENTS),
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const auth = await requireCodebenchStudent(request, body.studentId != null ? String(body.studentId) : null)
    if (!auth.ok) return auth.response

    const assignmentId = Number(body.assignmentId)
    if (!Number.isFinite(assignmentId) || assignmentId <= 0) {
      return NextResponse.json({ error: "assignmentId is required." }, { status: 400 })
    }

    const access = await validateStudentLiveSnapshotAccess(auth.studentDbId, assignmentId)
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const code = typeof body.code === "string" ? body.code.slice(0, MAX_CODE_CHARS) : ""
    const language = typeof body.language === "string" ? body.language.slice(0, 32) : null
    const fileName = typeof body.fileName === "string" ? body.fileName.slice(0, 80) : null
    const typingReplay = trimReplay(body.typingReplay)
    const replayJson = typingReplay ? JSON.stringify(typingReplay) : null

    await ensureCodebenchLiveSnapshotsSchema()

    if (replayJson) {
      await sql`
        INSERT INTO codebench_live_snapshots (
          student_id, assignment_id, course_id, language, file_name, code, typing_replay, updated_at
        ) VALUES (
          ${auth.studentDbId},
          ${assignmentId},
          ${access.courseId},
          ${language},
          ${fileName},
          ${code},
          ${replayJson}::jsonb,
          NOW()
        )
        ON CONFLICT (student_id, assignment_id)
        DO UPDATE SET
          course_id = EXCLUDED.course_id,
          language = EXCLUDED.language,
          file_name = EXCLUDED.file_name,
          code = EXCLUDED.code,
          typing_replay = EXCLUDED.typing_replay,
          updated_at = NOW()
      `
    } else {
      await sql`
        INSERT INTO codebench_live_snapshots (
          student_id, assignment_id, course_id, language, file_name, code, updated_at
        ) VALUES (
          ${auth.studentDbId},
          ${assignmentId},
          ${access.courseId},
          ${language},
          ${fileName},
          ${code},
          NOW()
        )
        ON CONFLICT (student_id, assignment_id)
        DO UPDATE SET
          course_id = EXCLUDED.course_id,
          language = EXCLUDED.language,
          file_name = EXCLUDED.file_name,
          code = EXCLUDED.code,
          updated_at = NOW()
      `
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[codebench live-snapshot]", error)
    return NextResponse.json({ error: "Could not save live snapshot." }, { status: 500 })
  }
}
