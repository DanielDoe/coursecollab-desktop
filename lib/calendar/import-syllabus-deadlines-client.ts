import { getStudentAuthHeaders } from "@/lib/auth"

export async function importSyllabusDeadlinesToCalendar(input: {
  studentId: string
  importAll?: boolean
  deadlines?: Array<{ title?: string; dateText?: string; key?: string }>
}): Promise<{
  success: boolean
  imported?: number
  skipped?: number
  message?: string
  error?: string
}> {
  const response = await fetch("/api/calendar/import-syllabus-deadlines", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getStudentAuthHeaders(),
    },
    body: JSON.stringify(input),
  })
  const data = await response.json()
  if (!response.ok) {
    return { success: false, error: data.error || "Import failed" }
  }
  return data
}
