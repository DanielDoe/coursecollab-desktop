import type { NextRequest } from "next/server"

/** Numeric `students.id` from query or header (matches sessionStorage studentDatabaseId). */
export function getStudentDatabaseIdFromRequest(request: NextRequest): number | null {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("studentDatabaseId")
  const h = request.headers.get("x-student-database-id")
  const raw = q || h
  if (raw == null || raw === "") return null
  const n = parseInt(String(raw), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}
