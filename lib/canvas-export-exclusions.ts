import type { GenerateCanvasExportInput } from "@/lib/canvas-gradebook-export"

export type CanvasExportRosterStudent = {
  internalId: number
  name: string
  studentId: string
  sisUserId: string
  betaUser: boolean
  suggestedExclude: boolean
  excludeReason?: string
}

/** Test / instructor dummy rows to hide from final Canvas uploads by default. */
export function isSuggestedCanvasExportExclude(row: {
  beta_user?: boolean | null
  student_id?: string | null
  full_name?: string | null
  section?: string | null
}): { exclude: boolean; reason?: string } {
  if (row.beta_user === true) {
    return { exclude: true, reason: "Beta tester" }
  }
  if (String(row.section ?? "").trim().toUpperCase() === "BETA") {
    return { exclude: true, reason: "BETA section" }
  }
  const sid = String(row.student_id ?? "").trim().toUpperCase()
  if (/^(BETA|DEMO|TEST)/.test(sid)) {
    return { exclude: true, reason: "Test student ID" }
  }
  const name = String(row.full_name ?? "").trim().toLowerCase()
  if (name.includes("beta tester")) {
    return { exclude: true, reason: "Beta tester" }
  }
  if (name === "daniel doe") {
    return { exclude: true, reason: "Instructor test account" }
  }
  return { exclude: false }
}

export function parseExcludeStudentIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  const out: number[] = []
  for (const v of raw) {
    const n = Number(v)
    if (Number.isFinite(n) && n > 0 && !out.includes(n)) out.push(n)
  }
  return out
}

export function filterCanvasExportInputByExcludedStudents(
  input: GenerateCanvasExportInput,
  excludeStudentIds: number[],
): GenerateCanvasExportInput {
  const excluded = new Set(parseExcludeStudentIds(excludeStudentIds))
  if (excluded.size === 0) return input

  const students = input.students.filter((s) => !excluded.has(Number(s.internalId)))
  const allowed = new Set(students.map((s) => Number(s.internalId)).filter(Number.isFinite))
  const submissions = input.submissions.filter((sub) => {
    const sid = Number(sub.student_id)
    return Number.isFinite(sid) && allowed.has(sid)
  })

  return { ...input, students, submissions }
}
