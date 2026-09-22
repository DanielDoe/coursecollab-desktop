import type { TypingReplay } from "@/lib/typing-replay"

export type LiveEditorCursor = {
  line: number
  column: number
}

export type LiveStudentStatus =
  | "not_started"
  | "joined"
  | "coding"
  | "error"
  | "needs_help"
  | "submitted"
  | "approved"
  | "review"

export type LiveClassroomStudentRow = {
  studentDbId: number
  studentId: string
  fullName: string
  section: string | null
  status: LiveStudentStatus
  statusLabel: string
  lastActivityAt: string | null
  compileErrors: number
  runs: number
  code: string | null
  /** Live snapshot vs graded Classroom Points / CodeBench submission. */
  codeSource?: "live" | "submitted" | null
  fileName: string | null
  language: string | null
  typingReplay: TypingReplay | null
  studentCursor?: LiveEditorCursor
  instructorCursor?: LiveEditorCursor
  snapshotUpdatedAt: string | null
  submissionStatus: string | null
  score: number | null
  points: number | null
  latestEventTitle: string | null
  latestEventDetail: string | null
}

export type LiveClassroomSessionPayload = {
  assignmentId: number
  title: string
  session: string | null
  isOpen: boolean
  liveSessionId: number | null
  startedAt: string
  polledAt: string
  summary: {
    totalStudents: number
    coding: number
    errors: number
    needsHelp: number
    submitted: number
    approved: number
    joined: number
    notStarted: number
    review: number
  }
  students: LiveClassroomStudentRow[]
  recentEvents: Array<{
    id: string
    studentDbId: number
    studentName: string
    title: string
    detail: string | null
    tone: "error" | "ok" | "tool" | "info" | "submit"
    createdAt: string
  }>
}

export type OpenLiveClassroomSession = {
  sessionId: number
  assignmentId: number
  courseId: number
  title: string
  questionText: string
  session: string | null
  startedAt: string
}

export type StudentLiveClassroomSession = {
  sessionId: number
  assignmentId: number
  title: string
  questionText: string
  session: string | null
  startedAt: string
}
