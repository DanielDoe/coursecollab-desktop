import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAttemptDisplayGradesBatch } from "@/lib/attempt-grade-display"
import { dedupeCanvasExportRoster } from "@/lib/canvas-export-dedupe"
import { resolvedCanvasGradebookSection } from "@/lib/canvas-gradebook-section"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { getEmbeddedCanvasRosterAllowlistCsv } from "@/lib/canvas-embedded-roster-allowlists"
import { filterCanvasExportInputByExcludedStudents, parseExcludeStudentIds } from "@/lib/canvas-export-exclusions"
import {
  filterCanvasExportInputByAllowlist,
  parseCanvasRosterAllowlistCsv,
} from "@/lib/canvas-roster-allowlist"
import {
  buildCanvasExportMatrix,
  canvasMatrixToCsv,
  CANVAS_EXPORT_GRADE_PERCENT_MAX,
  CANVAS_GRADEBOOK_FIXED_COLUMN_COUNT,
  type CanvasExportMissingScoreDisplay,
  type GenerateCanvasExportInput,
} from "@/lib/canvas-gradebook-export"
import {
  CANVAS_EXTRA_EXPORT_COLUMNS,
  canvasExtraExportIdToKey,
  isCanvasExtraExportId,
  type CanvasExtraExportKey,
} from "@/lib/canvas-extra-export-columns"
import { getCanvasExtraExportScorePercent } from "@/lib/canvas-extra-export-scores"
import {
  fetchStudentGradesSnapshotForCanvasExport,
  type AttendanceCanvasExportRosterContext,
  type StudentGradesCanvasSnapshot,
} from "@/lib/grades"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { loadQuizAccessActor, sqlQuizVisibleInCourse } from "@/lib/quiz-course-access"
import type { ActorRow } from "@/lib/instructor-actor-scope"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Body = {
  assignmentIds?: number[]
  sectionFilter?: string
  /** Optional; reserved for future use. Section scope uses `sectionFilter` variants + `sessions` join only. */
  sessionId?: number | string
  preview?: boolean
  /** `zero` (default) = 0% when no attempt; `blank` = empty cell for Canvas “no grade”. */
  missingScoreDisplay?: string
  /**
   * Optional Canvas roster CSV (Student, ID, SIS User ID, SIS Login ID, …). When set, export rows are limited to
   * students matching those identifiers. Non-empty value overrides any built-in allowlist for that section.
   */
  rosterAllowlistCsv?: string
  /** Internal PKs (`students.id`) to omit from CSV rows and submission cells. */
  excludeStudentIds?: number[]
}

type LoadResult =
  | { ok: true; input: GenerateCanvasExportInput }
  | { ok: false; status: number; error: string }

function parseMissingScoreDisplay(raw: unknown): CanvasExportMissingScoreDisplay {
  const s = String(raw ?? "").trim().toLowerCase()
  return s === "blank" ? "blank" : "zero"
}

/** Avoid Neon “Too many connections” when many students × extra columns each hit the DB in parallel. */
const CANVAS_EXTRA_SCORE_CONCURRENCY = 5
async function mapAsyncInChunks<T, R>(
  items: T[],
  chunkSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)
    results.push(...(await Promise.all(chunk.map(fn))))
  }
  return results
}

function sessionCodeForGradeExport(row: {
  session_code: string | null
  student_section: string | null
  section: string
}): string | undefined {
  const a = row.session_code != null && String(row.session_code).trim() !== "" ? String(row.session_code).trim() : ""
  if (a) return a
  const b =
    row.student_section != null && String(row.student_section).trim() !== ""
      ? String(row.student_section).trim()
      : ""
  if (b) return b
  const c = String(row.section ?? "").trim()
  return c || undefined
}

async function loadCanvasExportInput(
  instId: number,
  courseId: number,
  actor: ActorRow,
  courseOwnerId: number,
  rawIds: number[],
  sectionFilter: string,
  missingScoreDisplay: CanvasExportMissingScoreDisplay,
): Promise<LoadResult> {
  const sectionAll = sectionFilter.toLowerCase() === "all"
  /** Code variants (e.g. ELEG1301P01 + E1301P01) + `sessions.code` via join — survives renames; matches instructor section scoping. */
  const sectionVariants = sectionAll ? [] : normalizedSectionVariantsForSql(sectionFilter)

  const invalidNegative = rawIds.filter((id) => id <= 0 && !isCanvasExtraExportId(id))
  if (invalidNegative.length > 0) {
    return { ok: false, status: 400, error: "One or more assignment ids are invalid" }
  }

  const rawExtraIds = rawIds.filter(isCanvasExtraExportId)
  const positiveIds = rawIds.filter((id) => id > 0)

  let quizIds: number[] = []
  let extraIds: number[] = []

  if (rawIds.length === 0) {
    /** Only quizzes with at least one completed attempt — excludes legacy empty columns in “All assignments”. */
    const all = await sql`
      SELECT DISTINCT q.id
      FROM quizzes q
      INNER JOIN quiz_attempts qa ON qa.quiz_id = q.id
      WHERE q.deleted_at IS NULL
        AND ${sqlQuizVisibleInCourse("q", actor, instId, courseOwnerId, courseId)}
        AND qa.deleted_at IS NULL
        AND qa.completed_at IS NOT NULL
      ORDER BY q.id ASC
    `
    quizIds = (all as { id: number }[]).map((r) => r.id)
    extraIds = CANVAS_EXTRA_EXPORT_COLUMNS.map((c) => c.id)
  } else {
    extraIds = rawExtraIds
    if (positiveIds.length > 0) {
      const owned = await sql`
        SELECT q.id FROM quizzes q
        WHERE q.deleted_at IS NULL
          AND q.id = ANY(${positiveIds}::int[])
          AND ${sqlQuizVisibleInCourse("q", actor, instId, courseOwnerId, courseId)}
      `
      quizIds = (owned as { id: number }[]).map((r) => r.id)
      if (quizIds.length !== positiveIds.length) {
        return {
          ok: false,
          status: 403,
          error: "One or more assignments are invalid or not in the selected course",
        }
      }
    }
  }

  if (quizIds.length === 0 && extraIds.length === 0) {
    return {
      ok: true,
      input: {
        students: [],
        assignments: [],
        submissions: [],
        sectionFilter,
        missingScoreDisplay,
      },
    }
  }

  /** “All” roster uses attempts on selected quizzes; extras-only uses any owned quiz to define cohort (same as prior behavior when quizzes selected). */
  let rosterScopeQuizIds = quizIds
  if (sectionAll && quizIds.length === 0 && extraIds.length > 0) {
    const scope = await sql`
      SELECT q.id FROM quizzes q
      WHERE q.deleted_at IS NULL
        AND ${sqlQuizVisibleInCourse("q", actor, instId, courseOwnerId, courseId)}
    `
    rosterScopeQuizIds = (scope as { id: number }[]).map((r) => r.id)
  }

  const extraMeta = extraIds
    .map((id) => {
      const key = canvasExtraExportIdToKey(id)
      const col = CANVAS_EXTRA_EXPORT_COLUMNS.find((c) => c.id === id)
      return key && col ? { id, key, title: col.title } : null
    })
    .filter((x): x is { id: number; key: CanvasExtraExportKey; title: string } => x != null)

  const quizzes = quizIds.length === 0 ? [] : await sql`
    SELECT q.id, q.title, q.assessment_type,
      COALESCE(
        (SELECT SUM(COALESCE(qq.max_points, qq.points, 1))::numeric
         FROM quiz_questions qq WHERE qq.quiz_id = q.id),
        0
      ) as question_points_sum
    FROM quizzes q
    WHERE q.id = ANY(${quizIds}::int[])
    ORDER BY q.title ASC
  `
  const quizRows = quizzes as {
    id: number
    title: string
    assessment_type: string | null
    question_points_sum: string | number
  }[]
  /** Canvas columns are 0–100 course %; scores come from `getAttemptDisplayGrade` (not raw `quiz_attempts.score`). */
  const assignments = [
    ...quizRows.map((q) => ({
      id: q.id,
      title: q.title,
      max_score: CANVAS_EXPORT_GRADE_PERCENT_MAX,
    })),
    ...extraMeta.map((e) => ({
      id: e.id,
      title: e.title,
      max_score: CANVAS_EXPORT_GRADE_PERCENT_MAX,
    })),
  ]

  /* Roster: everyone in scope — not only students with attempts. Section filter = full section; “All” = anyone who attempted OR same session/section text as someone who did. */
  const studentRows = sectionAll
    ? await sql`
        SELECT DISTINCT ON (s.id)
          s.id,
          s.student_id as school_student_id,
          s.full_name as name,
          COALESCE(NULLIF(TRIM(sess.code::text), ''), NULLIF(TRIM(s.section::text), ''), '') as section,
          NULLIF(TRIM(sess.code::text), '') as session_code,
          NULLIF(TRIM(s.section::text), '') as student_section,
          COALESCE(NULLIF(TRIM(s.canvas_section::text), ''), '') as canvas_section,
          NULLIF(TRIM(s.sis_user_id::text), '') as sis_user_id_raw,
          COALESCE(
            NULLIF(TRIM(s.sis_user_id::text), ''),
            NULLIF(TRIM(s.student_id::text), '')
          ) as sis_user_id,
          COALESCE(
            NULLIF(TRIM(s.sis_login_id::text), ''),
            NULLIF(SPLIT_PART(LOWER(COALESCE(s.email::text, '')), '@', 1), ''),
            NULLIF(TRIM(s.student_id::text), '')
          ) as sis_login_id
        FROM students s
        LEFT JOIN sessions sess ON sess.id = s.session_id
        WHERE EXISTS (
            SELECT 1 FROM quiz_attempts qa
            WHERE qa.student_id = s.id
              AND qa.quiz_id = ANY(${rosterScopeQuizIds}::int[])
              AND qa.deleted_at IS NULL
              AND (
                qa.completed_at IS NOT NULL
                OR COALESCE(qa.is_final_grade, false) = true
              )
          )
          OR EXISTS (
            SELECT 1
            FROM students peer
            INNER JOIN quiz_attempts qa ON qa.student_id = peer.id
            WHERE qa.quiz_id = ANY(${rosterScopeQuizIds}::int[])
              AND qa.deleted_at IS NULL
              AND (
                qa.completed_at IS NOT NULL
                OR COALESCE(qa.is_final_grade, false) = true
              )
              AND (
                (peer.session_id IS NOT NULL AND peer.session_id = s.session_id)
                OR (
                  NULLIF(TRIM(peer.section::text), '') IS NOT NULL
                  AND TRIM(peer.section) = TRIM(s.section)
                )
              )
          )
        ORDER BY s.id, s.full_name ASC
      `
    : await sql`
        SELECT DISTINCT ON (s.id)
          s.id,
          s.student_id as school_student_id,
          s.full_name as name,
          COALESCE(NULLIF(TRIM(sess.code::text), ''), NULLIF(TRIM(s.section::text), ''), '') as section,
          NULLIF(TRIM(sess.code::text), '') as session_code,
          NULLIF(TRIM(s.section::text), '') as student_section,
          COALESCE(NULLIF(TRIM(s.canvas_section::text), ''), '') as canvas_section,
          NULLIF(TRIM(s.sis_user_id::text), '') as sis_user_id_raw,
          COALESCE(
            NULLIF(TRIM(s.sis_user_id::text), ''),
            NULLIF(TRIM(s.student_id::text), '')
          ) as sis_user_id,
          COALESCE(
            NULLIF(TRIM(s.sis_login_id::text), ''),
            NULLIF(SPLIT_PART(LOWER(COALESCE(s.email::text, '')), '@', 1), ''),
            NULLIF(TRIM(s.student_id::text), '')
          ) as sis_login_id
        FROM students s
        LEFT JOIN sessions sess ON sess.id = s.session_id
        WHERE (
            TRIM(s.section) = ANY(${sectionVariants}::text[])
            OR EXISTS (
              SELECT 1 FROM sessions sess_f
              WHERE sess_f.id = s.session_id
                AND TRIM(sess_f.code) = ANY(${sectionVariants}::text[])
            )
          )
        ORDER BY s.id, s.full_name ASC
      `

  const studentRowsTyped = studentRows as {
    id: number
    school_student_id: string | null
    name: string
    section: string
    session_code: string | null
    student_section: string | null
    canvas_section: string | null
    sis_user_id_raw: string | null
    sis_user_id: string | null
    sis_login_id: string | null
  }[]

  const students = studentRowsTyped.map((r) => {
    const rawSis =
      r.sis_user_id_raw != null && String(r.sis_user_id_raw).trim() !== ""
        ? String(r.sis_user_id_raw).trim()
        : ""
    const school =
      r.school_student_id != null && String(r.school_student_id).trim() !== ""
        ? String(r.school_student_id).trim()
        : ""
    /* Canvas "ID" = college id when present (37728); "SIS User ID" = LMS id (582408). Attempts may store either — resolve SQL + grade map use both. */
    const canvasIdColumn = school || String(r.id)
    const sisColumn = rawSis || school
    return {
      internalId: r.id,
      id: canvasIdColumn,
      schoolStudentId: school || null,
      name: r.name,
      section: r.section,
      sisUserId: sisColumn,
      sisLoginId: String(r.sis_login_id ?? "").trim(),
      canvasSection: resolvedCanvasGradebookSection({
        studentCanvasSection: String(r.canvas_section ?? ""),
        sessionCode: String(r.session_code ?? ""),
        studentSection: String(r.student_section ?? ""),
        rosterShortSection: String(r.section ?? ""),
      }),
    }
  })

  /* `quiz_attempts.student_id` is `students.id` (PK) — same as instructor results (`JOIN students s ON qa.student_id = s.id`).
   * Do not remap via SIS/school here: another student can share the same SIS User ID as your PK digits, which
   * previously stole attempts and produced missing/wrong export rows (0% while the results page was correct). */
  /** Grade attempt (`is_final_grade`) per student × quiz — matches Results → Final. */
  const attemptScores =
    quizIds.length === 0
      ? []
      : sectionAll
        ? await sql`
        WITH base AS (
          SELECT
            att.id AS attempt_id,
            att.quiz_id,
            att.student_id AS student_pk,
            att.is_final_grade,
            att.score AS stored_score,
            att.completed_at
          FROM quiz_attempts att
          WHERE att.quiz_id = ANY(${quizIds}::int[])
            AND att.deleted_at IS NULL
            AND att.completed_at IS NOT NULL
        ),
        with_final AS (
          SELECT DISTINCT ON (student_pk, quiz_id)
            student_pk,
            quiz_id,
            attempt_id
          FROM base
          WHERE is_final_grade IS TRUE
          ORDER BY student_pk, quiz_id, completed_at DESC NULLS LAST, attempt_id DESC
        ),
        without_final AS (
          SELECT DISTINCT ON (b.student_pk, b.quiz_id)
            b.student_pk,
            b.quiz_id,
            b.attempt_id
          FROM base b
          WHERE NOT EXISTS (
            SELECT 1 FROM with_final w
            WHERE w.student_pk = b.student_pk AND w.quiz_id = b.quiz_id
          )
          ORDER BY
            b.student_pk,
            b.quiz_id,
            b.stored_score DESC NULLS LAST,
            b.completed_at DESC NULLS LAST,
            b.attempt_id DESC
        ),
        picked AS (
          SELECT student_pk, quiz_id, attempt_id FROM with_final
          UNION ALL
          SELECT student_pk, quiz_id, attempt_id FROM without_final
        )
        SELECT
          p.student_pk AS student_id,
          p.quiz_id,
          p.attempt_id
        FROM picked p
      `
        : await sql`
        WITH base AS (
          SELECT
            att.id AS attempt_id,
            att.quiz_id,
            att.student_id AS student_pk,
            att.is_final_grade,
            att.score AS stored_score,
            att.completed_at
          FROM quiz_attempts att
          INNER JOIN students st ON st.id = att.student_id
          WHERE att.quiz_id = ANY(${quizIds}::int[])
            AND att.deleted_at IS NULL
            AND att.completed_at IS NOT NULL
            AND (
              TRIM(st.section) = ANY(${sectionVariants}::text[])
              OR EXISTS (
                SELECT 1 FROM sessions sess
                WHERE sess.id = st.session_id
                  AND TRIM(sess.code) = ANY(${sectionVariants}::text[])
              )
            )
        ),
        with_final AS (
          SELECT DISTINCT ON (student_pk, quiz_id)
            student_pk,
            quiz_id,
            attempt_id
          FROM base
          WHERE is_final_grade IS TRUE
          ORDER BY student_pk, quiz_id, completed_at DESC NULLS LAST, attempt_id DESC
        ),
        without_final AS (
          SELECT DISTINCT ON (b.student_pk, b.quiz_id)
            b.student_pk,
            b.quiz_id,
            b.attempt_id
          FROM base b
          WHERE NOT EXISTS (
            SELECT 1 FROM with_final w
            WHERE w.student_pk = b.student_pk AND w.quiz_id = b.quiz_id
          )
          ORDER BY
            b.student_pk,
            b.quiz_id,
            b.stored_score DESC NULLS LAST,
            b.completed_at DESC NULLS LAST,
            b.attempt_id DESC
        ),
        picked AS (
          SELECT student_pk, quiz_id, attempt_id FROM with_final
          UNION ALL
          SELECT student_pk, quiz_id, attempt_id FROM without_final
        )
        SELECT
          p.student_pk AS student_id,
          p.quiz_id,
          p.attempt_id
        FROM picked p
      `

  const scoredRows = attemptScores as {
    student_id: number
    quiz_id: number
    attempt_id: number
  }[]

  const gradeSnapshotCache = new Map<number, StudentGradesCanvasSnapshot | null>()

  async function gradeSnapshotForStudent(studentPk: number): Promise<StudentGradesCanvasSnapshot | null> {
    if (gradeSnapshotCache.has(studentPk)) {
      return gradeSnapshotCache.get(studentPk) ?? null
    }
    const row = studentRowsTyped.find((x) => x.id === studentPk)
    const rosterCtx: AttendanceCanvasExportRosterContext | null = row
      ? {
          sessionCode: row.session_code,
          studentSection: row.student_section,
          rosterSection: row.section,
          canvasSection: row.canvas_section,
          sectionVariantsForSiblingMerge: sectionVariants,
        }
      : null
    const fallback = row ? sessionCodeForGradeExport(row) : null
    const snap = await fetchStudentGradesSnapshotForCanvasExport(
      studentPk,
      rosterCtx,
      fallback,
      sectionVariants,
    )
    gradeSnapshotCache.set(studentPk, snap)
    return snap
  }

  /**
   * Per-quiz columns: display % (0–100) from `getAttemptDisplayGradesBatch` — same as Results → Final.
   * Never use raw `quiz_attempts.score` as the CSV cell (that was points, not percent).
   */
  const displayGrades = await getAttemptDisplayGradesBatch(
    scoredRows.map((r) => Number(r.attempt_id)),
  )
  const enrichedScores = scoredRows.map((r) => {
    const g = displayGrades.get(Number(r.attempt_id))
    const pct =
      g != null && Number.isFinite(g.percentage)
        ? Math.max(0, Math.min(100, Math.round(g.percentage * 100) / 100))
        : 0
    return { ...r, score: pct }
  })

  /**
   * Quiz/homework/final columns: always use **this attempt's** display % (0–100), same as results UI /
   * `getAttemptDisplayGrade`. Do not substitute `student_grades` category rollups — those are one number per
   * category (e.g. mean across all finals) and would duplicate wrong values across every final-exam column.
   * Category snapshots still apply to **extra** columns (project, attendance, …) only.
   */
  const submissionsFromQuiz = enrichedScores.map((r) => ({
    student_id: r.student_id,
    assignment_id: r.quiz_id,
    score: typeof r.score === "number" ? r.score : Number(r.score),
  }))

  const extraTasks =
    extraMeta.length === 0
      ? []
      : studentRowsTyped.flatMap((row) =>
          extraMeta.map((em) => ({
            row,
            em,
          })),
        )

  const extraSubmissions =
    extraTasks.length === 0
      ? []
      : await mapAsyncInChunks(extraTasks, CANVAS_EXTRA_SCORE_CONCURRENCY, async ({ row, em }) => {
          const sess = sessionCodeForGradeExport(row)
          const attendanceRosterCtx: AttendanceCanvasExportRosterContext = {
            sessionCode: row.session_code,
            studentSection: row.student_section,
            rosterSection: row.section,
            canvasSection: row.canvas_section,
            sectionVariantsForSiblingMerge: sectionVariants,
          }
          const gradeSnap = await gradeSnapshotForStudent(row.id)
          const pct = await getCanvasExtraExportScorePercent(
            row.id,
            sess,
            em.key,
            em.key === "attendance" ? attendanceRosterCtx : undefined,
            gradeSnap,
          )
          return {
            student_id: row.id,
            assignment_id: em.id,
            score: pct,
          }
        })

  const { students: rosterStudents, submissions: rosterSubmissions } = dedupeCanvasExportRoster(
    students,
    [...submissionsFromQuiz, ...extraSubmissions],
  )

  return {
    ok: true,
    input: {
      students: rosterStudents,
      assignments,
      submissions: rosterSubmissions,
      sectionFilter,
      missingScoreDisplay,
    },
  }
}

/**
 * POST /api/export/canvas
 * Body: { assignmentIds, sectionFilter, preview?, missingScoreDisplay?, rosterAllowlistCsv? }
 * Section scope uses `normalizedSectionVariantsForSql(sectionFilter)` and `sessions.code` via join, not `sessionId`.
 * Optional `rosterAllowlistCsv`: paste Canvas roster — only those students appear. Some sections (e.g. ELEG1301P01)
 * use a built-in allowlist when this field is omitted.
 * - preview true → JSON { rows: string[][] }
 * - else → text/csv
 */
export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) {
      return scope.response
    }
    const { instructorId, course } = scope
    const instId = instructorId
    const accessActor = await loadQuizAccessActor(instId, course)
    if (!accessActor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { actor, courseOwnerId } = accessActor

    let body: Body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const rawIds = Array.isArray(body.assignmentIds) ? body.assignmentIds : []
    const sectionFilter = String(body.sectionFilter ?? "All").trim() || "All"
    const preview = body.preview === true
    const missingScoreDisplay = parseMissingScoreDisplay(body.missingScoreDisplay)

    const loaded = await loadCanvasExportInput(
      instId,
      course.id,
      actor,
      courseOwnerId,
      rawIds,
      sectionFilter,
      missingScoreDisplay,
    )
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status })
    }

    const rosterCsvFromBody =
      typeof body.rosterAllowlistCsv === "string" ? body.rosterAllowlistCsv.trim() : ""
    const embeddedCsv =
      rosterCsvFromBody.length === 0 ? getEmbeddedCanvasRosterAllowlistCsv(sectionFilter) : null
    const effectiveRosterCsv =
      rosterCsvFromBody.length > 0 ? rosterCsvFromBody : embeddedCsv ?? ""

    let exportInput: GenerateCanvasExportInput = loaded.input
    if (effectiveRosterCsv.length > 0) {
      const parsed = parseCanvasRosterAllowlistCsv(effectiveRosterCsv)
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 })
      }
      exportInput = filterCanvasExportInputByAllowlist(loaded.input, parsed.allowlist)
    }

    const excludeStudentIds = parseExcludeStudentIds(body.excludeStudentIds)
    if (excludeStudentIds.length > 0) {
      exportInput = filterCanvasExportInputByExcludedStudents(exportInput, excludeStudentIds)
    }

    if (preview) {
      const rows = buildCanvasExportMatrix(exportInput)
      const assignmentColumnCount = Math.max(0, rows[0].length - CANVAS_GRADEBOOK_FIXED_COLUMN_COUNT)
      return NextResponse.json(
        {
          rows,
          fixedColumnCount: CANVAS_GRADEBOOK_FIXED_COLUMN_COUNT,
          assignmentColumnCount,
        },
        {
          headers: {
            "Cache-Control": "no-store, must-revalidate",
          },
        },
      )
    }

    const csv = canvasMatrixToCsv(buildCanvasExportMatrix(exportInput))
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="canvas_gradebook.csv"',
        "Cache-Control": "no-store, must-revalidate",
      },
    })
  } catch (e: unknown) {
    console.error("[export/canvas]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Export failed" },
      { status: 500 },
    )
  }
}
