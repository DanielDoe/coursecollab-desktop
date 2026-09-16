"use client"

import type { InstructorClassroomHandoff } from "@/lib/codebench-instructor-classroom"
import type {
  LiveClassroomSessionPayload,
  LiveClassroomStudentRow,
  OpenLiveClassroomSession,
} from "@/lib/codebench-live-classroom-types"
import { instructorApiFetch, readInstructorApiJson } from "@/lib/instructor-api-headers"
import { classroomAssignmentSessionMatchesStudent } from "@/lib/classroom-assignment-session-match"

type InstructorStudentRow = {
  id: number
  student_id: string
  full_name: string
  section?: string | null
  session_code?: string | null
}

function readInstructorSelectedSessionId(): number | null {
  try {
    const raw = localStorage.getItem("instructorSession")
    if (!raw) return null
    const id = Number(JSON.parse(raw).selectedSessionId)
    return Number.isFinite(id) && id > 0 ? id : null
  } catch {
    return null
  }
}

function emptySummary(students: LiveClassroomStudentRow[]) {
  return {
    totalStudents: students.length,
    coding: students.filter((s) => s.status === "coding").length,
    errors: students.filter((s) => s.status === "error").length,
    needsHelp: students.filter((s) => s.status === "needs_help").length,
    submitted: students.filter((s) => s.status === "submitted").length,
    approved: students.filter((s) => s.status === "approved").length,
    notStarted: students.filter((s) => s.status === "not_started").length,
    review: students.filter((s) => s.status === "review").length,
  }
}

function mapRosterStudent(row: InstructorStudentRow): LiveClassroomStudentRow {
  return {
    studentDbId: row.id,
    studentId: row.student_id,
    fullName: row.full_name,
    section: row.section ?? row.session_code ?? null,
    status: "not_started",
    statusLabel: "Not started",
    lastActivityAt: null,
    compileErrors: 0,
    runs: 0,
    code: null,
    codeSource: null,
    fileName: null,
    language: null,
    typingReplay: null,
    snapshotUpdatedAt: null,
    submissionStatus: null,
    score: null,
    points: null,
    latestEventTitle: null,
    latestEventDetail: null,
  }
}

async function loadOpenSessionMeta(
  assignmentId: number,
): Promise<OpenLiveClassroomSession | null> {
  const response = await instructorApiFetch("/api/instructor/codebench/live-session")
  if (response.status === 404 || response.status === 405) return null
  const parsed = await readInstructorApiJson<{ sessions?: OpenLiveClassroomSession[] }>(
    response,
    "Open live sessions",
  )
  if (!parsed.ok) return null
  return parsed.data.sessions?.find((session) => session.assignmentId === assignmentId) ?? null
}

async function loadInstructorRoster(handoff: InstructorClassroomHandoff): Promise<InstructorStudentRow[]> {
  const sessionId = readInstructorSelectedSessionId()
  const url = sessionId
    ? `/api/instructor/students?session_id=${encodeURIComponent(String(sessionId))}`
    : handoff.session?.trim()
      ? `/api/instructor/students?sessionCode=${encodeURIComponent(handoff.session.trim())}`
      : "/api/instructor/students"

  const response = await instructorApiFetch(url)
  const parsed = await readInstructorApiJson<{ students?: InstructorStudentRow[] }>(
    response,
    "Instructor students",
  )
  if (!parsed.ok || !Array.isArray(parsed.data.students)) return []

  const assignmentSession = handoff.session?.trim() || null
  return parsed.data.students.filter((row) =>
    classroomAssignmentSessionMatchesStudent(assignmentSession, row.session_code ?? row.section ?? null),
  )
}

/** When the live-session detail API fails (older production), rebuild a usable monitor from list + roster. */
export async function fetchLiveClassroomSessionFallback(
  handoff: InstructorClassroomHandoff,
): Promise<LiveClassroomSessionPayload | null> {
  try {
    const [open, roster] = await Promise.all([
      loadOpenSessionMeta(handoff.submissionId),
      loadInstructorRoster(handoff),
    ])
    const students = roster.map(mapRosterStudent)
    return {
      assignmentId: handoff.submissionId,
      title: handoff.title,
      session: handoff.session,
      isOpen: Boolean(open),
      liveSessionId: open?.sessionId ?? null,
      startedAt: open?.startedAt ?? new Date().toISOString(),
      polledAt: new Date().toISOString(),
      summary: emptySummary(students),
      students,
      recentEvents: [],
    }
  } catch {
    return null
  }
}

export async function enrichLiveSessionWithRoster(
  payload: LiveClassroomSessionPayload,
  handoff: InstructorClassroomHandoff,
): Promise<LiveClassroomSessionPayload> {
  if (payload.students.length > 0) return payload
  const roster = await loadInstructorRoster(handoff)
  if (roster.length === 0) return payload
  const students = roster.map(mapRosterStudent)
  return {
    ...payload,
    students,
    summary: emptySummary(students),
    polledAt: new Date().toISOString(),
  }
}
