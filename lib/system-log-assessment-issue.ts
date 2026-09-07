import { logSystemEvent, type SystemLogInput } from "@/lib/system-log"
import type { LogSeverity } from "@/lib/system-log-constants"

export type AssessmentIssueEventType =
  | "new_issue"
  | "new_comment"
  | "finalization_failure"
  | "issue_reopened"

const ASSESSMENT_TYPE_MODULE: Record<string, string> = {
  quiz: "Quiz Module",
  homework: "Homework Module",
  mid_semester: "Exam Module",
  midsem: "Exam Module",
  final: "Exam Module",
  practice: "Practice Module",
}

const ASSESSMENT_TYPE_LABEL: Record<string, string> = {
  quiz: "Quiz",
  homework: "Homework",
  mid_semester: "Mid-Semester Exam",
  midsem: "Mid-Semester Exam",
  final: "Final Exam",
  practice: "Practice",
}

export function assessmentIssueFingerprint(issueId: number): string {
  return `assessment-issue:${issueId}`
}

function moduleForAssessmentType(assessmentType?: string | null): string {
  if (!assessmentType) return "Quiz Module"
  return ASSESSMENT_TYPE_MODULE[assessmentType] ?? "Quiz Module"
}

function labelForAssessmentType(assessmentType?: string | null): string {
  if (!assessmentType) return "Quiz"
  return ASSESSMENT_TYPE_LABEL[assessmentType] ?? assessmentType
}

function inferSeverity(eventType: AssessmentIssueEventType, description: string): LogSeverity {
  if (eventType === "finalization_failure") return "error"
  const lower = description.toLowerCase()
  if (
    lower.includes("reopen") ||
    lower.includes("extension") ||
    lower.includes("deadline") ||
    lower.includes("please let me") ||
    lower.includes("beg")
  ) {
    return "warning"
  }
  return "warning"
}

export type AssessmentIssueLogInput = {
  issueId: number
  eventType: AssessmentIssueEventType
  assessmentType?: string | null
  assessmentId?: number | null
  assessmentTitle?: string | null
  description: string
  reporterName?: string | null
  reporterId?: string | null
  commenterName?: string | null
  commenterRole?: string | null
  commentText?: string | null
  questionNumber?: number | null
  courseId?: number | null
}

/** Write assessment panel issues/comments into system logs under Needs attention. */
export async function logAssessmentIssueToSystemLog(
  input: AssessmentIssueLogInput,
): Promise<string | null> {
  const typeLabel = labelForAssessmentType(input.assessmentType)
  const moduleName = moduleForAssessmentType(input.assessmentType)
  const title =
    input.eventType === "new_comment"
      ? `${typeLabel} issue comment: ${input.assessmentTitle ?? "Assessment"}`
      : input.eventType === "finalization_failure"
        ? `${typeLabel} submit failure: ${input.assessmentTitle ?? "Assessment"}`
        : input.eventType === "issue_reopened"
          ? `${typeLabel} issue reopened: ${input.assessmentTitle ?? "Assessment"}`
          : `${typeLabel} issue reported: ${input.assessmentTitle ?? "Assessment"}`

  const errorMessage =
    input.eventType === "new_comment"
      ? input.commentText ?? input.description
      : input.description

  const description =
    input.eventType === "new_comment"
      ? `${input.commenterName ?? "User"} (${input.commenterRole ?? "unknown"}): ${input.commentText ?? ""}`
      : input.description

  const payload: SystemLogInput = {
    severity: inferSeverity(input.eventType, errorMessage),
    category: "assessment",
    title,
    description,
    errorMessage,
    moduleName,
    featureName: input.assessmentTitle ?? undefined,
    userId: input.reporterId ?? input.commenterName ?? undefined,
    userName: input.reporterName ?? input.commenterName ?? undefined,
    userRole: input.commenterRole ?? (input.reporterId ? "student" : undefined),
    courseId: input.courseId ?? undefined,
    metadata: {
      source: "assessment_issues_panel",
      issueId: input.issueId,
      eventType: input.eventType,
      assessmentType: input.assessmentType,
      assessmentId: input.assessmentId,
      assessmentTitle: input.assessmentTitle,
      questionNumber: input.questionNumber,
      commenterName: input.commenterName,
      commenterRole: input.commenterRole,
      requiresAdminReview: true,
    },
    groupFingerprint: assessmentIssueFingerprint(input.issueId),
    groupStatus: "needs_attention",
    groupOnRecurrence: "needs_attention",
    alwaysGroup: true,
  }

  return logSystemEvent(payload)
}
