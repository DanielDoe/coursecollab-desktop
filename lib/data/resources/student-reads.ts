import { getStudentAuthHeaders, studentApiFetch } from "@/lib/auth"
import { readJson } from "@/lib/data/fetch-json"
import type { CourseDigitalNote } from "@/lib/course-digital-notes"
import type { FlashcardDeck } from "@/lib/flashcards-types"
import type { StudentDigitalNote } from "@/lib/student-digital-notes"

export type StudentAnnouncement = {
  id: number
  title: string
  content: string
  author_name?: string
  pinned: boolean
  views_count: number
  reactions_count: number
  reactions_breakdown?: Record<string, number>
  created_at: string
  updated_at: string
  attachments?: Array<{ name: string; url: string; type: string }>
  priority?: "urgent" | "important" | "normal"
  category?: string
  comments_count?: number
  is_read?: boolean
  viewed_by_me?: boolean
  my_reaction?: string | null
  student_content_locked?: boolean
  attachment_count?: number
}

export type StudentLectureRow = {
  id: number
  week: number
  title: string
  session: string
  description: string
  materials_url: string | null
  created_at: string
  status?: string
  [key: string]: unknown
}

export async function fetchStudentNotes(): Promise<StudentDigitalNote[]> {
  const res = await studentApiFetch("/api/student/digital-notes", {
    headers: getStudentAuthHeaders(),
  })
  const data = await readJson<{ notes?: StudentDigitalNote[] }>(res)
  return data.notes ?? []
}

export async function fetchStudentCourseNotes(): Promise<CourseDigitalNote[]> {
  const res = await studentApiFetch("/api/student/course-notes", {
    headers: getStudentAuthHeaders(),
  })
  const data = await readJson<{ notes?: CourseDigitalNote[] }>(res)
  return data.notes ?? []
}

export async function fetchStudentFlashcards(practiceHub = false): Promise<{
  courseDecks: FlashcardDeck[]
  myDecks: FlashcardDeck[]
}> {
  const qs = practiceHub ? "?practiceHub=true" : ""
  const res = await studentApiFetch(`/api/student/flashcards/decks${qs}`, {
    headers: getStudentAuthHeaders(),
  })
  const data = await readJson<{ courseDecks?: FlashcardDeck[]; myDecks?: FlashcardDeck[] }>(res)
  return {
    courseDecks: data.courseDecks ?? [],
    myDecks: data.myDecks ?? [],
  }
}

export function normalizeStudentAnnouncement(ann: StudentAnnouncement): StudentAnnouncement {
  return {
    ...ann,
    attachments: Array.isArray(ann.attachments) ? ann.attachments : [],
    views_count: Number(ann.views_count ?? 0),
    reactions_count: Number(ann.reactions_count ?? 0),
    category: ann.category || "General",
    comments_count: Number(ann.comments_count ?? 0),
    is_read: ann.viewed_by_me,
  }
}

export async function fetchStudentAnnouncements(studentId: string): Promise<StudentAnnouncement[]> {
  const res = await studentApiFetch(`/api/announcements?studentId=${encodeURIComponent(studentId)}`)
  const data = await readJson<{ announcements?: StudentAnnouncement[] }>(res)
  return (data.announcements ?? []).map(normalizeStudentAnnouncement)
}

export async function fetchStudentLectures(studentId: string): Promise<StudentLectureRow[]> {
  const res = await studentApiFetch(
    `/api/student/lectures?studentId=${encodeURIComponent(studentId)}`,
    { headers: getStudentAuthHeaders() },
  )
  const data = await readJson<{ lectures?: StudentLectureRow[] }>(res)
  return data.lectures ?? []
}

export async function fetchStudentLectureBookmarks(studentId: string): Promise<number[]> {
  const res = await studentApiFetch(
    `/api/lectures/bookmarks?studentId=${encodeURIComponent(studentId)}`,
    { headers: getStudentAuthHeaders() },
  )
  const data = await readJson<Array<{ lecture_id: number }> | { bookmarks?: Array<{ lecture_id: number }> }>(res)
  const rows = Array.isArray(data) ? data : data.bookmarks ?? []
  return rows.map((row) => row.lecture_id)
}

export async function fetchStudentLectureReminders(studentId: string): Promise<number[]> {
  const res = await studentApiFetch(
    `/api/lectures/reminders?studentId=${encodeURIComponent(studentId)}`,
    { headers: getStudentAuthHeaders() },
  )
  const data = await readJson<Array<{ lecture_id: number }> | { reminders?: Array<{ lecture_id: number }> }>(res)
  const rows = Array.isArray(data) ? data : data.reminders ?? []
  return rows.map((row) => row.lecture_id)
}
