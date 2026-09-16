import {
  classroomAssignmentFormToApiPayload,
  emptyClassroomAssignmentForm,
  type ClassroomAssignmentFormValues,
} from "@/components/classroom-assignment-editor"
import { studentApiFetch } from "@/lib/auth"
import type { ClassroomAssignmentRow } from "@/lib/codebench-instructor-classroom"
import { classroomAssignmentAvailableForInstructorManage } from "@/lib/classroom-submission-availability"
import { CLASSROOM_SUBMISSION_KIND_CODE } from "@/lib/classroom-solution-submission"
import { buildInstructorAuthorizedApiHeaders } from "@/lib/instructor-api-headers"

export function defaultLiveClassroomSessionTitle(): string {
  const now = new Date()
  const label = now.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  return `Live classroom — ${label}`
}

export const LIVE_CLASSROOM_DEFAULT_PROMPT = `Live CodeBench session

During class, write and run C++ in CodeBench. Your instructor can follow your editor live.

Starter task: write a program that reads your name and prints a welcome message.`

export function emptyLiveClassroomAssignmentForm(sessionCode: string | null): ClassroomAssignmentFormValues {
  const session =
    sessionCode && sessionCode.trim() && sessionCode.trim().toLowerCase() !== "all"
      ? sessionCode.trim()
      : null
  return {
    ...emptyClassroomAssignmentForm(),
    title: defaultLiveClassroomSessionTitle(),
    description: LIVE_CLASSROOM_DEFAULT_PROMPT,
    submissionKind: CLASSROOM_SUBMISSION_KIND_CODE,
    neverExpires: true,
    session,
  }
}

function normalizeCreatedRow(raw: Record<string, unknown>): ClassroomAssignmentRow {
  const row = raw as ClassroomAssignmentRow
  return {
    ...row,
    is_active: classroomAssignmentAvailableForInstructorManage(row),
  }
}

export async function createInstructorCodingChallenge(input: {
  formValues: ClassroomAssignmentFormValues
  sendNotifications?: boolean
}): Promise<ClassroomAssignmentRow> {
  const instructorId =
    typeof window !== "undefined" ? Number(window.localStorage.getItem("instructorId")) : NaN
  if (!Number.isFinite(instructorId)) {
    throw new Error("Could not resolve your instructor session. Sign in again and retry.")
  }

  const response = await studentApiFetch("/api/classroom-points/submissions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildInstructorAuthorizedApiHeaders(),
    },
    body: JSON.stringify({
      ...classroomAssignmentFormToApiPayload({
        ...input.formValues,
        submissionKind: CLASSROOM_SUBMISSION_KIND_CODE,
      }),
      instructorId,
      sendNotifications: input.sendNotifications !== false,
    }),
  })

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: string; details?: string }
    throw new Error(errorData.error || errorData.details || "Failed to create assignment")
  }

  const data = (await response.json()) as { submission?: Record<string, unknown> }
  if (!data.submission || typeof data.submission !== "object") {
    throw new Error("Assignment was created but the server returned an unexpected response.")
  }
  return normalizeCreatedRow(data.submission)
}

export function validateCodingChallengeForm(formValues: ClassroomAssignmentFormValues): string | null {
  if (!formValues.title.trim()) return "Give the live session a title students will recognize."
  if (!formValues.description.trim()) return "Add a short problem description for the live session."
  if (!formValues.neverExpires && !formValues.dueAtLocal.trim()) {
    return "Set a due date or choose “No due date (never expires)”."
  }
  return null
}
