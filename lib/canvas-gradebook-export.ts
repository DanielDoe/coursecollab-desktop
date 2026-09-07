/**
 * Canvas Gradebook CSV export — format matches Canvas "Upload Scores" template.
 * @see https://community.canvaslms.com/t5/Canvas-Basics-Guide/How-do-I-upload-changes-to-the-Gradebook/ta-p/53
 */

/** First five columns Canvas expects before assignment columns (roster + section). */
export const CANVAS_GRADEBOOK_FIXED_HEADERS = [
  "Student",
  "ID",
  "SIS User ID",
  "SIS Login ID",
  "Section",
] as const

export const CANVAS_GRADEBOOK_FIXED_COLUMN_COUNT = CANVAS_GRADEBOOK_FIXED_HEADERS.length

/** Row 2, column 1 label for points-possible row. */
export const CANVAS_POINTS_POSSIBLE_ROW_LABEL = "Points Possible"

/** Assignment columns use a 0–100 scale in CSV cells; row 2 shows this as points possible per column. */
export const CANVAS_EXPORT_GRADE_PERCENT_MAX = 100

/**
 * Trim every row to the header width so preview/CSV never show stray columns.
 * Pads short rows with "".
 */
export function clipCanvasGradebookMatrixToHeaderWidth(matrix: string[][]): string[][] {
  if (matrix.length === 0) return matrix
  const w = matrix[0].length
  if (w < CANVAS_GRADEBOOK_FIXED_COLUMN_COUNT) {
    throw new Error(
      `[canvas export] Header has ${w} columns; Canvas requires at least ${CANVAS_GRADEBOOK_FIXED_COLUMN_COUNT} roster columns`,
    )
  }
  return matrix.map((row) => {
    const next = row.slice(0, w).map((c) => (c === undefined || c === null ? "" : String(c)))
    while (next.length < w) next.push("")
    return next
  })
}

/** One attempt/row from CourseCollab-style exports (long format). Extra fields are ignored. */
export type CourseCollabResultExportRow = {
  student_name: string
  student_id: string
  section: string
  assignment_title: string
  score?: number | string | null  /** Prefer for Points Possible; falls back to total_possible_points; else 100 */
  max_score?: number | string | null
  total_possible_points?: number | string | null
}

type AssignmentColumn = {
  title: string
  pointsPossible: number
}

function normalizeString(v: unknown): string {
  if (v === null || v === undefined) return ""
  return String(v)
}

function assertCanvasGradebookHeaderRow(headerRow: string[]): void {
  for (let i = 0; i < CANVAS_GRADEBOOK_FIXED_COLUMN_COUNT; i++) {
    const expected = CANVAS_GRADEBOOK_FIXED_HEADERS[i]
    const got = normalizeString(headerRow[i]).trim()
    if (got !== expected) {
      throw new Error(
        `[canvas export] Column ${i + 1} must be "${expected}" for Canvas import (got "${got}")`,
      )
    }
  }
}

function assignmentPointsFromRow(
  row: Pick<CourseCollabResultExportRow, "max_score" | "total_possible_points">,
): number {
  const raw = row.max_score ?? row.total_possible_points
  if (raw === null || raw === undefined || raw === "") return 100
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 100
  return n
}

function assignmentKey(title: string, points: number): string {
  return `${title.trim().toLowerCase()}\0${points}`
}

/**
 * Parse loose objects (e.g. from API) into the canonical row shape.
 * Maps quiz_title / assessment_title → assignment_title.
 */
export function normalizeCourseCollabResultRow(
  raw: Record<string, unknown>,
): CourseCollabResultExportRow | null {
  const student_id = normalizeString(raw.student_id).trim()
  if (!student_id) return null

  const title =
    normalizeString(raw.assignment_title).trim() ||
    normalizeString(raw.quiz_title).trim() ||
    normalizeString(raw.assessment_title).trim()

  return {
    student_name: normalizeString(raw.student_name),
    student_id,
    section: normalizeString(raw.section),
    assignment_title: title,
    score: raw.score as CourseCollabResultExportRow["score"],
    max_score: raw.max_score as CourseCollabResultExportRow["max_score"],
    total_possible_points: raw.total_possible_points as CourseCollabResultExportRow["total_possible_points"],
  }
}

/** Score cell: missing / null / undefined → "";0 is a valid grade → "0". */
export function courseCollabScoreToCanvasCell(score: unknown): string {
  if (score === null || score === undefined) return ""
  if (score === "") return ""
  const n = Number(score)
  if (!Number.isFinite(n)) return ""
  return String(n)
}

/**
 * Stored attempt `score` is usually raw points; Canvas export uses a percentage 0–100 per column.
 * `maxPointsRaw` is total possible points for that assessment (same scale as `score`).
 */
export function rawScoreToCanvasExportPercentCell(score: unknown, maxPointsRaw: number): string {
  if (score === null || score === undefined) return ""
  if (score === "") return ""
  const s = Number(score)
  if (!Number.isFinite(s)) return ""
  const max = Number(maxPointsRaw)
  if (!Number.isFinite(max) || max <= 0) return ""
  const pct = (s / max) * CANVAS_EXPORT_GRADE_PERCENT_MAX
  if (!Number.isFinite(pct)) return ""
  return String(Math.round(pct * 100) / 100)
}

function collectUniqueAssignments(rows: CourseCollabResultExportRow[]): AssignmentColumn[] {
  const byKey = new Map<string, AssignmentColumn>()
  for (const row of rows) {
    const title = row.assignment_title.trim() || "Assignment"
    const pointsPossible = assignmentPointsFromRow(row)
    const key = assignmentKey(title, pointsPossible)
    if (!byKey.has(key)) {
      byKey.set(key, { title, pointsPossible })
    }
  }
  return Array.from(byKey.values()).sort((a, b) => {
    const c = a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
    if (c !== 0) return c
    return a.pointsPossible - b.pointsPossible
  })
}

function validateCanvasGradebookMatrix(rows: string[][]): void {
  if (rows.length < 2) {
    throw new Error("[canvas export] CSV must include header and Points Possible row")
  }
  if (rows[0].length !== rows[1].length) {
    throw new Error("[canvas export] Header and Points Possible row column counts differ")
  }
  assertCanvasGradebookHeaderRow(rows[0])
  if (normalizeString(rows[1][0]) !== CANVAS_POINTS_POSSIBLE_ROW_LABEL) {
    throw new Error(`[canvas export] Row 2 must start with "${CANVAS_POINTS_POSSIBLE_ROW_LABEL}"`)
  }
  const len = rows[0].length
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].length !== len) {
      throw new Error(`[canvas export] Row ${i + 1} has ${rows[i].length} columns, expected ${len}`)
    }
    for (let j = 0; j < rows[i].length; j++) {
      const c = rows[i][j]
      if (c === undefined || c === null) {
        throw new Error(`[canvas export] Row ${i + 1} col ${j + 1} is null or undefined`)
      }
    }
  }
}

/** True if row 0 matches Canvas roster headers (after clip). */
export function isCanvasGradebookMatrix(matrix: string[][]): boolean {
  if (!matrix.length || matrix[0].length < CANVAS_GRADEBOOK_FIXED_COLUMN_COUNT) return false
  try {
    assertCanvasGradebookHeaderRow(matrix[0])
    return normalizeString(matrix[1]?.[0]) === CANVAS_POINTS_POSSIBLE_ROW_LABEL
  } catch {
    return false
  }
}

/**
 * Transform long-format CourseCollab result rows into a Canvas Gradebook CSV string.
 * - Row 1: Student, ID, SIS User ID, SIS Login ID, Section, assignment columns
 * - Row 2: Points Possible, empty fixed cells, then max points per assignment
 * - Row 3+: one row per student_id; missing assignment → ""; SIS columns always ""
 *
 * Ignores completed_at and any other fields not listed in CourseCollabResultExportRow.
 * Grade cells are percentages 0–100 from raw score / max points per assignment.
 */
export function transformCourseCollabResultRowsToCanvasCsv(
  inputRows: ReadonlyArray<CourseCollabResultExportRow | Record<string, unknown>>,
): string {
  const rows: CourseCollabResultExportRow[] = []
  for (const raw of inputRows) {
    const normalized = normalizeCourseCollabResultRow(raw as Record<string, unknown>)
    if (!normalized) continue
    if (!normalized.assignment_title.trim()) continue
    rows.push(normalized)
  }

  const assignments = collectUniqueAssignments(rows)

  const assignmentHeaders = assignments.map((a) =>
    formatAssignmentHeader(a.title, CANVAS_EXPORT_GRADE_PERCENT_MAX),
  )

  const headerCols = [...CANVAS_GRADEBOOK_FIXED_HEADERS, ...assignmentHeaders]

  const pointsPossibleCols = [
    CANVAS_POINTS_POSSIBLE_ROW_LABEL,
    "",
    "",
    "",
    "",
    ...assignments.map(() => String(CANVAS_EXPORT_GRADE_PERCENT_MAX)),
  ]

  const byStudent = new Map<string, CourseCollabResultExportRow[]>()
  for (const row of rows) {
    const sid = row.student_id.trim()
    const list = byStudent.get(sid)
    if (list) list.push(row)
    else byStudent.set(sid, [row])
  }

  const studentIds = Array.from(byStudent.keys()).sort((a, b) => {
    const ra = byStudent.get(a)![0]
    const rb = byStudent.get(b)![0]
    return ra.student_name.localeCompare(rb.student_name, undefined, { sensitivity: "base" })
  })

  const matrix: string[][] = [headerCols, pointsPossibleCols]

  for (const sid of studentIds) {
    const studentRows = byStudent.get(sid)!
    const first = studentRows[0]
    const dataCols = assignments.map((asg) => {
      let cell = ""
      for (let i = studentRows.length - 1; i >= 0; i--) {
        const r = studentRows[i]
        const t = r.assignment_title.trim() || "Assignment"
        const pts = assignmentPointsFromRow(r)
        if (t === asg.title && pts === asg.pointsPossible) {
          cell = rawScoreToCanvasExportPercentCell(r.score, asg.pointsPossible)
          break
        }
      }
      return cell
    })
    matrix.push([
      normalizeString(first.student_name),
      normalizeString(first.student_id),
      "",
      "",
      normalizeString(first.section),
      ...dataCols,
    ])
  }

  const clipped = clipCanvasGradebookMatrixToHeaderWidth(matrix)
  validateCanvasGradebookMatrix(clipped)

  return clipped.map((r) => r.map(escapeCsvField).join(",")).join("\r\n")
}

export type CanvasExportStudent = {
  /** Internal PK (students.id) — source of truth for DB attempts after resolution */
  internalId: string | number
  /** Canvas "ID" column — college/school student id (e.g. 37728) when set; pairs with SIS User ID when they differ */
  id: string | number
  /** School/college id when different from SIS (extra grade key, e.g. 37728 vs SIS 582408) */
  schoolStudentId?: string | null
  name: string
  /** Short section code for filters / UI (e.g. ELEG1301P01) */
  section: string
  /** Canvas "SIS User ID" column */
  sisUserId?: string | null
  /** Canvas "SIS Login ID" column */
  sisLoginId?: string | null
  /** Canvas gradebook column 5: full Section string (resolved in export API from DB + session-code map) */
  canvasSection?: string | null
}

export type CanvasExportAssignment = {
  id: string | number
  title: string
  /** Total possible points in DB for this quiz (denominator). Export shows (score/max)*100. */
  max_score: number
}

export type CanvasExportSubmission = {
  student_id: string | number
  assignment_id: string | number
  score: number | null | undefined
}

export type CanvasExportMissingScoreDisplay = "blank" | "zero"

export type GenerateCanvasExportInput = {
  students: CanvasExportStudent[]
  assignments: CanvasExportAssignment[]
  submissions: CanvasExportSubmission[]
  sectionFilter: string
  /** When no attempt exists for a student × assignment. Default `zero` → export `0` (0% on the 100 scale). */
  missingScoreDisplay?: CanvasExportMissingScoreDisplay
}

/**
 * Escape a single CSV field per RFC-style quoting (commas, quotes, newlines).
 * Canvas / Excel: names like `Abudu, Kolawole` must be one column — commas trigger quoting (`"Abudu, Kolawole"`).
 */
export function escapeCsvField(value: string): string {
  const s = value ?? ""
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function formatAssignmentHeader(title: string, maxPoints: number): string {
  const safeTitle = String(title ?? "").trim() || "Assignment"
  return `${safeTitle} (${Number(maxPoints)})`
}

function canvasExportStringCell(v: string | null | undefined): string {
  if (v === null || v === undefined) return ""
  return String(v)
}

/** Canvas column 5 must match the course Section string from Canvas (see `students.canvas_section`). */
function canvasSectionColumnValue(st: CanvasExportStudent): string {
  return canvasExportStringCell(st.canvasSection).trim()
}

/**
 * Build Canvas gradebook as a matrix: [header row, Points Possible row, ...student rows].
 * Column order: Student, ID, SIS User ID, SIS Login ID, Section, [one column per assignment]
 */
export function buildCanvasExportMatrix(input: GenerateCanvasExportInput): string[][] {
  const { students, assignments, submissions } = input
  const missingScoreDisplay: CanvasExportMissingScoreDisplay = input.missingScoreDisplay ?? "zero"

  /* Section scoping is applied in loadCanvasExportInput (SQL). Re-filtering here by
   * `student.section === sectionFilter` dropped everyone when section text was stale vs. catalog code
   * (e.g. after renames) while session_id filtering still included the roster. */
  const sortedStudents = [...students].sort((a, b) =>
    String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, { sensitivity: "base" }),
  )

  const getInternal = (s: CanvasExportStudent) =>
    s.internalId !== undefined && s.internalId !== null ? s.internalId : s.id

  const sortedAssignments = [...assignments].sort((a, b) =>
    String(a.title ?? "").localeCompare(String(b.title ?? ""), undefined, { sensitivity: "base" }),
  )

  /** Normalize ids so map lookups match (pg may return string/bigint; client uses number). */
  const submissionKey = (sid: string | number, aid: string | number): string => {
    const toNum = (v: string | number) => {
      if (typeof v === "number" && Number.isFinite(v)) return v
      if (typeof v === "bigint") return Number(v)
      const n = Number.parseInt(String(v), 10)
      return Number.isFinite(n) ? n : NaN
    }
    const ns = toNum(sid)
    const na = toNum(aid)
    if (Number.isFinite(ns) && Number.isFinite(na)) return `${ns}::${na}`
    return `${String(sid)}::${String(aid)}`
  }

  const toCanonStudentId = (sid: string | number | bigint | null | undefined): number | null => {
    if (sid === null || sid === undefined) return null
    if (typeof sid === "bigint") return Number(sid)
    if (typeof sid === "number" && Number.isFinite(sid)) return sid
    const n = Number.parseInt(String(sid), 10)
    return Number.isFinite(n) ? n : null
  }

  /** SIS User ID first (Canvas match), then school id, internal PK, Canvas ID — aligns with LMS linkage. */
  const submissionLookupKeys = (st: CanvasExportStudent, aid: string | number): string[] => {
    const keys: string[] = []
    const push = (sid: string | number | null | undefined) => {
      if (sid === null || sid === undefined) return
      if (typeof sid === "string" && sid.trim() === "") return
      const k = submissionKey(sid, aid)
      if (!keys.includes(k)) keys.push(k)
    }
    const sis = String(st.sisUserId ?? "").trim()
    if (sis) push(sis)
    const school = String(st.schoolStudentId ?? "").trim()
    if (school) push(school)
    push(getInternal(st))
    push(st.id)
    return keys
  }

  const submissionAliasesForStudent = (st: CanvasExportStudent, canon: number): (string | number)[] => {
    const out: (string | number)[] = [canon]
    const add = (v: string | number | null | undefined) => {
      if (v === null || v === undefined) return
      const s = typeof v === "string" ? v.trim() : v
      if (s === "") return
      if (!out.some((x) => String(x) === String(s))) out.push(s as string | number)
    }
    add(st.sisUserId)
    add(st.schoolStudentId)
    add(getInternal(st))
    add(st.id)
    return out
  }

  const byCanon = new Map<number, CanvasExportSubmission[]>()
  for (const sub of submissions) {
    const c = toCanonStudentId(sub.student_id as string | number)
    if (c === null) continue
    const arr = byCanon.get(c) ?? []
    arr.push(sub)
    byCanon.set(c, arr)
  }

  const submissionMap = new Map<string, number | null | undefined>()
  for (const st of students) {
    const canon = toCanonStudentId(getInternal(st) as string | number)
    if (canon === null) continue
    const subs = byCanon.get(canon)
    if (!subs?.length) continue
    const aliases = submissionAliasesForStudent(st, canon)
    for (const sub of subs) {
      const aid = sub.assignment_id
      const sc = sub.score
      for (const alias of aliases) {
        submissionMap.set(submissionKey(alias, aid), sc)
      }
    }
  }

  const assignmentHeaders = sortedAssignments.map((a) =>
    formatAssignmentHeader(a.title, CANVAS_EXPORT_GRADE_PERCENT_MAX),
  )

  const headerCols = [...CANVAS_GRADEBOOK_FIXED_HEADERS, ...assignmentHeaders]

  const pointsPossibleCols = [
    CANVAS_POINTS_POSSIBLE_ROW_LABEL,
    "",
    "",
    "",
    "",
    ...sortedAssignments.map(() => String(CANVAS_EXPORT_GRADE_PERCENT_MAX)),
  ]

  const rows: string[][] = [headerCols, pointsPossibleCols]

  for (const st of sortedStudents) {
    const dataCols = sortedAssignments.map((asg) => {
      let sc: number | null | undefined
      for (const k of submissionLookupKeys(st, asg.id)) {
        if (submissionMap.has(k)) {
          sc = submissionMap.get(k)
          break
        }
      }
      if (sc === undefined) {
        return missingScoreDisplay === "zero" ? "0" : ""
      }
      return rawScoreToCanvasExportPercentCell(sc, asg.max_score)
    })
    rows.push([
      String(st.name ?? ""),
      String(st.id ?? ""),
      canvasExportStringCell(st.sisUserId),
      canvasExportStringCell(st.sisLoginId),
      canvasSectionColumnValue(st),
      ...dataCols,
    ])
  }

  const expectedLen = headerCols.length
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].length !== expectedLen) {
      throw new Error(
        `[canvas export] Row ${i} has ${rows[i].length} columns, expected ${expectedLen}`,
      )
    }
  }

  const clipped = clipCanvasGradebookMatrixToHeaderWidth(rows)
  validateCanvasGradebookMatrix(clipped)
  return clipped
}

/** Serialize a Canvas gradebook matrix to CSV (RFC-style quoting). */
export function canvasMatrixToCsv(matrix: string[][]): string {
  const clipped = clipCanvasGradebookMatrixToHeaderWidth(matrix)
  return clipped.map((r) => r.map(escapeCsvField).join(",")).join("\r\n")
}

/**
 * Build Canvas-compatible CSV: header row, Points Possible row, then student rows.
 */
export function generateCanvasExport(input: GenerateCanvasExportInput): string {
  return canvasMatrixToCsv(buildCanvasExportMatrix(input))
}

export function validateCanvasCsvRows(csvString: string): { ok: true } | { ok: false; error: string } {
  const lines = csvString.split(/\r?\n/).filter((l) => l.length > 0)
  if (lines.length === 0) return { ok: false, error: "Empty CSV" }
  const firstCommaCount = lines[0].split(",").length
  for (let i = 1; i < lines.length; i++) {
    const parsedLen = parseCsvLineForColumnCount(lines[i])
    if (parsedLen !== firstCommaCount) {
      return { ok: false, error: `Row ${i + 1} column count ${parsedLen} !== ${firstCommaCount}` }
    }
  }
  return { ok: true }
}

/** Minimal parser count for validation (handles quoted fields). */
function parseCsvLineForColumnCount(line: string): number {
  let count = 0
  let i = 0
  while (i < line.length) {
    if (line[i] === '"') {
      i++
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          i += 2
          continue
        }
        if (line[i] === '"') {
          i++
          break
        }
        i++
      }
    } else {
      while (i < line.length && line[i] !== ",") i++
    }
    count++
    if (i < line.length && line[i] === ",") i++
  }
  return count
}

/** Browser download — call only on client. */
export function downloadCanvasCSV(csvString: string, filename = "canvas_gradebook.csv"): void {
  if (typeof window === "undefined" || typeof document === "undefined") return
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
