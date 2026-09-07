import type { CanvasExportStudent, GenerateCanvasExportInput } from "@/lib/canvas-gradebook-export"

/** Split one CSV line respecting double-quoted fields (Canvas roster export). */
export function parseCanvasRosterCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ",") {
      out.push(cur)
      cur = ""
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out
}

function normHeaderCell(h: string): string {
  return h.trim().toLowerCase()
}

function normAllowlistId(raw: unknown): string {
  if (raw === null || raw === undefined) return ""
  const s = String(raw).trim()
  if (s === "") return ""
  return s
}

export type CanvasRosterRowMeta = {
  section: string
  canvasId: string
  sisUserId: string
  sisLoginId: string
}

export type CanvasRosterAllowlist = {
  sisLogins: Set<string>
  sisUserIds: Set<string>
  canvasIds: Set<string>
  /** Section + ID columns from pasted Canvas gradebook rows, keyed by any roster identifier. */
  rowMetaByKey: Map<string, CanvasRosterRowMeta>
}

export type ParseCanvasRosterAllowlistResult =
  | { ok: true; allowlist: CanvasRosterAllowlist }
  | { ok: false; error: string }

function findHeaderColumns(
  headers: string[],
): { iCanvasId: number; iSisUser: number; iSisLogin: number; iSection: number } | null {
  const norm = headers.map(normHeaderCell)
  const iSisUser = norm.indexOf("sis user id")
  const iSisLogin = norm.indexOf("sis login id")
  const iCanvasId = norm.indexOf("id")
  const iSection = norm.indexOf("section")
  if (iCanvasId < 0 || iSisUser < 0 || iSisLogin < 0) return null
  if (iCanvasId === iSisUser || iCanvasId === iSisLogin || iSisUser === iSisLogin) return null
  return { iCanvasId, iSisUser, iSisLogin, iSection }
}

function indexRosterRowMeta(meta: CanvasRosterRowMeta, allowlist: CanvasRosterAllowlist): void {
  const add = (raw: string) => {
    const id = normAllowlistId(raw)
    if (!id) return
    if (!allowlist.rowMetaByKey.has(id)) allowlist.rowMetaByKey.set(id, meta)
  }
  add(meta.canvasId)
  add(meta.sisUserId)
  if (meta.sisLoginId) add(meta.sisLoginId)
}

function rosterMetaForStudent(
  st: CanvasExportStudent,
  allowlist: CanvasRosterAllowlist,
): CanvasRosterRowMeta | undefined {
  const login = String(st.sisLoginId ?? "")
    .trim()
    .toLowerCase()
  if (login && allowlist.rowMetaByKey.has(login)) return allowlist.rowMetaByKey.get(login)

  for (const raw of [st.sisUserId, st.id, st.schoolStudentId]) {
    const id = normAllowlistId(raw)
    if (!id) continue
    const meta = allowlist.rowMetaByKey.get(id)
    if (meta) return meta
  }
  return undefined
}

/**
 * Parse a Canvas “Student, ID, SIS User ID, SIS Login ID, Section” export (or compatible).
 * Rows are allowlisted by any of those three identifiers.
 */
export function parseCanvasRosterAllowlistCsv(csv: string): ParseCanvasRosterAllowlistResult {
  const text = csv.replace(/^\uFEFF/, "")
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd())
  let headerLineIdx = -1
  let headerCells: string[] | null = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim()
    if (line === "") continue
    headerLineIdx = i
    headerCells = parseCanvasRosterCsvLine(lines[i]!)
    break
  }
  if (headerLineIdx < 0 || !headerCells?.length) {
    return { ok: false, error: "Roster CSV is empty." }
  }

  const cols = findHeaderColumns(headerCells)
  if (!cols) {
    return {
      ok: false,
      error:
        'Roster CSV must include header columns: "ID", "SIS User ID", and "SIS Login ID" (Canvas gradebook export format).',
    }
  }

  const allowlist: CanvasRosterAllowlist = {
    sisLogins: new Set(),
    sisUserIds: new Set(),
    canvasIds: new Set(),
    rowMetaByKey: new Map(),
  }

  for (let r = headerLineIdx + 1; r < lines.length; r++) {
    const rawLine = lines[r]!
    if (rawLine.trim() === "") continue
    const cells = parseCanvasRosterCsvLine(rawLine)
    const canvasId = normAllowlistId(cells[cols.iCanvasId])
    const sisUser = normAllowlistId(cells[cols.iSisUser])
    const login = String(cells[cols.iSisLogin] ?? "")
      .trim()
      .toLowerCase()
    const section =
      cols.iSection >= 0 ? String(cells[cols.iSection] ?? "").trim() : ""
    if (canvasId) allowlist.canvasIds.add(canvasId)
    if (sisUser) allowlist.sisUserIds.add(sisUser)
    if (login) allowlist.sisLogins.add(login)
    indexRosterRowMeta(
      { section, canvasId, sisUserId: sisUser, sisLoginId: login },
      allowlist,
    )
  }

  const hasAny =
    allowlist.canvasIds.size > 0 || allowlist.sisUserIds.size > 0 || allowlist.sisLogins.size > 0
  if (!hasAny) {
    return {
      ok: false,
      error: "No roster rows found under the header. Paste the full Canvas roster including data rows.",
    }
  }

  return { ok: true, allowlist }
}

export function isCanvasRosterAllowlistEmpty(a: CanvasRosterAllowlist): boolean {
  return a.canvasIds.size === 0 && a.sisUserIds.size === 0 && a.sisLogins.size === 0
}

export function canvasExportStudentMatchesAllowlist(st: CanvasExportStudent, a: CanvasRosterAllowlist): boolean {
  const login = String(st.sisLoginId ?? "")
    .trim()
    .toLowerCase()
  if (login && a.sisLogins.has(login)) return true

  for (const raw of [st.sisUserId, st.id, st.schoolStudentId]) {
    const id = normAllowlistId(raw)
    if (!id) continue
    if (a.sisUserIds.has(id) || a.canvasIds.has(id)) return true
  }
  return false
}

/** Keep only students (and their submissions) present on the pasted Canvas roster. */
export function filterCanvasExportInputByAllowlist(
  input: GenerateCanvasExportInput,
  allowlist: CanvasRosterAllowlist | null,
): GenerateCanvasExportInput {
  if (!allowlist || isCanvasRosterAllowlistEmpty(allowlist)) return input

  const students = input.students
    .filter((s) => canvasExportStudentMatchesAllowlist(s, allowlist))
    .map((s) => applyCanvasRosterRowMeta(s, allowlist))
  const allowedInternal = new Set(
    students.map((s) => Number(s.internalId)).filter((n) => Number.isFinite(n)),
  )
  const submissions = input.submissions.filter((sub) => {
    const sid = Number(sub.student_id)
    return Number.isFinite(sid) && allowedInternal.has(sid)
  })

  return { ...input, students, submissions }
}

/** Overlay Canvas roster ID / login / section from a pasted gradebook CSV onto export rows. */
export function applyCanvasRosterRowMeta(
  st: CanvasExportStudent,
  allowlist: CanvasRosterAllowlist,
): CanvasExportStudent {
  const meta = rosterMetaForStudent(st, allowlist)
  if (!meta) return st
  return {
    ...st,
    id: meta.canvasId || st.id,
    sisUserId: meta.sisUserId || st.sisUserId,
    sisLoginId: meta.sisLoginId || st.sisLoginId,
    canvasSection: meta.section || st.canvasSection,
  }
}

/** Apply roster Section/ID columns to all students when a gradebook CSV was pasted. */
export function applyCanvasRosterMetadataToExportInput(
  input: GenerateCanvasExportInput,
  allowlist: CanvasRosterAllowlist | null,
): GenerateCanvasExportInput {
  if (!allowlist || allowlist.rowMetaByKey.size === 0) return input
  return {
    ...input,
    students: input.students.map((s) => applyCanvasRosterRowMeta(s, allowlist)),
  }
}
