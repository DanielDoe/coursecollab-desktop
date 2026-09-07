import type { CoraStudentContextPayload } from "@/lib/cora/fetch-student-context"
import type { FacultyCoraContextPayload } from "@/lib/cora/fetch-faculty-context"
import type { GuestCoraContextPayload } from "@/lib/cora/fetch-guest-context"
import type { CoraPrivacySettings } from "@/lib/cora/privacy/cora-privacy-settings"

export type ExternalAiContextOptions = {
  privacy?: Partial<CoraPrivacySettings>
  /** Include course code/title only — never student identity fields. */
  includeCourseLabel?: boolean
}

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const PHONE_RE = /\b(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}\b/g
const BEARER_RE = /\b(?:Bearer\s+)?[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g
const INTERNAL_ID_RE = /\b(?:student|user|account|instructor|faculty|admin)[_\s-]?id\s*[:=]\s*\d+\b/gi

/** Redact common PII patterns from free text before external model calls. */
export function redactPiiFromText(text: string): string {
  if (!text) return text
  return text
    .replace(EMAIL_RE, "[redacted-email]")
    .replace(PHONE_RE, "[redacted-phone]")
    .replace(BEARER_RE, "[redacted-token]")
    .replace(INTERNAL_ID_RE, "[redacted-id]")
}

/** Chat message shape for external providers — must preserve tool_calls / tool_call_id. */
export type ExternalAiChatMessage = {
  role: string
  content: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tool_calls?: any
  tool_call_id?: string
  name?: string
}

/**
 * Redact PII in message content without stripping agent tool metadata.
 * Dropping `tool_calls` / `tool_call_id` breaks OpenAI (orphaned role=tool messages).
 */
export function sanitizeMessagesForExternalAi(
  messages: ExternalAiChatMessage[],
): ExternalAiChatMessage[] {
  return messages.map((m) => {
    const next: ExternalAiChatMessage = {
      role: m.role,
      content: typeof m.content === "string" ? redactPiiFromText(m.content) : m.content,
    }
    if (m.tool_calls != null) next.tool_calls = m.tool_calls
    if (typeof m.tool_call_id === "string" && m.tool_call_id) next.tool_call_id = m.tool_call_id
    if (typeof m.name === "string" && m.name) next.name = m.name
    return next
  })
}

/** Pseudonymous provider session id — never use internal user ids as provider identifiers. */
export function pseudonymousProviderSessionId(seed?: string): string {
  const cryptoObj = globalThis.crypto
  if (cryptoObj?.randomUUID) return `cora_${cryptoObj.randomUUID()}`
  const base = seed ? hashString(seed) : String(Date.now())
  return `cora_${base.slice(0, 32)}`
}

function hashString(input: string): string {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, "0")
}

function privacyFlags(options?: ExternalAiContextOptions) {
  const p = options?.privacy ?? {}
  return {
    personalized: p.personalizedLearning !== false,
    learningContext: p.useLearningContext !== false,
    includeCourse: options?.includeCourseLabel !== false,
  }
}

/**
 * Minimized student snapshot for external AI — no name, email, student id, or db id.
 */
export function minimizeStudentContextForExternalAi(
  ctx: CoraStudentContextPayload,
  options?: ExternalAiContextOptions,
): CoraStudentContextPayload {
  const { personalized, learningContext, includeCourse } = privacyFlags(options)
  const account = ctx.account

  return {
    ...ctx,
    account: includeCourse
      ? {
          courseCode: account?.courseCode ?? null,
          courseTitle: account?.courseTitle ?? null,
          section: account?.section ?? null,
        }
      : undefined,
    membership: personalized ? ctx.membership : undefined,
    grades: learningContext && personalized ? ctx.grades : [],
    announcements: learningContext ? ctx.announcements : [],
    flashcardDecks: learningContext ? ctx.flashcardDecks?.map((d) => ({ id: d.id, title: d.title })) : [],
    digitalNotes: learningContext ? ctx.digitalNotes?.map((n) => ({ id: n.id, title: n.title })) : [],
    practiceAttempts: learningContext ? stripAttemptIdentity(ctx.practiceAttempts) : [],
    playgroundResults: learningContext ? stripAttemptIdentity(ctx.playgroundResults) : [],
    quizAttempts: learningContext ? stripQuizAttemptIdentity(ctx.quizAttempts) : [],
    codebenchSubmissions: learningContext ? stripAttemptIdentity(ctx.codebenchSubmissions) : [],
    lectureProgress: learningContext ? ctx.lectureProgress : [],
    topicMastery: learningContext && personalized ? ctx.topicMastery : [],
    calendarEvents: learningContext ? ctx.calendarEvents : [],
    upcomingAssessments: learningContext ? ctx.upcomingAssessments : [],
    missedDeadlines: learningContext ? ctx.missedDeadlines : [],
    notifications: [],
    knowledgeGraph: learningContext && personalized ? ctx.knowledgeGraph : undefined,
    strugglingTopics: learningContext && personalized ? ctx.strugglingTopics : [],
    strengths: learningContext && personalized ? ctx.strengths : [],
    codebenchStudio: learningContext && personalized ? ctx.codebenchStudio : undefined,
    profile: learningContext && personalized ? ctx.profile : {},
    summary: learningContext && personalized ? ctx.summary : {},
  }
}

function stripAttemptIdentity(rows: unknown): unknown {
  if (!Array.isArray(rows)) return rows
  return rows.map((row) => {
    if (!row || typeof row !== "object") return row
    const copy = { ...(row as Record<string, unknown>) }
    delete copy.student_id
    delete copy.studentId
    delete copy.email
    delete copy.full_name
    delete copy.fullName
    return copy
  })
}

function stripQuizAttemptIdentity(rows: unknown): unknown {
  const stripped = stripAttemptIdentity(rows)
  if (!Array.isArray(stripped)) return stripped
  return stripped.map((row) => {
    if (!row || typeof row !== "object") return row
    const copy = { ...(row as Record<string, unknown>) }
    delete copy.quiz_id
    delete copy.id
    return copy
  })
}

/** Guest career snapshot for external AI — no member name/email; workflow ids stripped. */
export function minimizeGuestContextForExternalAi(ctx: GuestCoraContextPayload): GuestCoraContextPayload {
  return {
    ...ctx,
    account: {
      ...ctx.account,
      guestId: 0,
      fullName: "Career Member",
      email: null,
    },
    applications: ctx.applications.map((a) => ({ ...a, id: 0 })),
    recommendations: ctx.recommendations.map((r) => ({
      ...r,
      id: 0,
      instructorName: r.instructorName ? redactPiiFromText(r.instructorName) : r.instructorName,
    })),
  }
}

export function maskCampusIdTail(value: string | null | undefined): string {
  const s = String(value ?? "").trim()
  if (!s) return "—"
  if (s.length <= 4) return "…"
  return `…${s.slice(-4)}`
}

/** Admin directory line for external model context — no names, emails, or internal user ids. */
export function formatAdminStudentSearchLine(input: {
  index: number
  courseCode: string | null
  section: string | null
  campusId: string | null
}): string {
  return `- Match ${input.index + 1}: ${input.courseCode || "—"} ${input.section || ""} · campus ID ${maskCampusIdTail(input.campusId)}`.trim()
}

export function formatAdminFacultySearchLine(input: {
  index: number
  role: string
  courseCount: number
  isActive: boolean
}): string {
  return `- Match ${input.index + 1}: ${input.role}${input.isActive ? "" : " (inactive)"} · ${input.courseCount} course(s)`
}

/** Access-request listing for external model context — workflow id only, no applicant identity. */
export function formatAccessRequestLineForExternalAi(input: {
  requestId: number
  accountType: string
  section?: string | null
  emailVerified: boolean
}): string {
  return `- Request #${input.requestId}: ${input.accountType}${input.section ? ` · ${input.section}` : ""} · ${input.emailVerified ? "email verified" : "email unverified"}`
}

/** Faculty course snapshot for external AI — aggregated counts only, no roster identities. */
export function minimizeFacultyContextForExternalAi(ctx: FacultyCoraContextPayload): FacultyCoraContextPayload {
  return {
    ...ctx,
    course: {
      id: 0,
      courseCode: ctx.course.courseCode,
      courseTitle: ctx.course.courseTitle,
    },
    dashboard: { ...ctx.dashboard },
    questionBank: ctx.questionBank,
    lectures: ctx.lectures,
    assessments: ctx.assessments,
    practice: ctx.practice,
    playbook: ctx.playbook
      ? {
          ...ctx.playbook,
          capabilities: ctx.playbook.capabilities,
          insights: ctx.playbook.insights,
        }
      : undefined,
    syncedAt: ctx.syncedAt,
  }
}

/** Structured audit catalog — keep aligned with legal disclosures and runtime minimization. */
export const CORA_EXTERNAL_AI_DATA_FLOW = [
  {
    stage: "CourseCollab data",
    detail:
      "Profiles, grades, rosters, conversations, and preferences live in CourseCollab Postgres and client storage.",
  },
  {
    stage: "Data selected for Cora",
    detail:
      "Authorized tool reads and task-specific fields (question text, answer text, rubric, course aggregates).",
  },
  {
    stage: "Data removed / redacted",
    detail:
      "Names, emails, student IDs, internal database IDs, tokens, payment data, and unrelated profile fields.",
  },
  {
    stage: "External payload",
    detail:
      "Minimized messages and instructional context only; pseudonymous provider session ids when needed.",
  },
  {
    stage: "Providers",
    detail: "OpenAI and/or Anthropic via server-side API keys (not open-source self-hosted models).",
  },
  {
    stage: "Returned data",
    detail: "Model text/JSON responses; not treated as authoritative records.",
  },
  {
    stage: "CourseCollab storage",
    detail: "Conversations, credit ledger, audit hashes, and optional server learning preferences.",
  },
  {
    stage: "Device storage",
    detail: "Teaching style preferences and local learning memory toggles in browser/app storage.",
  },
  {
    stage: "Retention",
    detail:
      "Conversations deletable by user; provider retention follows provider terms; academic records remain institutional.",
  },
] as const

export type AssessmentFeedbackExternalPayload = {
  questionText: string
  studentResponse: string
  rubricOrContext?: string
  assessmentType?: string
}

/** Build a grading/feedback payload without student identity. */
export function buildAssessmentFeedbackExternalPayload(input: {
  questionText: string
  studentResponse: string
  rubricOrContext?: string
  assessmentType?: string
}): AssessmentFeedbackExternalPayload {
  return {
    questionText: redactPiiFromText(String(input.questionText ?? "")),
    studentResponse: redactPiiFromText(String(input.studentResponse ?? "")),
    rubricOrContext: input.rubricOrContext
      ? redactPiiFromText(String(input.rubricOrContext))
      : undefined,
    assessmentType: input.assessmentType,
  }
}

/** Safe console logging for Cora — never log full prompts in production. */
export function logCoraExternalAiCall(meta: {
  feature: string
  model?: string
  messageCount?: number
  promptChars?: number
  redacted?: boolean
}) {
  if (process.env.NODE_ENV === "production") {
    console.info("[cora/external-ai]", {
      feature: meta.feature,
      model: meta.model ?? null,
      messageCount: meta.messageCount ?? null,
      promptChars: meta.promptChars ?? null,
      redacted: meta.redacted !== false,
    })
    return
  }
  console.info("[cora/external-ai/dev]", meta)
}
