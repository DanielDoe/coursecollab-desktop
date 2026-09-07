import { type NextRequest } from "next/server"
import { instructorCanAccessCourse } from "@/lib/instructor-actor-scope"

/** Prefer `x-instructor-id`, then `instructorId` query (web list still query-only). */
export function instructorIdFromRequest(request: NextRequest): number | null {
  const header = request.headers.get("x-instructor-id")?.trim()
  const query = new URL(request.url).searchParams.get("instructorId")?.trim()
  const raw = header || query || ""
  if (!raw) return null
  const id = Number(raw)
  return Number.isFinite(id) && id > 0 ? id : null
}

/** Prefer `x-student-id`, then `studentId` query. */
export function studentIdParamFromRequest(request: NextRequest): string | null {
  const header = request.headers.get("x-student-id")?.trim()
  const query = new URL(request.url).searchParams.get("studentId")?.trim()
  const raw = header || query || ""
  return raw || null
}

export function instructorIdsDisagree(request: NextRequest): boolean {
  const header = request.headers.get("x-instructor-id")?.trim()
  const query = new URL(request.url).searchParams.get("instructorId")?.trim()
  if (!header || !query) return false
  return header !== query
}

export async function instructorCanAccessAnnouncement(
  instructorId: number,
  announcement: { author_id?: unknown; course_id?: unknown },
): Promise<boolean> {
  const authorId = Number(announcement.author_id)
  if (Number.isFinite(authorId) && authorId === instructorId) return true
  const courseId = Number(announcement.course_id)
  if (!Number.isFinite(courseId) || courseId <= 0) return false
  return instructorCanAccessCourse(instructorId, courseId)
}
