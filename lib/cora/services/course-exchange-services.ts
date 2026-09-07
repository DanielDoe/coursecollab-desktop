import {
  approveCourseExchangeRequest,
  createCourseExchangeRequest,
  executeApprovedCourseCopy,
  listDiscoverableCourses,
  listReceivedExchangeRequests,
  listSentExchangeRequests,
  rejectCourseExchangeRequest,
  updateCourseSharingSettings,
} from "@/lib/course-exchange/service"
import { COURSE_EXCHANGE_MODULE_LABELS } from "@/lib/course-exchange/modules"
import type { CourseExchangeModule } from "@/lib/course-exchange/types"
import { normalizeModuleList } from "@/lib/course-exchange/modules"

export function formatDiscoverableCoursesMarkdown(
  courses: Awaited<ReturnType<typeof listDiscoverableCourses>>,
  heading = "**Discoverable courses**",
): string {
  if (courses.length === 0) return `${heading}\n\nNo shareable courses found.`
  const lines = courses.map(
    (c) =>
      `- **${c.courseCode}** ${c.courseTitle} — ${c.instructorName}${c.instructorInstitution ? ` (${c.instructorInstitution})` : ""} [courseId=${c.courseId}]`,
  )
  return [heading, "", ...lines].join("\n")
}

export function formatExchangeRequestsMarkdown(
  requests: Array<{ id: number; status: string; courseCode?: string; requesterName?: string; creatorName?: string; purpose?: string | null }>,
  heading: string,
): string {
  if (requests.length === 0) return `${heading}\n\nNone.`
  const lines = requests.map((r) => {
    const who = r.requesterName ?? r.creatorName ?? "—"
    const purpose = r.purpose ? ` — ${r.purpose}` : ""
    return `- #${r.id} **${r.courseCode ?? "course"}** · ${r.status} · ${who}${purpose}`
  })
  return [heading, "", ...lines].join("\n")
}

export async function coraListDiscoverableCourses(input: {
  instructorId: number
  query?: string | null
}) {
  return listDiscoverableCourses({
    requesterInstructorId: input.instructorId,
    query: input.query,
    limit: 20,
  })
}

export async function coraCreateExchangeRequest(input: {
  requesterInstructorId: number
  sourceCourseId: number
  purpose?: string | null
  requestedModules?: CourseExchangeModule[]
}) {
  return createCourseExchangeRequest({
    requesterInstructorId: input.requesterInstructorId,
    sourceCourseId: input.sourceCourseId,
    purpose: input.purpose,
    requestedModules: input.requestedModules,
  })
}

export async function coraDecideExchangeRequest(input: {
  instructorId: number
  requestId: number
  decision: "approve" | "reject"
  approvedModules?: CourseExchangeModule[]
  reason?: string | null
}) {
  if (input.decision === "reject") {
    return rejectCourseExchangeRequest({
      instructorId: input.instructorId,
      requestId: input.requestId,
      reason: input.reason,
    })
  }
  return approveCourseExchangeRequest({
    instructorId: input.instructorId,
    requestId: input.requestId,
    approvedModules: normalizeModuleList(input.approvedModules),
  })
}

export async function coraExecuteExchangeCopy(input: {
  requesterInstructorId: number
  requestId: number
  destinationCourseId: number
  destinationSessionId?: number | null
}) {
  return executeApprovedCourseCopy(input)
}

export async function coraUpdateSharingMode(input: {
  instructorId: number
  courseId: number
  sharingMode: "off" | "request_only"
}) {
  return updateCourseSharingSettings({
    instructorId: input.instructorId,
    courseId: input.courseId,
    sharingMode: input.sharingMode,
  })
}

export function formatModuleList(modules: CourseExchangeModule[]): string {
  return modules.map((m) => COURSE_EXCHANGE_MODULE_LABELS[m]).join(", ")
}

export async function coraListReceivedRequests(instructorId: number) {
  return listReceivedExchangeRequests(instructorId, "PENDING")
}

export async function coraListSentRequests(instructorId: number) {
  return listSentExchangeRequests(instructorId)
}
