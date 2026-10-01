import { type NextRequest, NextResponse } from "next/server"
import { sql as platformSql } from "@/lib/db"
import { sqlForCodebenchStudent } from "@/lib/codebench/trusted-sql"
import { excerptCode, recordLiveActivity } from "@/lib/codebench-live-activity-log"
import { requireCodebenchStudent } from "@/lib/codebench-request-auth"
import { validateStudentLiveSnapshotAccess } from "@/lib/codebench-live-snapshot-validation"
import type { StudentLiveClassroomSession } from "@/lib/codebench-live-classroom-types"
import { ensureCodebenchLiveSnapshotsSchema } from "@/lib/codebench-live-session-schema"
import {
  chooseTypingReplayForCode,
  prepareLiveTypingReplay,
  selectFaithfulTypingReplay,
  shiftTypingReplayClock,
  typingReplaySince,
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
    const tenantDb = await sqlForCodebenchStudent(auth.studentDbId)
    if (!tenantDb) {
      return NextResponse.json({ error: "Student session is invalid" }, { status: 401 })
    }
    const rows = await platformSql`
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
    // Stored replays are on the server clock. Only this session's keystrokes are
    // restored, and serverNow lets the client move the replay onto its own clock.
    const sessionReplay = typingReplaySince(
      selectFaithfulTypingReplay(row?.typing_replay, code),
      access.liveSessionStartedAtMs,
    )
    return NextResponse.json({
      code,
      instructorCode: typeof row?.instructor_code === "string" ? row.instructor_code : "",
      instructorRevision: Number(row?.instructor_revision) || 0,
      language: row?.language ?? null,
      fileName: row?.file_name ?? null,
      updatedAt: row?.updated_at ?? null,
      typingReplay: sessionReplay,
      serverNow: Date.now(),
    })
  } catch (error) {
    console.error("[codebench live-snapshot get]", error)
    return NextResponse.json({ error: "Could not load live snapshot." }, { status: 500 })
  }
}

function liveSnapshotDetail(input: {
  intent: string
  fileName: string | null
  language: string | null
  cursorJson: string | null
  codeChars: number
  keptPreviousCode: boolean
  editorStillOpen: boolean
}) {
  let cursorLine: number | null = null
  let cursorColumn: number | null = null
  if (input.cursorJson) {
    try {
      const cursor = JSON.parse(input.cursorJson) as { line?: number; column?: number }
      cursorLine = Number.isFinite(cursor.line) ? Number(cursor.line) : null
      cursorColumn = Number.isFinite(cursor.column) ? Number(cursor.column) : null
    } catch {
      cursorLine = null
    }
  }
  return {
    intent: input.intent,
    httpStatus: 200,
    fileName: input.fileName,
    language: input.language,
    cursorLine,
    cursorColumn,
    studentCodeChars: input.codeChars,
    keptPreviousCode: input.keptPreviousCode,
    editorStillOpen: input.editorStillOpen,
  }
}

/**
 * The access gate is 6–8 queries (assignment, open session, enrollment, section,
 * course, tenant). Students post every few hundred ms while typing, so reuse a
 * passing result briefly. Only successes are cached; an ended session shows up as
 * 410 within ACCESS_CACHE_MS.
 */
const ACCESS_CACHE_MS = 5_000
const ACCESS_CACHE_MAX = 5_000
type CachedWriteAccess = { courseId: number | null; liveSessionStartedAtMs: number | null }
const accessCache = new Map<string, CachedWriteAccess & { at: number }>()

async function cachedSnapshotWriteAccess(
  request: NextRequest,
  studentDbId: number,
  assignmentId: number,
): Promise<
  | ({ ok: true } & CachedWriteAccess)
  | { ok: false; status: number; error: string; movedTo?: StudentLiveClassroomSession | null }
> {
  const key = `${studentDbId}:${assignmentId}`
  const hit = accessCache.get(key)
  if (hit && Date.now() - hit.at < ACCESS_CACHE_MS) {
    return { ok: true, courseId: hit.courseId, liveSessionStartedAtMs: hit.liveSessionStartedAtMs }
  }
  accessCache.delete(key)

  const access = await validateStudentLiveSnapshotAccess(request, studentDbId, assignmentId)
  if (!access.ok) return access
  const tenantDb = await sqlForCodebenchStudent(studentDbId)
  if (!tenantDb) return { ok: false, status: 401, error: "Student session is invalid" }

  const granted = { courseId: access.courseId, liveSessionStartedAtMs: access.liveSessionStartedAtMs }
  if (accessCache.size >= ACCESS_CACHE_MAX) accessCache.clear()
  accessCache.set(key, { at: Date.now(), ...granted })
  return { ok: true, ...granted }
}

/** serverNow - clientNow, or 0 for clients that don't send clientNow. */
function clientClockOffsetMs(clientNow: unknown): number {
  const sent = Number(clientNow)
  if (!Number.isFinite(sent) || sent <= 0) return 0
  return Date.now() - sent
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

    // A leave only stamps the student's own existing row, so it skips the access gate.
    // Leaves sent after the instructor ended the session (410) used to be dropped and
    // left the student Joined for the next session on this assignment.
    if (body.intent === "leave") {
      await ensureCodebenchLiveSnapshotsSchema()
      const left = await platformSql`
        UPDATE codebench_live_snapshots
        SET student_left_at = NOW()
        WHERE student_id = ${auth.studentDbId}
          AND assignment_id = ${assignmentId}
        RETURNING course_id
      `
      if (left.length > 0) {
        const courseId = Number((left[0] as { course_id?: number | null }).course_id)
        void recordLiveActivity({
          courseId: Number.isFinite(courseId) ? courseId : null,
          assignmentId,
          studentId: auth.studentDbId,
          actor: "student",
          eventType: "editor_left",
          ok: true,
          httpStatus: 200,
          message: "Student left the live editor",
          rosterStatus: "not_started",
          detail: { intent: "leave", httpStatus: 200, instructorRosterStatus: "not_started" },
          dedupeSeconds: 5,
        })
      }
      return NextResponse.json({ ok: true, left: true })
    }

    const access = await cachedSnapshotWriteAccess(request, auth.studentDbId, assignmentId)
    if (!access.ok) {
      const courseRows = await platformSql`
        SELECT course_id FROM students WHERE id = ${auth.studentDbId} LIMIT 1
      `.catch(() => [])
      const courseId = Number((courseRows[0] as { course_id?: number } | undefined)?.course_id)
      await recordLiveActivity({
        courseId: Number.isFinite(courseId) ? courseId : null,
        assignmentId,
        studentId: auth.studentDbId,
        actor: "student",
        eventType: "snapshot_denied",
        ok: false,
        httpStatus: access.status,
        message: access.error,
        detail: {
          intent: "snapshot",
          httpStatus: access.status,
          accepted: false,
          movedToAssignmentId: access.movedTo?.assignmentId ?? null,
        },
        dedupeSeconds: 15,
      })
      return NextResponse.json(
        access.movedTo ? { error: access.error, movedTo: access.movedTo } : { error: access.error },
        { status: access.status },
      )
    }

    let code = typeof body.code === "string" ? body.code.slice(0, MAX_CODE_CHARS) : ""
    const language = typeof body.language === "string" ? body.language.slice(0, 32) : null
    const fileName = typeof body.fileName === "string" ? body.fileName.slice(0, 80) : null
    // Store replays on the server clock and cut them at the session start, so a
    // snapshot row reused across sessions never replays an earlier session.
    const incomingReplay = typingReplaySince(
      shiftTypingReplayClock(
        capReplayDocument(prepareLiveTypingReplay(body.typingReplay)),
        clientClockOffsetMs(body.clientNow),
      ),
      access.liveSessionStartedAtMs,
    )
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
    const intent =
      body.intent === "join"
        ? "join"
        : body.intent === "presence"
          ? "presence"
          : body.intent === "code"
            ? "code"
            : "auto"
    // Only an editor that is actually in the room may refresh join. A save that
    // omits keepJoined, or sets it false, must not undo a leave.
    const editorStillOpen =
      body.keepJoined === true && (intent === "presence" || intent === "code")
    // Desktop 0.1.30 and older never send a join or keepJoined, and only post while the
    // student is sharing. Count those posts as presence, but keep their reset protection.
    const legacyLiveEditor = body.keepJoined === undefined && intent !== "join"
    const inRoom = editorStillOpen || legacyLiveEditor

    await ensureCodebenchLiveSnapshotsSchema()

    if (intent === "join") {
      // Entering the room is its own signal. Do not touch the code clock, or
      // a join looks like Coding now before the student has typed or compiled.
      await platformSql`
        INSERT INTO codebench_live_snapshots (
          student_id, assignment_id, course_id, code, student_joined_at, student_left_at, updated_at
        ) VALUES (
          ${auth.studentDbId},
          ${assignmentId},
          ${access.courseId},
          '',
          NOW(),
          NULL,
          NOW()
        )
        ON CONFLICT (student_id, assignment_id)
        DO UPDATE SET
          student_joined_at = NOW(),
          student_left_at = NULL
      `
      void recordLiveActivity({
        courseId: access.courseId,
        assignmentId,
        studentId: auth.studentDbId,
        actor: "student",
        eventType: "editor_joined",
        ok: true,
        httpStatus: 200,
        message: "Student joined the live editor",
        rosterStatus: "joined",
        detail: { intent: "join", httpStatus: 200, instructorRosterStatus: "joined" },
        dedupeSeconds: 5,
      })
      return NextResponse.json({ ok: true, joined: true })
    }

    const storedRows = await platformSql`
      SELECT code
      FROM codebench_live_snapshots
      WHERE student_id = ${auth.studentDbId}
        AND assignment_id = ${assignmentId}
      LIMIT 1
    `.catch(() => [])
    const storedCode = (storedRows[0] as { code?: string } | undefined)?.code
    const persistedCode = editorStillOpen
      ? code
      : codebenchLiveCodeToPersist(
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
      const existingRows = await platformSql`
        SELECT typing_replay
        FROM codebench_live_snapshots
        WHERE student_id = ${auth.studentDbId}
          AND assignment_id = ${assignmentId}
        LIMIT 1
      `
      const existing = typingReplaySince(
        normalizeTypingReplay(
          (existingRows[0] as { typing_replay?: unknown } | undefined)?.typing_replay,
        ),
        access.liveSessionStartedAtMs,
      )
      const chosen = chooseTypingReplayForCode({
        existing,
        incoming: incomingReplay,
        code,
      })
      replayJson = chosen ? JSON.stringify(chosen) : null
    }
    if (preservedTypedCode) updateReplay = false

    if (intent === "presence" && !updateReplay) {
      try {
        const touched = await platformSql`
          UPDATE codebench_live_snapshots
          SET
            student_cursor = COALESCE(${studentCursorJson}::jsonb, student_cursor),
            language = COALESCE(${language}, language),
            file_name = COALESCE(${fileName}, file_name),
            updated_at = NOW(),
            student_joined_at = CASE WHEN ${inRoom} THEN NOW() ELSE student_joined_at END,
            student_left_at = CASE WHEN ${inRoom} THEN NULL ELSE student_left_at END
          WHERE student_id = ${auth.studentDbId}
            AND assignment_id = ${assignmentId}
          RETURNING student_id
        `
        if (touched.length > 0) {
          void recordLiveActivity({
            courseId: access.courseId,
            assignmentId,
            studentId: auth.studentDbId,
            actor: "student",
            eventType: "snapshot_ok",
            ok: true,
            httpStatus: 200,
            message: "Presence heartbeat",
            detail: liveSnapshotDetail({
              intent: "presence",
              fileName,
              language,
              cursorJson: studentCursorJson,
              codeChars: code.length,
              keptPreviousCode: false,
              editorStillOpen,
            }),
            dedupeSeconds: 20,
          })
          return NextResponse.json({ ok: true })
        }
      } catch (error) {
        console.error("[codebench live-snapshot] presence heartbeat", error)
      }
    }

    if (intent !== "code" && !updateReplay) {
      try {
        const sameCodeRows = await platformSql`
          SELECT code
          FROM codebench_live_snapshots
          WHERE student_id = ${auth.studentDbId}
            AND assignment_id = ${assignmentId}
          LIMIT 1
        `
        const storedCode = (sameCodeRows[0] as { code?: string } | undefined)?.code
        if (typeof storedCode === "string" && storedCode === code) {
          await platformSql`
            UPDATE codebench_live_snapshots
            SET
              student_cursor = COALESCE(${studentCursorJson}::jsonb, student_cursor),
              language = COALESCE(${language}, language),
              file_name = COALESCE(${fileName}, file_name),
              updated_at = NOW(),
              student_joined_at = CASE WHEN ${inRoom} THEN NOW() ELSE student_joined_at END,
              student_left_at = CASE WHEN ${inRoom} THEN NULL ELSE student_left_at END
            WHERE student_id = ${auth.studentDbId}
              AND assignment_id = ${assignmentId}
          `
          void recordLiveActivity({
            courseId: access.courseId,
            assignmentId,
            studentId: auth.studentDbId,
            actor: "student",
            eventType: "snapshot_ok",
            ok: true,
            httpStatus: 200,
            message: "Presence heartbeat",
            detail: liveSnapshotDetail({
              intent: "presence",
              fileName,
              language,
              cursorJson: studentCursorJson,
              codeChars: code.length,
              keptPreviousCode: false,
              editorStillOpen,
            }),
            dedupeSeconds: 20,
          })
          return NextResponse.json({ ok: true })
        }
      } catch (error) {
        console.error("[codebench live-snapshot] presence heartbeat", error)
      }
    }

    const writeSnapshot = async (db: typeof platformSql) => {
      if (updateReplay) {
        await db`
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
            updated_at = NOW(),
            student_joined_at = CASE WHEN ${inRoom} THEN NOW() ELSE codebench_live_snapshots.student_joined_at END,
            student_left_at = CASE WHEN ${inRoom} THEN NULL ELSE codebench_live_snapshots.student_left_at END,
            student_active_at = CASE
              WHEN ${intent === "code"}
                AND EXCLUDED.code IS DISTINCT FROM codebench_live_snapshots.code
                AND length(btrim(EXCLUDED.code)) > 0
              THEN NOW()
              ELSE codebench_live_snapshots.student_active_at
            END
        `
        return
      }
      await db`
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
            updated_at = NOW(),
            student_joined_at = CASE WHEN ${inRoom} THEN NOW() ELSE codebench_live_snapshots.student_joined_at END,
            student_left_at = CASE WHEN ${inRoom} THEN NULL ELSE codebench_live_snapshots.student_left_at END,
            student_active_at = CASE
              WHEN ${intent === "code"}
                AND EXCLUDED.code IS DISTINCT FROM codebench_live_snapshots.code
                AND length(btrim(EXCLUDED.code)) > 0
              THEN NOW()
              ELSE codebench_live_snapshots.student_active_at
            END
      `
    }

    try {
      await writeSnapshot(platformSql)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Snapshot save failed"
      await recordLiveActivity({
        courseId: access.courseId,
        assignmentId,
        studentId: auth.studentDbId,
        actor: "student",
        eventType: "snapshot_fail",
        ok: false,
        httpStatus: 500,
        message,
        codeExcerpt: excerptCode(code),
        codeChars: code.length,
        detail: liveSnapshotDetail({
          intent,
          fileName,
          language,
          cursorJson: studentCursorJson,
          codeChars: code.length,
          keptPreviousCode: preservedTypedCode,
          editorStillOpen,
        }),
        dedupeSeconds: 15,
      })
      throw error
    }

    void recordLiveActivity({
      courseId: access.courseId,
      assignmentId,
      studentId: auth.studentDbId,
      actor: "student",
      eventType: "snapshot_ok",
      ok: true,
      httpStatus: 200,
      message: preservedTypedCode ? "Kept saved code; ignored editor reset" : "Snapshot saved",
      codeChars: code.length,
      detail: liveSnapshotDetail({
        intent,
        fileName,
        language,
        cursorJson: studentCursorJson,
        codeChars: code.length,
        keptPreviousCode: preservedTypedCode,
        editorStillOpen,
      }),
      dedupeSeconds: preservedTypedCode ? 20 : 15,
      dedupeIgnoresCodeChars: true,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[codebench live-snapshot]", error)
    return NextResponse.json({ error: "Could not save live snapshot." }, { status: 500 })
  }
}
