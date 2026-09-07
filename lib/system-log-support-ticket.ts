import { randomUUID } from "crypto"
import { logSystemEvent, type SystemLogInput } from "@/lib/system-log"
import type { LogSeverity } from "@/lib/system-log-constants"

export type SupportTicketKind = "ticket" | "bug" | "feature"

export function supportTicketFingerprint(ticketId: string): string {
  return `student-support-ticket:${ticketId}`
}

function priorityToSeverity(priority: string): LogSeverity {
  switch (priority) {
    case "urgent":
      return "critical"
    case "high":
      return "error"
    case "low":
      return "info"
    default:
      return "warning"
  }
}

function kindFromCategory(category: string): SupportTicketKind {
  if (category === "bug") return "bug"
  if (category === "feature") return "feature"
  return "ticket"
}

export type SupportTicketLogInput = {
  ticketId?: string
  studentDbId: number | null
  studentName?: string | null
  courseId?: number | null
  courseName?: string | null
  subject: string
  description: string
  category: string
  priority: string
  audience?: "student" | "guest" | "instructor"
  instructorId?: number | null
  instructorName?: string | null
  moduleId?: string | null
  moduleName?: string | null
  attachments?: Array<{ url: string; name?: string; mime?: string; size?: number }>
}

/** Route student tickets/bugs/features into admin System Logs (Needs attention). */
export async function logSupportTicketToSystemLog(
  input: SupportTicketLogInput,
): Promise<{ ticketId: string; logId: string | null }> {
  const ticketId = input.ticketId ?? randomUUID()
  const kind = kindFromCategory(input.category)
  const severity = priorityToSeverity(input.priority)
  const who =
    input.audience === "instructor"
      ? "Instructor"
      : input.audience === "guest"
        ? "Guest"
        : "Student"
  const title =
    kind === "bug"
      ? `${who} bug report: ${input.subject}`
      : kind === "feature"
        ? `${who} feature request: ${input.subject}`
        : `${who} support ticket: ${input.subject}`

  const payload: SystemLogInput = {
    severity,
    category: kind === "bug" ? "frontend" : "backend",
    title,
    description: input.description,
    errorMessage: input.subject,
    moduleName: input.moduleName?.trim() || "Help & Support",
    featureName: input.moduleName?.trim() || "Help & Support",
    userId:
      input.audience === "instructor" && input.instructorId != null
        ? String(input.instructorId)
        : input.studentDbId != null
          ? String(input.studentDbId)
          : undefined,
    userName:
      input.audience === "instructor"
        ? (input.instructorName ?? undefined)
        : (input.studentName ?? undefined),
    userRole:
      input.audience === "instructor"
        ? "instructor"
        : input.studentDbId != null
          ? input.audience === "guest"
            ? "guest"
            : "student"
          : undefined,
    courseId: input.courseId ?? undefined,
    courseName: input.courseName ?? undefined,
    apiEndpoint:
      input.audience === "instructor"
        ? "/api/instructor/support-tickets"
        : "/api/student/support-tickets",
    httpMethod: "POST",
    metadata: {
      source:
        input.audience === "instructor" ? "instructor_support_ticket" : "student_support_ticket",
      ticketId,
      kind,
      subject: input.subject,
      category: input.category,
      priority: input.priority,
      studentDbId: input.studentDbId,
      instructorId: input.instructorId ?? null,
      audience: input.audience ?? "student",
      requiresAdminReview: true,
      moduleId: input.moduleId ?? null,
      moduleLabel: input.moduleName ?? null,
      attachments: Array.isArray(input.attachments) ? input.attachments : [],
    },
    groupFingerprint: supportTicketFingerprint(ticketId),
    groupStatus: "needs_attention",
    groupOnRecurrence: "needs_attention",
    alwaysGroup: true,
  }

  const logId = await logSystemEvent(payload)
  return { ticketId, logId }
}

export function mapGroupStatusToTicketStatus(groupStatus: string | null | undefined): string {
  if (groupStatus === "resolved") return "resolved"
  if (groupStatus === "open") return "in_progress"
  return "open"
}
