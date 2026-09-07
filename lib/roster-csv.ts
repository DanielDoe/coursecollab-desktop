import { extractZipText, listZipEntries, zipSourceFromBlob } from "@/lib/imscc/zip-source"
import type { RosterImportRow } from "@/lib/roster-import-upsert"

export type RosterColumnMapping = {
  student_id: string
  full_name: string
  sis_user_id: string
  sis_login_id: string
  canvas_section: string
  email: string
}

export const EMPTY_ROSTER_COLUMN_MAPPING: RosterColumnMapping = {
  student_id: "",
  full_name: "",
  sis_user_id: "",
  sis_login_id: "",
  canvas_section: "",
  email: "",
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const raw = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const records = splitCsvRecords(raw)
  if (records.length === 0) return { headers: [], rows: [] }
  const headers = records[0].map((h) => h.trim())
  const rows = records.slice(1).map((values) => {
    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      row[header] = (values[index] ?? "").trim()
    })
    return row
  }).filter((row) => Object.values(row).some((v) => v.length > 0))
  return { headers, rows }
}

function splitCsvRecords(text: string): string[][] {
  const records: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ",") {
      row.push(field)
      field = ""
      continue
    }
    if (ch === "\n") {
      row.push(field)
      if (row.some((c) => c.trim())) records.push(row)
      row = []
      field = ""
      continue
    }
    field += ch
  }
  if (inQuotes || field.length > 0 || row.length > 0) {
    row.push(field)
    if (row.some((c) => c.trim())) records.push(row)
  }
  return records
}

export function autoMapRosterHeaders(headers: string[]): RosterColumnMapping {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ")
  const byNorm = new Map(headers.map((h) => [norm(h), h]))
  const pickExact = (...candidates: string[]) => {
    for (const c of candidates) {
      const h = byNorm.get(norm(c))
      if (h) return h
    }
    return ""
  }
  const pickIncludes = (...needles: string[]) => {
    for (const needle of needles) {
      for (const [lk, h] of byNorm) {
        if (lk.includes(needle)) return h
      }
    }
    return ""
  }
  return {
    student_id:
      pickExact("id", "student id", "canvas id", "canvas user id", "user id") ||
      pickIncludes("canvas user id", "student id", "canvas id", "user id"),
    full_name:
      pickExact("student", "students", "full name", "name", "student name") ||
      pickIncludes("full name", "student name", "students"),
    sis_user_id: pickExact("sis user id", "sis id") || pickIncludes("sis user", "sis id"),
    sis_login_id: pickExact("sis login id", "sis login", "login id") || pickIncludes("sis login", "login id"),
    canvas_section: pickExact("section") || pickIncludes("section"),
    email: pickExact("email", "email address") || pickIncludes("email"),
  }
}

export function mergeRosterMappings(
  heuristic: RosterColumnMapping,
  cora: Partial<RosterColumnMapping> | null | undefined,
): RosterColumnMapping {
  const next = { ...heuristic }
  if (!cora) return next
  for (const key of Object.keys(next) as (keyof RosterColumnMapping)[]) {
    const value = String(cora[key] ?? "").trim()
    if (value) next[key] = value
  }
  return next
}

export function emailFromCell(value: string): string | null {
  const m = String(value ?? "").match(EMAIL_RE)
  return m ? m[0].toLowerCase() : null
}

export function loginFromEmail(email: string | null | undefined): string | null {
  if (!email || !email.includes("@")) return null
  const local = email.split("@")[0]?.trim()
  return local || null
}

export function applyRosterColumnMapping(
  rows: Record<string, string>[],
  mapping: RosterColumnMapping,
): RosterImportRow[] {
  const out: RosterImportRow[] = []
  for (const row of rows) {
    const nameRaw = mapping.full_name ? String(row[mapping.full_name] ?? "").trim() : ""
    const emailRaw = mapping.email ? String(row[mapping.email] ?? "").trim() : ""
    const email = emailFromCell(emailRaw) || emailFromCell(nameRaw)
    const sidRaw = mapping.student_id ? String(row[mapping.student_id] ?? "").trim() : ""
    const studentId = sidRaw || email || loginFromEmail(email) || ""
    const fullName = nameRaw.replace(EMAIL_RE, "").replace(/\s+/g, " ").trim()
    if (!fullName || !studentId) continue
    out.push({
      student_id: studentId,
      student_id_inferred: !sidRaw,
      full_name: fullName,
      sis_user_id: mapping.sis_user_id ? String(row[mapping.sis_user_id] ?? "").trim() || null : null,
      sis_login_id:
        (mapping.sis_login_id ? String(row[mapping.sis_login_id] ?? "").trim() : "") ||
        loginFromEmail(email) ||
        null,
      email,
      canvas_section: mapping.canvas_section ? String(row[mapping.canvas_section] ?? "").trim() || null : null,
    })
  }
  return out
}

export function rosterMappingComplete(
  mapping: RosterColumnMapping,
  rows: Record<string, string>[] = [],
): boolean {
  if (!mapping.full_name) return false
  if (mapping.student_id || mapping.email) return true
  return rows.some((row) => Boolean(emailFromCell(row[mapping.full_name] || "")))
}

/** If Canvas stacked name+email in one column, treat that column as Email too. */
export function refineRosterMappingFromRows(
  mapping: RosterColumnMapping,
  rows: Record<string, string>[],
): RosterColumnMapping {
  const next = { ...mapping }
  if (!next.email && next.full_name) {
    const nameCol = next.full_name
    if (rows.some((row) => Boolean(emailFromCell(row[nameCol] || "")))) {
      next.email = nameCol
    }
  }
  return next
}

export async function readRosterTableFromFile(file: File): Promise<{
  headers: string[]
  rows: Record<string, string>[]
  sourceName: string
}> {
  const name = file.name.toLowerCase()
  let text: string
  let sourceName = file.name
  if (name.endsWith(".zip") || file.type === "application/zip") {
    const extracted = await extractFirstCsvFromZip(file)
    text = extracted.text
    sourceName = extracted.sourceName
  } else {
    text = await file.text()
  }
  const parsed = parseCsv(text)
  return { ...parsed, sourceName }
}

async function extractFirstCsvFromZip(file: File): Promise<{ text: string; sourceName: string }> {
  const source = zipSourceFromBlob(file)
  const entries = await listZipEntries(source)
  const csvs = entries.filter((e) => !e.name.endsWith("/") && e.name.toLowerCase().endsWith(".csv"))
  if (csvs.length === 0) {
    throw new Error("No CSV file was found inside that zip. Export from Canvas Course Analytics → Students.")
  }
  const preferred =
    csvs.find((e) => /student/i.test(e.name)) ||
    csvs.find((e) => /analytic/i.test(e.name)) ||
    csvs[0]
  const text = await extractZipText(source, preferred, 8_000_000)
  return { text, sourceName: preferred.name.split("/").pop() || preferred.name }
}
