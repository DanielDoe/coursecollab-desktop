import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCodebenchStudent } from "@/lib/codebench-request-auth"
import { validateStudentLiveSnapshotAccess } from "@/lib/codebench-live-snapshot-validation"
import { ensureCodebenchLiveSnapshotsSchema } from "@/lib/codebench-live-session-schema"
import {
  chooseTypingReplayForCode,
  prepareLiveTypingReplay,
  selectFaithfulTypingReplay,
} from "@/lib/codebench-live-replay"
import { codebenchLiveCodeToPersist } from "@/lib/codebench-languages"
import { normalizeTypingReplay } from "@/lib/typing-replay"

export const dynamic = "force-dynamic"

const MAX_CODE_CHARS = 80_000

export async function GET(request: NextRequest) {
  const studentId = request.nextUrl.searchParams.get("studentId")
  const auth = await requireCodebenchStudent(request, studentId)
  if (!auth.ok) return auth.response

  const assignmentId = Number(request.nextUrl.searchParams.get("assignmentId"))
  if (!Number.isFinite(assignmentId) || assignmentId <= 0) {
    return NextResponse.json({ error: "assignmentId is required." }, { status: 400 })
  }

  const access = await validateStudentLiveSnapshotAccess(request, auth.studentDbId, assignmentId)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  try {
    await ensureCodebenchLiveSnapshotsSchema()
    const rows = await sql`
      SELECT code, instructor_code, instructor_revision, language, file_name, updated_at, typing_replay
      FROM codebench_live_snapshots
      WHERE student_id = ${auth.studentDbId}
        AND assignment_id = ${assignmentId}
      LIMIT 1
    `
    const row = rows[0] as
      | {
          code?: string
          instructor_code?: string | null
          instructor_revision?: number | null
          language?: string | null
          file_name?: string | null
          updated_at?: string
          typing_replay?: unknown
        }
      | undefined
    const code = typeof row?.code === "string" ? row.code : ""
    return NextResponse.json({
      code,
      instructorCode: typeof row?.instructor_code === "string" ? row.instructor_code : "",
      instructorRevision: Number(row?.instructor_revision) || 0,
      language: row?.language ?? null,
      fileName: row?.file_name ?? null,
      updatedAt: row?.updated_at ?? null,
      typingReplay: selectFaithfulTypingReplay(row?.typing_replay, code),
    })
  } catch (error) {
    console.error("[codebench live-snapshot get]", error)
    return NextResponse.json({ error: "Could not load live snapshot." }, { status: 500 })
  }
}

function capReplayDocument(replay: ReturnType<typeof prepareLiveTypingReplay>) {
  if (!replay) return null
  return {
    ...replay,
    initialDocument: (replay.initialDocument ?? "").slice(0, MAX_CODE_CHARS),
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

    const access = await validateStudentLiveSnapshotAccess(request, auth.studentDbId, assignmentId)
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    let code = typeof body.code === "string" ? body.code.slice(0, MAX_CODE_CHARS) : ""
    const language = typeof body.language === "string" ? body.language.slice(0, 32) : null
    const fileName = typeof body.fileName === "string" ? body.fileName.slice(0, 80) : null
    const incomingReplay = capReplayDocument(prepareLiveTypingReplay(body.typingReplay))
    const studentCursorRaw = body.studentCursor
    const studentCursorJson =
      studentCursorRaw &&
      typeof studentCursorRaw === "object" &&
      Number.isFinite(Number((studentCursorRaw as { line?: unknown }).line))
        ? JSON.stringify({
            line: Math.max(1, Math.trunc(Number((studentCursorRaw as { line: number }).line))),
            column: Math.max(
              1,
              Math.trunc(Number((studentCursorRaw as { column?: unknown }).column ?? 1)),
            ),
          })
        : null

    await ensureCodebenchLiveSnapshotsSchema()

    const storedRows = await sql`
      SELECT code
      FROM codebench_live_snapshots
      WHERE student_id = ${auth.studentDbId}
        AND assignment_id = ${assignmentId}
      LIMIT 1
    `.catch(() => [])
    const storedCode = (storedRows[0] as { code?: string } | undefined)?.code
    const persistedCode = codebenchLiveCodeToPersist(
      typeof storedCode === "string" ? storedCode : "",
      code,
      language,
    )
    const preservedTypedCode = persistedCode !== code
    code = persistedCode

    let replayJson: string | null = null
    let updateReplay = false
    if (incomingReplay) {
      updateReplay = true
      const existingRows = await sql`
        SELECT typing_replay
        FROM codebench_live_snapshots
        WHERE student_id = ${auth.studentDbId}
          AND assignment_id = ${assignmentId}
        LIMIT 1
      `
      const existing = normalizeTypingReplay(
        (existingRows[0] as { typing_replay?: unknown } | undefined)?.typing_replay,
      )
      const chosen = chooseTypingReplayForCode({
        existing,
        incoming: incomingReplay,
        code,
      })
      replayJson = chosen ? JSON.stringify(chosen) : null
    }
    if (preservedTypedCode) updateReplay = false

    if (updateReplay) {
      await sql`
        INSERT INTO codebench_live_snapshots (
          student_id, assignment_id, course_id, language, file_name, code, typing_replay, student_cursor, updated_at
        ) VALUES (
          ${auth.studentDbId},
          ${assignmentId},
          ${access.courseId},
          ${language},
          ${fileName},
          ${code},
          ${replayJson}::jsonb,
          ${studentCursorJson}::jsonb,
          NOW()
        )
        ON CONFLICT (student_id, assignment_id)
        DO UPDATE SET
          course_id = EXCLUDED.course_id,
          language = EXCLUDED.language,
          file_name = EXCLUDED.file_name,
          code = CASE
            WHEN length(btrim(EXCLUDED.code)) = 0 AND length(btrim(codebench_live_snapshots.code)) > 0
            THEN codebench_live_snapshots.code
            ELSE EXCLUDED.code
          END,
          typing_replay = EXCLUDED.typing_replay,
          student_cursor = COALESCE(EXCLUDED.student_cursor, codebench_live_snapshots.student_cursor),
          updated_at = NOW()
      `
    } else {
      await sql`
        INSERT INTO codebench_live_snapshots (
          student_id, assignment_id, course_id, language, file_name, code, student_cursor, updated_at
        ) VALUES (
          ${auth.studentDbId},
          ${assignmentId},
          ${access.courseId},
          ${language},
          ${fileName},
          ${code},
          ${studentCursorJson}::jsonb,
          NOW()
        )
        ON CONFLICT (student_id, assignment_id)
        DO UPDATE SET
          course_id = EXCLUDED.course_id,
          language = EXCLUDED.language,
          file_name = EXCLUDED.file_name,
          code = CASE
            WHEN length(btrim(EXCLUDED.code)) = 0 AND length(btrim(codebench_live_snapshots.code)) > 0
            THEN codebench_live_snapshots.code
            ELSE EXCLUDED.code
          END,
          student_cursor = COALESCE(EXCLUDED.student_cursor, codebench_live_snapshots.student_cursor),
          updated_at = NOW()
      `
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[codebench live-snapshot]", error)
    return NextResponse.json({ error: "Could not save live snapshot." }, { status: 500 })
  }
}
