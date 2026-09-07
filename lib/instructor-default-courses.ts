import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { defaultElegSectionForCatalogCourse, defaultSessionCodeForCourse } from "@/lib/course-section-model"
import {
  CATALOG_COURSE_METADATA,
  type CatalogCourseCode,
} from "@/lib/catalog-course-metadata"

/** Legacy `groups.session` text ↔ canonical `sessions.code` (session-only scope when `course_id` is missing). */
function groupSessionMatchesSessionRowSql(sessionCol: string): string {
  return `(
      TRIM(UPPER(${sessionCol}::text)) = TRIM(UPPER(sess.code::text))
      OR (TRIM(UPPER(${sessionCol}::text)) = 'E1301P01' AND TRIM(UPPER(sess.code::text)) = 'ELEG1301P01')
      OR (TRIM(UPPER(${sessionCol}::text)) = 'E1304P01' AND TRIM(UPPER(sess.code::text)) = 'ELEG1304P01')
      OR (TRIM(UPPER(${sessionCol}::text)) IN ('ECE2202P01') AND TRIM(UPPER(sess.code::text)) = 'ECE2202')
    )`
}

/** Module flags stored on each `courses.module_settings` row (must match Postgres jsonb defaults). */
const DEFAULT_MODULE_SETTINGS_JSON =
  '{"codeBench":true,"aiTutor":true,"questionBank":true,"practiceHub":true,"announcements":true,"lectures":true,"attendance":true}' as const

/**
 * Ensures ELEG 1301, ELEG 1304, and ECE 2202 logical courses exist for an instructor (idempotent).
 * Safe when a LEGACY / “Primary course” row already exists (we only INSERT missing `(instructor_id, course_code)` pairs).
 */
export async function ensureDefaultElegEceCoursesForInstructor(instructorId: number): Promise<void> {
  if (!Number.isFinite(instructorId) || instructorId < 1) return

  await sql`
    INSERT INTO courses (course_code, course_title, instructor_id, description, is_active, module_settings)
    SELECT 'ELEG1301', ${CATALOG_COURSE_METADATA.ELEG1301.courseTitle}, ${instructorId},
           ${CATALOG_COURSE_METADATA.ELEG1301.description},
           true, ${DEFAULT_MODULE_SETTINGS_JSON}::jsonb
    WHERE NOT EXISTS (
      SELECT 1 FROM courses c WHERE c.instructor_id = ${instructorId} AND c.course_code = 'ELEG1301'
    )
  `
  await sql`
    INSERT INTO courses (course_code, course_title, instructor_id, description, is_active, module_settings)
    SELECT 'ELEG1304', ${CATALOG_COURSE_METADATA.ELEG1304.courseTitle}, ${instructorId},
           ${CATALOG_COURSE_METADATA.ELEG1304.description},
           true, ${DEFAULT_MODULE_SETTINGS_JSON}::jsonb
    WHERE NOT EXISTS (
      SELECT 1 FROM courses c WHERE c.instructor_id = ${instructorId} AND c.course_code = 'ELEG1304'
    )
  `
  await sql`
    INSERT INTO courses (course_code, course_title, instructor_id, description, is_active, module_settings)
    SELECT 'ECE2202', ${CATALOG_COURSE_METADATA.ECE2202.courseTitle}, ${instructorId}, ${CATALOG_COURSE_METADATA.ECE2202.description}, true,
           ${DEFAULT_MODULE_SETTINGS_JSON}::jsonb
    WHERE NOT EXISTS (
      SELECT 1 FROM courses c WHERE c.instructor_id = ${instructorId} AND c.course_code = 'ECE2202'
    )
  `
  await syncCanonicalCatalogCourseMetadata(instructorId)
}

/**
 * Re-points `sessions.course_id` (then students / quizzes / announcements) using the same rules as
 * `migrations/seed-eleg-ece-instructor-courses.sql`, scoped to one instructor’s catalog.
 * Idempotent; safe to repeat.
 */
export async function relinkElegEceSessionsAndDerivedDataForInstructor(instructorId: number): Promise<void> {
  if (!Number.isFinite(instructorId) || instructorId < 1) return

  const rows1301 =
    await sql`SELECT id FROM courses WHERE instructor_id = ${instructorId} AND course_code = 'ELEG1301' LIMIT 1`
  const rows1304 =
    await sql`SELECT id FROM courses WHERE instructor_id = ${instructorId} AND course_code = 'ELEG1304' LIMIT 1`
  const rowsece =
    await sql`SELECT id FROM courses WHERE instructor_id = ${instructorId} AND course_code = 'ECE2202' LIMIT 1`

  const id1301 = Number(rows1301[0]?.id)
  const id1304 = Number(rows1304[0]?.id)
  const idece = Number(rowsece[0]?.id)
  const has1301 = Number.isFinite(id1301) && id1301 > 0
  const has1304 = Number.isFinite(id1304) && id1304 > 0
  const hasEce = Number.isFinite(idece) && idece > 0
  if (!has1301 && !has1304 && !hasEce) return

  const rEce = hasEce
    ? await sql`
    UPDATE sessions s
    SET course_id = ${idece}
    WHERE s.course_id IN (SELECT id FROM courses WHERE instructor_id = ${instructorId})
      AND TRIM(UPPER(s.code)) <> 'BETA'
      AND (
        TRIM(UPPER(s.code)) = 'ECE2202'
        OR TRIM(UPPER(s.code)) ~ '^ECE2202P'
      )
    RETURNING s.id
  `
    : []

  const r1304 = has1304
    ? await sql`
    UPDATE sessions s
    SET course_id = ${id1304}
    WHERE s.course_id IN (SELECT id FROM courses WHERE instructor_id = ${instructorId})
      AND TRIM(UPPER(s.code)) <> 'BETA'
      AND (
        TRIM(UPPER(s.code)) LIKE 'ELEG1304%'
        OR TRIM(UPPER(s.code)) ~ '^E1304P'
      )
    RETURNING s.id
  `
    : []

  const r1301 = has1301
    ? await sql`
    UPDATE sessions s
    SET course_id = ${id1301}
    WHERE s.course_id IN (SELECT id FROM courses WHERE instructor_id = ${instructorId})
      AND TRIM(UPPER(s.code)) <> 'BETA'
      AND (
        TRIM(UPPER(s.code)) LIKE 'ELEG1301%'
        OR TRIM(UPPER(s.code)) ~ '^E1301P'
      )
    RETURNING s.id
  `
    : []

  const touched =
    (Array.isArray(rEce) ? rEce.length : 0) +
    (Array.isArray(r1304) ? r1304.length : 0) +
    (Array.isArray(r1301) ? r1301.length : 0)
  if (touched > 0) {
    await sql`
    UPDATE students st
    SET course_id = sess.course_id
    FROM sessions sess
    WHERE st.session_id = sess.id
      AND sess.course_id IS NOT NULL
      AND st.course_id IS DISTINCT FROM sess.course_id
  `

    await sql`
    UPDATE quizzes q
    SET course_id = sub.new_cid
    FROM (
      SELECT qsa.quiz_id,
        MIN(s.course_id) AS new_cid
      FROM quiz_session_access qsa
      INNER JOIN sessions s ON s.id = qsa.session_id
      GROUP BY qsa.quiz_id
      HAVING COUNT(DISTINCT s.course_id) = 1
    ) sub
    WHERE q.id = sub.quiz_id
      AND q.course_id IS DISTINCT FROM sub.new_cid
  `

    const annCols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'announcements'
      AND column_name IN ('target_session', 'course_id')
  `
    const colNames =
      Array.isArray(annCols) && annCols.length > 0
        ? (annCols as { column_name: string }[]).map((r) => r.column_name)
        : []
    const hasAnnouncementRelink =
      colNames.includes("target_session") && colNames.includes("course_id")

    if (hasAnnouncementRelink) {
      await sql`
      UPDATE announcements a
      SET course_id = s.course_id
      FROM sessions s
      WHERE NULLIF(TRIM(a.target_session), '') IS NOT NULL
        AND LOWER(TRIM(a.target_session)) <> 'all'
        AND s.course_id IS NOT NULL
        AND (
          TRIM(UPPER(s.code)) = TRIM(UPPER(a.target_session))
          OR (
            TRIM(UPPER(a.target_session)) ~ '^E1301P'
            AND TRIM(UPPER(s.code)) = 'ELEG' || SUBSTRING(TRIM(UPPER(a.target_session)) FROM 2)
          )
          OR (
            TRIM(UPPER(a.target_session)) ~ '^E1304P'
            AND TRIM(UPPER(s.code)) = 'ELEG' || SUBSTRING(TRIM(UPPER(a.target_session)) FROM 2)
          )
        )
        AND a.course_id IS DISTINCT FROM s.course_id
    `
    }
  }

  await syncLectureCourseIdsFromSingleSessionCourse(instructorId)
  await relinkLectureCourseIdsForElegEceSplit(instructorId, id1301, id1304, idece)
  await relinkModuleContentCourseIdsForElegEceSplit(instructorId, id1301, id1304, idece)
}

/** Raw SQL fragments only — must be combined via `sql.unsafe` (Neon nested `sql` becomes parameters, not text). */
const RELINK_FALSE = "FALSE"

const COL_SESSION_ECE = `(NULLIF(TRIM(l.session::text), '') IS NOT NULL AND TRIM(UPPER(l.session::text)) <> 'BETA' AND (TRIM(UPPER(l.session::text)) = 'ECE2202' OR TRIM(UPPER(l.session::text)) ~ '^ECE2202P'))`
const COL_SESSION_1304 = `(NULLIF(TRIM(l.session::text), '') IS NOT NULL AND TRIM(UPPER(l.session::text)) <> 'BETA' AND (TRIM(UPPER(l.session::text)) LIKE 'ELEG1304%' OR TRIM(UPPER(l.session::text)) ~ '^E1304P'))`
const COL_SESSION_1301 = `(NULLIF(TRIM(l.session::text), '') IS NOT NULL AND TRIM(UPPER(l.session::text)) <> 'BETA' AND (TRIM(UPPER(l.session::text)) LIKE 'ELEG1301%' OR TRIM(UPPER(l.session::text)) ~ '^E1301P'))`

function moduleContentSessionKindSql(tableAlias: string, kind: "ece" | "1304" | "1301"): string {
  const col = `${tableAlias}.session`
  if (kind === "ece") {
    return `(NULLIF(TRIM(${col}::text), '') IS NOT NULL AND TRIM(UPPER(${col}::text)) <> 'BETA' AND (TRIM(UPPER(${col}::text)) = 'ECE2202' OR TRIM(UPPER(${col}::text)) ~ '^ECE2202P'))`
  }
  if (kind === "1304") {
    return `(NULLIF(TRIM(${col}::text), '') IS NOT NULL AND TRIM(UPPER(${col}::text)) <> 'BETA' AND (TRIM(UPPER(${col}::text)) LIKE 'ELEG1304%' OR TRIM(UPPER(${col}::text)) ~ '^E1304P'))`
  }
  return `(NULLIF(TRIM(${col}::text), '') IS NOT NULL AND TRIM(UPPER(${col}::text)) <> 'BETA' AND (TRIM(UPPER(${col}::text)) LIKE 'ELEG1301%' OR TRIM(UPPER(${col}::text)) ~ '^E1301P'))`
}

async function relinkModuleContentCourseIdsForElegEceSplit(
  instructorId: number,
  id1301: number,
  id1304: number,
  idece: number,
): Promise<void> {
  const has1301 = Number.isFinite(id1301) && id1301 > 0
  const has1304 = Number.isFinite(id1304) && id1304 > 0
  const hasEce = Number.isFinite(idece) && idece > 0
  if (!has1301 && !has1304 && !hasEce) return

  const whereEce = moduleContentSessionKindSql("t", "ece")
  const where1304 = moduleContentSessionKindSql("t", "1304")
  const where1301 = moduleContentSessionKindSql("t", "1301")

  for (const table of ["flashcard_decks", "course_digital_notes"] as const) {
    if (hasEce) {
      await sql`
      UPDATE ${sql.unsafe(table)} t
      SET course_id = ${idece}
      WHERE t.course_id IN (SELECT id FROM courses WHERE instructor_id = ${instructorId})
        AND (${sql.unsafe(whereEce)})
    `
    }
    if (has1304) {
      await sql`
      UPDATE ${sql.unsafe(table)} t
      SET course_id = ${id1304}
      WHERE t.course_id IN (SELECT id FROM courses WHERE instructor_id = ${instructorId})
        AND (${sql.unsafe(where1304)})
    `
    }
    if (has1301) {
      await sql`
      UPDATE ${sql.unsafe(table)} t
      SET course_id = ${id1301}
      WHERE t.course_id IN (SELECT id FROM courses WHERE instructor_id = ${instructorId})
        AND (${sql.unsafe(where1301)})
    `
    }
  }
}

function junctionSql(
  hasLsa: boolean,
  kind: "ece" | "1304" | "1301",
): string {
  if (!hasLsa) return RELINK_FALSE
  let sessionPredicate: string
  if (kind === "ece") {
    sessionPredicate = `(TRIM(UPPER(sess.code)) = 'ECE2202' OR TRIM(UPPER(sess.code)) ~ '^ECE2202P')`
  } else if (kind === "1304") {
    sessionPredicate = `(TRIM(UPPER(sess.code)) LIKE 'ELEG1304%' OR TRIM(UPPER(sess.code)) ~ '^E1304P')`
  } else {
    sessionPredicate = `(TRIM(UPPER(sess.code)) LIKE 'ELEG1301%' OR TRIM(UPPER(sess.code)) ~ '^E1301P')`
  }
  return `EXISTS (
    SELECT 1 FROM lecture_session_access lsa
    INNER JOIN sessions sess ON sess.id = lsa.session_id
    WHERE lsa.lecture_id = l.id
      AND COALESCE(lsa.is_active, true) = true
      AND TRIM(UPPER(sess.code)) <> 'BETA'
      AND (${sessionPredicate})
  )`
}

function jsonbSessionAccessClause(jsonbExpr: string, kind: "ece" | "1304" | "1301"): string {
  let keyPred: string
  let tailJson: string
  if (kind === "ece") {
    keyPred = `(TRIM(UPPER(e.k)) = 'ECE2202' OR TRIM(UPPER(e.k)) ~ '^ECE2202P')`
    tailJson = `(TRIM(UPPER(sa.code::text)) = 'ECE2202' OR TRIM(UPPER(sa.code::text)) ~ '^ECE2202P')`
  } else if (kind === "1304") {
    keyPred = `(TRIM(UPPER(e.k)) LIKE 'ELEG1304%' OR TRIM(UPPER(e.k)) ~ '^E1304P')`
    tailJson = `(TRIM(UPPER(sa.code::text)) LIKE 'ELEG1304%' OR TRIM(UPPER(sa.code::text)) ~ '^E1304P')`
  } else {
    keyPred = `(TRIM(UPPER(e.k)) LIKE 'ELEG1301%' OR TRIM(UPPER(e.k)) ~ '^E1301P')`
    tailJson = `(TRIM(UPPER(sa.code::text)) LIKE 'ELEG1301%' OR TRIM(UPPER(sa.code::text)) ~ '^E1301P')`
  }

  const j = `(${jsonbExpr})`
  return `(EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(${j}) = 'array' THEN ${j} ELSE '[]'::jsonb END
    ) AS sa(code)
    WHERE NULLIF(TRIM(sa.code::text), '') IS NOT NULL
      AND TRIM(UPPER(sa.code::text)) <> 'BETA'
      AND (${tailJson})
  ) OR EXISTS (
    SELECT 1 FROM jsonb_each(
      CASE WHEN jsonb_typeof(${j}) = 'object' THEN ${j} ELSE '{}'::jsonb END
    ) AS e(k, v)
    WHERE (v = 'true'::jsonb OR v = '1'::jsonb)
      AND NULLIF(TRIM(e.k), '') IS NOT NULL
      AND TRIM(UPPER(e.k)) <> 'BETA'
      AND (${keyPred})
  ))`
}

function sessionAccessSql(udt: string, dataType: string, kind: "ece" | "1304" | "1301"): string {
  const c = "sa.code"
  let tail: string
  if (kind === "ece") {
    tail = `(TRIM(UPPER(${c})) = 'ECE2202' OR TRIM(UPPER(${c})) ~ '^ECE2202P')`
  } else if (kind === "1304") {
    tail = `(TRIM(UPPER(${c})) LIKE 'ELEG1304%' OR TRIM(UPPER(${c})) ~ '^E1304P')`
  } else {
    tail = `(TRIM(UPPER(${c})) LIKE 'ELEG1301%' OR TRIM(UPPER(${c})) ~ '^E1301P')`
  }

  if (udt === "_text" || dataType === "ARRAY") {
    return `EXISTS (
      SELECT 1 FROM unnest(COALESCE(l.session_access, ARRAY[]::text[])) AS sa(code)
      WHERE NULLIF(TRIM(sa.code), '') IS NOT NULL
        AND TRIM(UPPER(sa.code)) <> 'BETA'
        AND (${tail})
    )`
  }
  if (udt === "jsonb" || dataType === "jsonb") {
    return jsonbSessionAccessClause(`COALESCE(l.session_access::jsonb, 'null'::jsonb)`, kind)
  }
  if (dataType === "text" || udt === "text" || dataType === "character varying") {
    return jsonbSessionAccessClause(
      `COALESCE(NULLIF(TRIM(l.session_access::text), '')::jsonb, 'null'::jsonb)`,
      kind,
    )
  }
  return RELINK_FALSE
}

/**
 * Assigns `lectures.course_id` to ELEG1301 / ELEG1304 / ECE2202 using the same section-code rules as `sessions`.
 * Previously only sessions (and derived rows) were relinked; legacy lectures kept a stale `course_id`, so the
 * instructor UI showed no slides after switching the scoped course.
 */
async function relinkLectureCourseIdsForElegEceSplit(
  instructorId: number,
  id1301: number,
  id1304: number,
  idece: number,
): Promise<void> {
  const has1301 = Number.isFinite(id1301) && id1301 > 0
  const has1304 = Number.isFinite(id1304) && id1304 > 0
  const hasEce = Number.isFinite(idece) && idece > 0
  if (!has1301 && !has1304 && !hasEce) return

  const lsaTbl = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'lecture_session_access'
    LIMIT 1
  `
  const hasLsa = Array.isArray(lsaTbl) && lsaTbl.length > 0

  const saCol = await sql`
    SELECT data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lectures' AND column_name = 'session_access'
    LIMIT 1
  `
  const udt =
    Array.isArray(saCol) && saCol.length > 0
      ? String((saCol[0] as { udt_name?: string }).udt_name ?? "")
      : ""
  const dataType =
    Array.isArray(saCol) && saCol.length > 0
      ? String((saCol[0] as { data_type?: string }).data_type ?? "")
      : ""

  const jEce = junctionSql(hasLsa, "ece")
  const j1304 = junctionSql(hasLsa, "1304")
  const j1301 = junctionSql(hasLsa, "1301")
  const saEce = sessionAccessSql(udt, dataType, "ece")
  const sa1304 = sessionAccessSql(udt, dataType, "1304")
  const sa1301 = sessionAccessSql(udt, dataType, "1301")

  const whereEce = `${jEce} OR ${saEce} OR ${COL_SESSION_ECE}`
  const where1304 = `${j1304} OR ${sa1304} OR ${COL_SESSION_1304}`
  const where1301 = `${j1301} OR ${sa1301} OR ${COL_SESSION_1301}`

  if (hasEce) {
    await sql`
    UPDATE lectures l
    SET course_id = ${idece}
    WHERE l.course_id IN (SELECT id FROM courses WHERE instructor_id = ${instructorId})
      AND (${sql.unsafe(whereEce)})
  `
  }
  if (has1304) {
    await sql`
    UPDATE lectures l
    SET course_id = ${id1304}
    WHERE l.course_id IN (SELECT id FROM courses WHERE instructor_id = ${instructorId})
      AND (${sql.unsafe(where1304)})
  `
  }
  if (has1301) {
    await sql`
    UPDATE lectures l
    SET course_id = ${id1301}
    WHERE l.course_id IN (SELECT id FROM courses WHERE instructor_id = ${instructorId})
      AND (${sql.unsafe(where1301)})
  `
  }
}

/**
 * Cached: whether `public.lecture_session_access` exists (some older DBs never ran the migration).
 */
let lectureSessionAccessTableExists: boolean | null = null

export async function hasLectureSessionAccessTable(): Promise<boolean> {
  if (lectureSessionAccessTableExists !== null) return lectureSessionAccessTableExists
  const rows = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'lecture_session_access'
    LIMIT 1
  `
  lectureSessionAccessTableExists = Array.isArray(rows) && rows.length > 0
  return lectureSessionAccessTableExists
}

/**
 * Lectures for these course codes share one logical **content pool** for LEGACY (all sections).
 * When the dashboard scope is ELEG1301 or ELEG1304, section filters (e.g. P01-only) are applied separately
 * in SQL; student/question-bank routes may still treat these as one bank where no section column exists.
 */
export const ELEG_SHARED_LECTURE_COURSE_CODES = ["LEGACY", "ELEG1301", "ELEG1304"] as const

export function isElegSharedLectureCourseCode(courseCode: string | null | undefined): boolean {
  const c = String(courseCode ?? "")
    .trim()
    .toUpperCase()
  return (ELEG_SHARED_LECTURE_COURSE_CODES as readonly string[]).includes(c)
}

function elegSharedLectureSqlInList(): string {
  return (
    "(" +
    ELEG_SHARED_LECTURE_COURSE_CODES.map((c) => `'${String(c).replace(/'/g, "''")}'`).join(", ") +
    ")"
  )
}

function sanitizeSqlTableAlias(alias: string): string {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(alias) ? alias : "t"
}

/** `alias.column` only — used for section filters */
function isSafeQualifiedSqlColumn(expr: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*$/.test(String(expr ?? "").trim())
}

function resolveElegSectionScopeAnchor(
  scopeCourseCode: string,
  selectedSessionCode?: string | null,
): string {
  const selected = String(selectedSessionCode ?? "").trim().toUpperCase()
  const c = String(scopeCourseCode ?? "").trim().toUpperCase()

  if (selected) {
    if (c === "ELEG1301" && selected.startsWith("ELEG1301")) return selected
    if (c === "ELEG1304" && selected.startsWith("ELEG1304")) return selected
    if (c === "LEGACY" && selected.startsWith("ELEG")) return selected
    if (c === selected || c.startsWith(selected)) return selected
  }

  return defaultElegSectionForCatalogCourse(c) ?? ""
}

export type InstructorOwnedCourseScopeOptions = {
  /** Dashboard `courses.course_code` — for ELEG1301 / ELEG1304, limits bundle rows to the active section */
  scopeCourseCode?: string | null
  /** Instructor-selected section from `x-session-id` (e.g. ELEG1304P03 for Fall 2026). */
  selectedSessionCode?: string | null
  /** e.g. `g.session`, `groups.session` */
  sessionQualifiedColumn?: string | null
}

/**
 * Instructor-owned rows with a `course_id` column: strict match for courses like ECE2202.
 * LEGACY shares one pool across LEGACY / ELEG1301 / ELEG1304 (`NULL` course_id counts as bundle-only).
 * ELEG1301 / ELEG1304 (when `sessionQualifiedColumn` is set) only include bundle rows for the
 * **selected section** (Fall 2026: ELEG1304P03, ELEG1301P01/P02); LEGACY without a section gate sees all sections.
 */
export function buildInstructorOwnedCourseScopeSqlFragment(
  tableAlias: string,
  courseIdColumn: string,
  courseId: number,
  instructorId: number,
  opts?: InstructorOwnedCourseScopeOptions,
) {
  const a = sanitizeSqlTableAlias(tableAlias)
  const col = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(courseIdColumn) ? courseIdColumn : "course_id"
  const cid = Math.trunc(Number(courseId))
  const iid = Math.trunc(Number(instructorId))
  if (!Number.isFinite(cid) || cid < 1 || !Number.isFinite(iid) || iid < 1) {
    return sql.unsafe(`(FALSE)`)
  }

  const sessionCol = String(opts?.sessionQualifiedColumn ?? "").trim()
  const anchor = resolveElegSectionScopeAnchor(
    String(opts?.scopeCourseCode ?? ""),
    opts?.selectedSessionCode,
  )
  const sessionVariants =
    anchor && isSafeQualifiedSqlColumn(sessionCol) ? normalizedSectionVariantsForSql(anchor) : []
  const sessionPred =
    sessionVariants.length > 0
      ? `(TRIM(UPPER(${sessionCol}::text)) = ANY(ARRAY[${sessionVariants.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(", ")}]::text[]))`
      : ""

  const elegBundleRows = `(
      ${a}.${col} IN (
        SELECT c_lect.id FROM courses c_lect
        WHERE c_lect.instructor_id = ${iid}
          AND TRIM(UPPER(c_lect.course_code::text)) IN ${elegSharedLectureSqlInList()}
      )
      OR ${a}.${col} IS NULL
    )`

  const elegSharedOr = sessionPred
    ? `(
    ${cid} IN (
      SELECT c_sel.id FROM courses c_sel
      WHERE c_sel.instructor_id = ${iid}
        AND TRIM(UPPER(c_sel.course_code::text)) IN ${elegSharedLectureSqlInList()}
    )
    AND ${elegBundleRows}
    AND ${sessionPred}
  )`
    : `(
    ${cid} IN (
      SELECT c_sel.id FROM courses c_sel
      WHERE c_sel.instructor_id = ${iid}
        AND TRIM(UPPER(c_sel.course_code::text)) IN ${elegSharedLectureSqlInList()}
    )
    AND ${elegBundleRows}
  )`

  const strictMatch = sessionPred ? `( ${a}.${col} = ${cid} AND ${sessionPred} )` : `( ${a}.${col} = ${cid} )`

  return sql.unsafe(`(
    ${strictMatch}
    OR ${elegSharedOr}
  )`)
}

/**
 * Classroom playground sessions: same course rules plus optional legacy rows with NULL instructor_id.
 * ELEG1301 / ELEG1304 use **this course row only** (+ NULL course_id), so 1301/1304 classroom runs do not
 * leak across the old LEGACY bundle; LEGACY still uses the full bundle.
 */
export function buildPlaygroundClassroomInstructorScopeSql(
  tableAlias: string,
  courseId: number,
  instructorId: number,
  scopeCourseCode?: string | null,
) {
  const a = sanitizeSqlTableAlias(tableAlias)
  const cid = Math.trunc(Number(courseId))
  const iid = Math.trunc(Number(instructorId))
  if (!Number.isFinite(cid) || cid < 1 || !Number.isFinite(iid) || iid < 1) {
    return sql.unsafe(`(FALSE)`)
  }
  const code = String(scopeCourseCode ?? "")
    .trim()
    .toUpperCase()
  const narrowToThisCourseId = code === "ELEG1301" || code === "ELEG1304"

  if (narrowToThisCourseId) {
    return sql.unsafe(`(
    (${a}.instructor_id = ${iid} OR ${a}.instructor_id IS NULL)
    AND ( ${a}.course_id = ${cid} OR ${a}.course_id IS NULL )
  )`)
  }

  const elegList = elegSharedLectureSqlInList()
  const courseInner = `(
    ${a}.course_id = ${cid}
    OR (
      ${cid} IN (
        SELECT c_sel.id FROM courses c_sel
        WHERE c_sel.instructor_id = ${iid}
          AND TRIM(UPPER(c_sel.course_code::text)) IN ${elegList}
      )
      AND (
        ${a}.course_id IN (
          SELECT c_lect.id FROM courses c_lect
          WHERE c_lect.instructor_id = ${iid}
            AND TRIM(UPPER(c_lect.course_code::text)) IN ${elegList}
        )
        OR ${a}.course_id IS NULL
      )
    )
  )`
  return sql.unsafe(`(
    (${a}.instructor_id = ${iid} OR ${a}.instructor_id IS NULL)
    AND ${courseInner}
  )`)
}

let playgroundSessionsScopeColsPromise: Promise<{ hasCourseId: boolean; hasInstructorId: boolean }> | null = null

async function loadPlaygroundSessionsScopeColumns(): Promise<{ hasCourseId: boolean; hasInstructorId: boolean }> {
  const rows = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'playground_sessions'
      AND column_name IN ('course_id', 'instructor_id')
  `
  const names = new Set(
    (Array.isArray(rows) ? (rows as { column_name: string }[]) : []).map((r) => r.column_name),
  )
  return {
    hasCourseId: names.has("course_id"),
    hasInstructorId: names.has("instructor_id"),
  }
}

/** Whether `playground_sessions` has columns added by `add-course-scope-groups-projects-playground.sql`. */
export async function getPlaygroundSessionsScopeColumns(): Promise<{
  hasCourseId: boolean
  hasInstructorId: boolean
}> {
  if (!playgroundSessionsScopeColsPromise) {
    playgroundSessionsScopeColsPromise = loadPlaygroundSessionsScopeColumns()
  }
  return playgroundSessionsScopeColsPromise
}

/**
 * Scope fragment for instructor playground APIs. Before migration, columns may be missing — avoid 500s by
 * matching all CLASSROOM rows (legacy single-tenant). After migration, uses full course + instructor scope.
 */
export async function resolvePlaygroundClassroomInstructorScopeSql(
  tableAlias: string,
  courseId: number,
  instructorId: number,
  scopeCourseCode?: string | null,
) {
  const cols = await getPlaygroundSessionsScopeColumns()
  if (cols.hasCourseId && cols.hasInstructorId) {
    return buildPlaygroundClassroomInstructorScopeSql(tableAlias, courseId, instructorId, scopeCourseCode)
  }
  return buildPlaygroundClassroomSessionOnlyScopeSql(tableAlias, courseId, instructorId)
}

let groupsProjectsCourseIdColsPromise: Promise<{
  groupsHasCourseId: boolean
  projectsHasCourseId: boolean
  groupsHasSessionId: boolean
}> | null = null

/** Call after applying `add-course-scope-groups-projects-playground.sql` (or in tests). */
export function resetInstructorScopeColumnCaches(): void {
  groupsProjectsCourseIdColsPromise = null
  playgroundSessionsScopeColsPromise = null
}

async function loadGroupsProjectsCourseIdColumns(): Promise<{
  groupsHasCourseId: boolean
  projectsHasCourseId: boolean
  groupsHasSessionId: boolean
}> {
  const rows = await sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('groups', 'projects')
      AND column_name IN ('course_id', 'session_id')
  `
  const groupCols = new Set(
    (Array.isArray(rows) ? (rows as { table_name: string; column_name: string }[]) : [])
      .filter((r) => r.table_name === "groups")
      .map((r) => r.column_name),
  )
  const projectCols = new Set(
    (Array.isArray(rows) ? (rows as { table_name: string; column_name: string }[]) : [])
      .filter((r) => r.table_name === "projects")
      .map((r) => r.column_name),
  )
  return {
    groupsHasCourseId: groupCols.has("course_id"),
    projectsHasCourseId: projectCols.has("course_id"),
    groupsHasSessionId: groupCols.has("session_id"),
  }
}

/** Whether `groups` / `projects` have `course_id` (see `add-course-scope-groups-projects-playground.sql`). */
export async function getGroupsProjectsCourseIdColumns(): Promise<{
  groupsHasCourseId: boolean
  projectsHasCourseId: boolean
  groupsHasSessionId: boolean
}> {
  if (!groupsProjectsCourseIdColsPromise) {
    groupsProjectsCourseIdColsPromise = loadGroupsProjectsCourseIdColumns()
  }
  return groupsProjectsCourseIdColsPromise
}

/**
 * Session-based scope for `groups` when `groups.course_id` is not migrated yet.
 * Maps `groups.session` → `sessions.code` → `sessions.course_id`.
 */
export function buildInstructorGroupsSessionOnlyScopeSqlFragment(
  tableAlias: string,
  courseId: number,
  instructorId: number,
  scopeCourseCode: string,
  sessionQualifiedColumn: string,
  selectedSessionCode?: string | null,
) {
  const a = sanitizeSqlTableAlias(tableAlias)
  const sessionCol = isSafeQualifiedSqlColumn(sessionQualifiedColumn)
    ? sessionQualifiedColumn
    : `${a}.session`
  const cid = Math.trunc(Number(courseId))
  const iid = Math.trunc(Number(instructorId))
  if (!Number.isFinite(cid) || cid < 1 || !Number.isFinite(iid) || iid < 1) {
    return sql.unsafe(`(FALSE)`)
  }

  const code = String(scopeCourseCode ?? "")
    .trim()
    .toUpperCase()
  const anchor = resolveElegSectionScopeAnchor(code, selectedSessionCode)
  const sessionVariants = anchor ? normalizedSectionVariantsForSql(anchor) : []
  const anchorPred =
    sessionVariants.length > 0
      ? `(TRIM(UPPER(${sessionCol}::text)) = ANY(ARRAY[${sessionVariants.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(", ")}]::text[]))`
      : ""
  const matchRow = groupSessionMatchesSessionRowSql(sessionCol)

  if (code === "LEGACY") {
    const elegList = elegSharedLectureSqlInList()
    return sql.unsafe(`(
      EXISTS (
        SELECT 1 FROM sessions sess
        INNER JOIN courses c_sess ON c_sess.id = sess.course_id AND c_sess.instructor_id = ${iid}
        WHERE TRIM(UPPER(c_sess.course_code::text)) IN ${elegList}
          AND ${matchRow}
      )
    )`)
  }

  if (code === "ELEG1301" || code === "ELEG1304") {
    const anchorSql = anchorPred ? ` AND ${anchorPred}` : ""
    return sql.unsafe(`(
      EXISTS (
        SELECT 1 FROM sessions sess
        WHERE sess.course_id = ${cid}
          AND sess.course_id IN (SELECT id FROM courses WHERE instructor_id = ${iid})
          AND ${matchRow}
          ${anchorSql}
      )
    )`)
  }

  return sql.unsafe(`(
    EXISTS (
      SELECT 1 FROM sessions sess
      WHERE sess.course_id = ${cid}
        AND sess.course_id IN (SELECT id FROM courses WHERE instructor_id = ${iid})
        AND ${matchRow}
    )
  )`)
}

/**
 * Playground CLASSROOM rows without `course_id`: only sessions whose `allowed_sessions` ids belong to the scoped course.
 */
export function buildPlaygroundClassroomSessionOnlyScopeSql(
  tableAlias: string,
  courseId: number,
  instructorId: number,
) {
  const a = sanitizeSqlTableAlias(tableAlias)
  const cid = Math.trunc(Number(courseId))
  const iid = Math.trunc(Number(instructorId))
  if (!Number.isFinite(cid) || cid < 1 || !Number.isFinite(iid) || iid < 1) {
    return sql.unsafe(`(FALSE)`)
  }

  return sql.unsafe(`(
    ${a}.allowed_sessions IS NOT NULL
    AND cardinality(${a}.allowed_sessions) > 0
    AND EXISTS (
      SELECT 1 FROM unnest(${a}.allowed_sessions) AS allowed_id
      INNER JOIN sessions sess ON sess.id = allowed_id
      WHERE sess.course_id = ${cid}
        AND sess.course_id IN (SELECT id FROM courses WHERE instructor_id = ${iid})
    )
    AND NOT EXISTS (
      SELECT 1 FROM unnest(${a}.allowed_sessions) AS allowed_id
      INNER JOIN sessions sess ON sess.id = allowed_id
      WHERE sess.course_id IS NOT NULL
        AND sess.course_id <> ${cid}
    )
  )`)
}

/**
 * Scope on `groups.course_id` for instructor APIs. Falls back to session→course mapping when the column is missing.
 */
export async function resolveInstructorOwnedGroupsCourseScopeSqlFragment(
  tableAlias: string,
  courseId: number,
  instructorId: number,
  scopeCourseCode: string,
  sessionQualifiedColumn: string,
  selectedSessionCode?: string | null,
) {
  const cols = await getGroupsProjectsCourseIdColumns()
  if (!cols.groupsHasCourseId) {
    return buildInstructorGroupsSessionOnlyScopeSqlFragment(
      tableAlias,
      courseId,
      instructorId,
      scopeCourseCode,
      sessionQualifiedColumn,
      selectedSessionCode,
    )
  }
  return buildInstructorOwnedCourseScopeSqlFragment(tableAlias, "course_id", courseId, instructorId, {
    scopeCourseCode,
    sessionQualifiedColumn,
    selectedSessionCode,
  })
}

/**
 * SQL fragment (student context): lecture row is in the ELEG shared bundle for `instructorId`.
 * Caller must only OR this in when the student's session course is also in the bundle
 * (see `isElegSharedLectureCourseCode`).
 */
export function elegSharedLectureStudentBundleSql(instructorId: number) {
  const iid = Math.trunc(Number(instructorId))
  if (!Number.isFinite(iid) || iid < 1) {
    return sql.unsafe("(FALSE)")
  }
  return sql.unsafe(`(
    l.course_id IN (
      SELECT c.id FROM courses c
      WHERE c.instructor_id = ${iid}
        AND TRIM(UPPER(c.course_code::text)) IN ${elegSharedLectureSqlInList()}
    )
  )`)
}

/**
 * SQL fragment: lecture is in-scope for the instructor's selected `courseId`.
 * When `lecture_session_access` is missing, falls back to `course_id` / NULL only (no junction OR).
 */
export async function buildLectureInstructorCourseScopeSqlFragment(
  courseId: number,
  instructorId: number,
  scopeCourseCode?: string | null,
  selectedSessionCode?: string | null,
) {
  const cid = Math.trunc(Number(courseId))
  const iid = Math.trunc(Number(instructorId))
  if (!Number.isFinite(cid) || cid < 1 || !Number.isFinite(iid) || iid < 1) {
    return sql.unsafe(`(FALSE)`)
  }

  const anchor = resolveElegSectionScopeAnchor(String(scopeCourseCode ?? ""), selectedSessionCode)
  const lectureSessionVariants = anchor ? normalizedSectionVariantsForSql(anchor) : []
  const sessionPred =
    lectureSessionVariants.length > 0
      ? `(l.session IS NULL OR TRIM(UPPER(l.session::text)) = ANY(ARRAY[${lectureSessionVariants.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(", ")}]::text[]))`
      : ""

  const elegSharedOr = `(
    ${cid} IN (
      SELECT c_sel.id FROM courses c_sel
      WHERE c_sel.instructor_id = ${iid}
        AND TRIM(UPPER(c_sel.course_code::text)) IN ${elegSharedLectureSqlInList()}
    )
    AND l.course_id IN (
      SELECT c_lect.id FROM courses c_lect
      WHERE c_lect.instructor_id = ${iid}
        AND TRIM(UPPER(c_lect.course_code::text)) IN ${elegSharedLectureSqlInList()}
    )
  )`

  const hasLsa = await hasLectureSessionAccessTable()
  const inner = hasLsa
    ? `(
    l.course_id = ${cid}
    OR l.course_id IS NULL
    OR ${elegSharedOr}
    OR EXISTS (
      SELECT 1 FROM lecture_session_access lsa
      INNER JOIN sessions sess ON sess.id = lsa.session_id
      WHERE lsa.lecture_id = l.id
        AND COALESCE(lsa.is_active, true) = true
        AND sess.course_id = ${cid}
    )
  )`
    : `(
    l.course_id = ${cid}
    OR l.course_id IS NULL
    OR ${elegSharedOr}
  )`

  return sql.unsafe(sessionPred ? `( ${inner} AND ${sessionPred} )` : inner)
}

async function syncLectureCourseIdsFromSingleSessionCourse(instructorId: number): Promise<void> {
  const lsaTbl = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'lecture_session_access'
    LIMIT 1
  `
  if (!Array.isArray(lsaTbl) || lsaTbl.length === 0) return

  await sql`
    UPDATE lectures l
    SET course_id = sub.new_cid
    FROM (
      SELECT l2.id AS lid, MIN(s.course_id) AS new_cid
      FROM lectures l2
      INNER JOIN lecture_session_access lsa ON lsa.lecture_id = l2.id AND COALESCE(lsa.is_active, true) = true
      INNER JOIN sessions s ON s.id = lsa.session_id
      WHERE (
        l2.course_id IN (SELECT id FROM courses WHERE instructor_id = ${instructorId})
        OR l2.course_id IS NULL
      )
        AND s.course_id IN (SELECT id FROM courses WHERE instructor_id = ${instructorId})
        AND s.course_id IS NOT NULL
      GROUP BY l2.id
      HAVING COUNT(DISTINCT s.course_id) = 1
    ) sub
    WHERE l.id = sub.lid
      AND l.course_id IS DISTINCT FROM sub.new_cid
  `
}

/**
 * Re-points `lectures.course_id` for ELEG/ECE split (no session/student/quiz side effects).
 * Safe to call on each scoped instructor request so production (auto-seed off) still picks up relinks.
 */
export async function syncLectureCourseIdsForElegEceInstructor(instructorId: number): Promise<void> {
  if (!Number.isFinite(instructorId) || instructorId < 1) return

  await syncLectureCourseIdsFromSingleSessionCourse(instructorId)

  const rows1301 =
    await sql`SELECT id FROM courses WHERE instructor_id = ${instructorId} AND course_code = 'ELEG1301' LIMIT 1`
  const rows1304 =
    await sql`SELECT id FROM courses WHERE instructor_id = ${instructorId} AND course_code = 'ELEG1304' LIMIT 1`
  const rowsece =
    await sql`SELECT id FROM courses WHERE instructor_id = ${instructorId} AND course_code = 'ECE2202' LIMIT 1`

  const id1301 = Number(rows1301[0]?.id)
  const id1304 = Number(rows1304[0]?.id)
  const idece = Number(rowsece[0]?.id)
  if (!id1301 || !id1304 || !idece) return

  await relinkLectureCourseIdsForElegEceSplit(instructorId, id1301, id1304, idece)
}

/**
 * Ensures ECE 2202 has a single roster session (`ECE2202`), not P-section codes.
 */
export async function ensureEce2202DefaultSessionForInstructor(instructorId: number): Promise<void> {
  if (!Number.isFinite(instructorId) || instructorId < 1) return

  const rowsece =
    await sql`SELECT id FROM courses WHERE instructor_id = ${instructorId} AND course_code = 'ECE2202' LIMIT 1`
  const idece = Number(rowsece[0]?.id)
  if (!idece) return

  const sessionCode = defaultSessionCodeForCourse("ECE2202") ?? "ECE2202"
  const existing = await sql`
    SELECT id FROM sessions
    WHERE course_id = ${idece}
      AND TRIM(code) = ${sessionCode}
      AND academic_term_id IS NULL
    LIMIT 1
  `
  if (existing.length === 0) {
    await sql`
      INSERT INTO sessions (code, description, course_id)
      VALUES (${sessionCode}, ${CATALOG_COURSE_METADATA.ECE2202.courseTitle}, ${idece})
    `
  } else {
    await sql`
      UPDATE sessions
      SET description = COALESCE(description, ${CATALOG_COURSE_METADATA.ECE2202.courseTitle})
      WHERE id = ${existing[0].id}
    `
  }

  const canonRows =
    await sql`SELECT id FROM sessions WHERE course_id = ${idece} AND TRIM(code) = ${sessionCode} LIMIT 1`
  const canonId = Number(canonRows[0]?.id)
  if (!canonId) return

  const legacyRows = await sql`
    SELECT id, code FROM sessions
    WHERE course_id = ${idece}
      AND id <> ${canonId}
      AND TRIM(UPPER(code)) ~ '^ECE2202P'
  `
  for (const legacy of legacyRows as { id: number; code: string }[]) {
    await sql`
      UPDATE students
      SET section = ${sessionCode}, session_id = ${canonId}
      WHERE session_id = ${legacy.id} OR TRIM(section) = ${legacy.code}
    `
    const lsaTbl = await sql`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'lecture_session_access'
      LIMIT 1
    `
    if (Array.isArray(lsaTbl) && lsaTbl.length > 0) {
      await sql`
        INSERT INTO lecture_session_access (lecture_id, session_id, is_active, updated_at)
        SELECT lsa.lecture_id, ${canonId}, COALESCE(lsa.is_active, true), CURRENT_TIMESTAMP
        FROM lecture_session_access lsa
        WHERE lsa.session_id = ${legacy.id}
        ON CONFLICT (lecture_id, session_id) DO UPDATE
          SET is_active = true, updated_at = CURRENT_TIMESTAMP
      `
      await sql`DELETE FROM lecture_session_access WHERE session_id = ${legacy.id}`
    }
    await sql`DELETE FROM sessions WHERE id = ${legacy.id}`
  }
}

/**
 * Assigns ELEG / LEGACY question_bank rows to ELEG1304 (shared bundle). Skips ECE2202 and circuit-type rows.
 */
export async function relinkQuestionBankToElegBundleForInstructor(instructorId: number): Promise<void> {
  if (!Number.isFinite(instructorId) || instructorId < 1) return

  const rows1304 =
    await sql`SELECT id FROM courses WHERE instructor_id = ${instructorId} AND course_code = 'ELEG1304' LIMIT 1`
  const rowsece =
    await sql`SELECT id FROM courses WHERE instructor_id = ${instructorId} AND course_code = 'ECE2202' LIMIT 1`
  const id1304 = Number(rows1304[0]?.id)
  const idece = Number(rowsece[0]?.id)
  if (!id1304) return

  if (idece) {
    await sql`
      UPDATE question_bank qb
      SET course_id = ${id1304}
      WHERE (qb.course_id IS NULL
         OR qb.course_id IN (
           SELECT c.id FROM courses c
           WHERE c.instructor_id = ${instructorId}
             AND TRIM(UPPER(c.course_code::text)) IN ('LEGACY', 'ELEG1301', 'ELEG1304')
         ))
        AND qb.course_id IS DISTINCT FROM ${idece}
        AND qb.question_type NOT IN (
          'circuit_numeric',
          'circuit_worked_solution',
          'circuit_diagram_analysis',
          'circuit_multi_part',
          'circuit_fill_equation',
          'circuit_transfer_function',
          'circuit_phasor_power',
          'circuit_transient_response',
          'circuit_upload_work'
        )
        AND COALESCE(TRIM(qb.topic::text), '') NOT ILIKE '%circuit%'
        AND COALESCE(TRIM(qb.topic::text), '') NOT ILIKE 'ece2202%'
    `
  } else {
    await sql`
      UPDATE question_bank qb
      SET course_id = ${id1304}
      WHERE qb.course_id IS NULL
         OR qb.course_id IN (
           SELECT c.id FROM courses c
           WHERE c.instructor_id = ${instructorId}
             AND TRIM(UPPER(c.course_code::text)) IN ('LEGACY', 'ELEG1301', 'ELEG1304')
         )
    `
  }
}

/**
 * Primary instructor who owns the shared ELEG/ECE catalog rows.
 * Other faculty may have summer-camp training assignments but not duplicate course shells.
 */
export async function getPrimaryInstructorIdForCourseBootstrap(): Promise<number | null> {
  const fromEnv = process.env.PRIMARY_INSTRUCTOR_ID?.trim()
  if (fromEnv) {
    const n = Number(fromEnv)
    if (Number.isFinite(n) && n > 0) return n
  }
  const rows = await sql`SELECT id FROM instructors WHERE LOWER(username) = 'dmdoe' LIMIT 1`
  const id = rows[0]?.id
  return id != null ? Number(id) : null
}

export async function getUhPrimaryInstructorIdForCourseBootstrap(): Promise<number | null> {
  const rows = await sql`
    SELECT id FROM instructors
    WHERE LOWER(email) = 'dmdoe@cougarnet.uh.edu'
       OR LOWER(username) = 'dmdoe-uh'
    LIMIT 1
  `
  const id = rows[0]?.id
  return id != null ? Number(id) : null
}

export async function ensureDefaultElegCoursesForInstructor(instructorId: number): Promise<void> {
  if (!Number.isFinite(instructorId) || instructorId < 1) return

  await sql`
    INSERT INTO courses (course_code, course_title, instructor_id, description, is_active, module_settings, university_id, university)
    SELECT 'ELEG1301', ${CATALOG_COURSE_METADATA.ELEG1301.courseTitle}, ${instructorId},
           ${CATALOG_COURSE_METADATA.ELEG1301.description},
           true, ${DEFAULT_MODULE_SETTINGS_JSON}::jsonb, 1, 'Prairie View A&M University'
    WHERE NOT EXISTS (
      SELECT 1 FROM courses c WHERE c.instructor_id = ${instructorId} AND c.course_code = 'ELEG1301'
    )
  `
  await sql`
    INSERT INTO courses (course_code, course_title, instructor_id, description, is_active, module_settings, university_id, university)
    SELECT 'ELEG1304', ${CATALOG_COURSE_METADATA.ELEG1304.courseTitle}, ${instructorId},
           ${CATALOG_COURSE_METADATA.ELEG1304.description},
           true, ${DEFAULT_MODULE_SETTINGS_JSON}::jsonb, 1, 'Prairie View A&M University'
    WHERE NOT EXISTS (
      SELECT 1 FROM courses c WHERE c.instructor_id = ${instructorId} AND c.course_code = 'ELEG1304'
    )
  `
}

export async function ensureDefaultEce2202CourseForInstructor(instructorId: number): Promise<void> {
  if (!Number.isFinite(instructorId) || instructorId < 1) return

  await sql`
    INSERT INTO courses (course_code, course_title, instructor_id, description, is_active, module_settings, university_id, university)
    SELECT 'ECE2202', ${CATALOG_COURSE_METADATA.ECE2202.courseTitle}, ${instructorId}, ${CATALOG_COURSE_METADATA.ECE2202.description}, true,
           ${DEFAULT_MODULE_SETTINGS_JSON}::jsonb, 2, 'University of Houston'
    WHERE NOT EXISTS (
      SELECT 1 FROM courses c WHERE c.instructor_id = ${instructorId} AND c.course_code = 'ECE2202'
    )
  `
}

/** Institution-aware bootstrap: PVAMU primary gets ELEG; UH primary gets ECE2202. */

/** Refresh course_title / exchange discoverable titles from syllabus catalog metadata. */
export async function syncCanonicalCatalogCourseMetadata(instructorId?: number): Promise<void> {
  const codes = Object.keys(CATALOG_COURSE_METADATA) as CatalogCourseCode[]
  for (const code of codes) {
    const meta = CATALOG_COURSE_METADATA[code]
    if (instructorId != null) {
      await sql`
        UPDATE courses
        SET course_title = ${meta.courseTitle}, description = ${meta.description}
        WHERE instructor_id = ${instructorId} AND course_code = ${code}
      `
    } else {
      await sql`
        UPDATE courses
        SET course_title = ${meta.courseTitle}, description = ${meta.description}
        WHERE course_code = ${code}
      `
    }

    const legacyTitles = ["ELEG 1301", "ELEG 1304", "ECE 2202"]
    if (instructorId != null) {
      await sql`
        UPDATE course_exchange_settings ces
        SET
          discoverable_title = ${meta.discoverableTitle},
          discoverable_description = COALESCE(ces.discoverable_description, ${meta.description})
        FROM courses c
        WHERE ces.course_id = c.id
          AND c.course_code = ${code}
          AND c.instructor_id = ${instructorId}
          AND (
            ces.discoverable_title IS NULL
            OR ces.discoverable_title = ANY(${legacyTitles})
            OR ces.discoverable_title = c.course_title
          )
      `
    } else {
      await sql`
        UPDATE course_exchange_settings ces
        SET
          discoverable_title = ${meta.discoverableTitle},
          discoverable_description = COALESCE(ces.discoverable_description, ${meta.description})
        FROM courses c
        WHERE ces.course_id = c.id
          AND c.course_code = ${code}
          AND (
            ces.discoverable_title IS NULL
            OR ces.discoverable_title = ANY(${legacyTitles})
            OR ces.discoverable_title = c.course_title
          )
      `
    }
  }
}

export async function bootstrapInstructorCoursesAndLinks(instructorId: number): Promise<void> {
  const pvPrimaryId = await getPrimaryInstructorIdForCourseBootstrap()
  const uhPrimaryId = await getUhPrimaryInstructorIdForCourseBootstrap()

  if (pvPrimaryId != null && instructorId === pvPrimaryId) {
    await ensureDefaultElegCoursesForInstructor(instructorId)
    await relinkElegEceSessionsAndDerivedDataForInstructor(instructorId)
    await relinkQuestionBankToElegBundleForInstructor(instructorId)
    await syncCanonicalCatalogCourseMetadata(instructorId)
    return
  }

  if (uhPrimaryId != null && instructorId === uhPrimaryId) {
    await ensureDefaultEce2202CourseForInstructor(instructorId)
    await ensureEce2202DefaultSessionForInstructor(instructorId)
    await relinkElegEceSessionsAndDerivedDataForInstructor(instructorId)
    await syncCanonicalCatalogCourseMetadata(instructorId)
  }
}

/**
 * Seeds missing ELEG/ECE course rows then re-links sections and derived FKs.
 * Mirrors `seed-eleg-ece-instructor-courses.sql` for one instructor.
 */
export async function bootstrapElegEceCoursesAndLinks(instructorId: number): Promise<void> {
  await bootstrapInstructorCoursesAndLinks(instructorId)
}

/**
 * When true (default): `GET /api/instructor/courses` ensures ELEG/ECE trio exists and updates links even if LEGACY remains.
 * Set `INSTRUCTOR_AUTO_SEED_COURSES=false` to disable.
 */
export function shouldAutoSeedInstructorCourses(): boolean {
  const v = process.env.INSTRUCTOR_AUTO_SEED_COURSES
  if (v === "false" || v === "0") return false
  if (v === "true" || v === "1") return true
  return process.env.NODE_ENV !== "production"
}
