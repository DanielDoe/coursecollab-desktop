import { instructorApiFetch, buildInstructorAuthorizedApiHeaders } from "@/lib/instructor-api-headers"
import { readJson } from "@/lib/data/fetch-json"
import type { CourseDigitalNote } from "@/lib/course-digital-notes"

export type FacultyAnnouncement = {
  id: number
  title: string
  content: string
  pinned: boolean
  views_count: number
  reactions_count: number
  created_at: string
  updated_at: string
  category?: string
  student_content_locked?: boolean
  [key: string]: unknown
}

export async function fetchFacultyAnnouncements(
  instructorId: string,
  courseId?: number | string | null,
): Promise<FacultyAnnouncement[]> {
  const courseQuery =
    courseId != null && String(courseId).trim() !== ""
      ? `&courseId=${encodeURIComponent(String(courseId))}`
      : ""
  const res = await instructorApiFetch(`/api/announcements?instructorId=${encodeURIComponent(instructorId)}${courseQuery}`)
  const data = await readJson<{ announcements?: FacultyAnnouncement[] }>(res)
  return (data.announcements ?? []).map((ann) => ({
    ...ann,
    views_count: Number(ann.views_count ?? 0),
    reactions_count: Number(ann.reactions_count ?? 0),
    category: ann.category || "General",
  }))
}

function instructorHeaders() {
  return buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" })
}

export async function fetchFacultyCourseNotes(): Promise<CourseDigitalNote[]> {
  const res = await instructorApiFetch("/api/instructor/course-notes", { headers: instructorHeaders() })
  const data = await readJson<{ notes?: CourseDigitalNote[] }>(res)
  return data.notes ?? []
}

export async function fetchFacultyCourseNotesDeletedCount(): Promise<number> {
  const res = await instructorApiFetch("/api/instructor/course-notes/deleted", { headers: instructorHeaders() })
  const data = await readJson<{ notes?: unknown[] }>(res)
  return data.notes?.length ?? 0
}

export async function fetchFacultyQuestionBank(): Promise<unknown[]> {
  const res = await instructorApiFetch("/api/instructor/question-bank?view=list")
  const data = await readJson<{ questions?: unknown[] }>(res)
  return data.questions ?? []
}

export async function fetchFacultyQuestionBankTopics(): Promise<unknown[]> {
  const res = await instructorApiFetch("/api/instructor/question-bank/topics")
  const data = await readJson<{ topics?: unknown[] }>(res)
  return data.topics ?? []
}

export async function fetchFacultyQuestionBankDeleted(): Promise<unknown[]> {
  const res = await instructorApiFetch("/api/instructor/question-bank/deleted")
  const data = await readJson<{ questions?: unknown[] }>(res)
  return data.questions ?? []
}
