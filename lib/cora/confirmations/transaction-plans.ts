/**
 * Cora transaction plans — multi-step consequential workflows.
 *
 * The LLM proposes a plan; the UI confirms; the server executes exactly
 * the signed operations (via existing action proposals / services).
 */

import { createHmac, randomBytes } from "crypto"
import type { CoraRiskLevel } from "@/lib/cora/capabilities/faculty-module-registry"
import type { CoraProposalTool, CoraActionProposal } from "@/lib/cora/confirmations/action-proposals"
import { createCoraActionProposal } from "@/lib/cora/confirmations/action-proposals"
import {
  confirmCoraActionProposal,
  type ConfirmCoraActionResult,
} from "@/lib/cora/confirmations/confirm-action"
import type { CoraSession } from "@/lib/cora/security/types"

export type CoraPlanOperation = {
  id: string
  tool: CoraProposalTool | string
  risk: CoraRiskLevel
  label: string
  payload: Record<string, unknown>
  /** When set, depends on a prior operation's created entity */
  dependsOn?: string
}

export type CoraTransactionPlan = {
  planId: string
  intent: string
  courseLabel?: string
  summary: string
  operations: CoraPlanOperation[]
  /** Highest risk among operations */
  maxRisk: CoraRiskLevel
  createdAt: string
  expiresAt: string
  userId: number
  role: "student" | "faculty" | "admin"
  institutionId?: number | null
  courseId?: number | null
  hash: string
}

const RISK_ORDER: CoraRiskLevel[] = ["none", "confirm", "high", "forbidden"]

export function maxRisk(levels: CoraRiskLevel[]): CoraRiskLevel {
  let max: CoraRiskLevel = "none"
  for (const level of levels) {
    if (RISK_ORDER.indexOf(level) > RISK_ORDER.indexOf(max)) max = level
  }
  return max
}

export function requiresConfirmation(risk: CoraRiskLevel): boolean {
  return risk === "confirm" || risk === "high"
}

function planSecret(): string {
  return (
    process.env.CORA_ACTION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SESSION_SECRET ||
    "cora-dev-secret"
  )
}

function canonicalPlan(body: Omit<CoraTransactionPlan, "hash">): string {
  return JSON.stringify(body)
}

export function signTransactionPlan(
  body: Omit<CoraTransactionPlan, "hash">,
): CoraTransactionPlan {
  const hash = createHmac("sha256", planSecret()).update(canonicalPlan(body)).digest("hex")
  return { ...body, hash }
}

export function verifyTransactionPlan(
  plan: CoraTransactionPlan,
  expect: { userId: number; role: string; courseId?: number | null },
): { ok: true; plan: CoraTransactionPlan } | { ok: false; reason: string } {
  if (!plan?.planId || !plan.hash) return { ok: false, reason: "Invalid plan." }
  if (plan.userId !== expect.userId) return { ok: false, reason: "Plan user mismatch." }
  if (plan.role !== expect.role) return { ok: false, reason: "Plan role mismatch." }
  if (Date.parse(plan.expiresAt) < Date.now()) return { ok: false, reason: "Plan expired." }
  if (
    expect.courseId != null &&
    plan.courseId != null &&
    Number(plan.courseId) !== Number(expect.courseId)
  ) {
    return { ok: false, reason: "Plan course scope mismatch." }
  }
  const { hash: _h, ...body } = plan
  const expected = createHmac("sha256", planSecret())
    .update(canonicalPlan(body as Omit<CoraTransactionPlan, "hash">))
    .digest("hex")
  if (expected !== plan.hash) return { ok: false, reason: "Plan signature invalid." }
  return { ok: true, plan }
}

export function buildAnnouncementTransactionPlan(input: {
  intent: string
  courseLabel: string
  title: string
  body: string
  courseId: number
  audienceCount?: number
  userId: number
  role?: "faculty"
  institutionId?: number | null
}): CoraTransactionPlan {
  const ops: CoraPlanOperation[] = [
    {
      id: "create",
      tool: "announcement.publish",
      risk: "high",
      label: "Publish announcement",
      payload: {
        title: input.title,
        content: input.body,
        courseId: input.courseId,
      },
    },
  ]
  const createdAt = new Date().toISOString()
  return signTransactionPlan({
    planId: `plan_${randomBytes(8).toString("hex")}`,
    intent: input.intent,
    courseLabel: input.courseLabel,
    summary: input.audienceCount
      ? `${input.audienceCount} students will receive this announcement.`
      : `Publish to ${input.courseLabel}.`,
    operations: ops,
    maxRisk: maxRisk(ops.map((o) => o.risk)),
    createdAt,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    userId: input.userId,
    role: input.role ?? "faculty",
    institutionId: input.institutionId ?? null,
    courseId: input.courseId,
  })
}

/**
 * Cross-module remediation: Question Bank (optional) → Quiz draft from bank.
 * Progress/results analysis should already have run (read-only) before this plan.
 */
export function buildRemediationQuizTransactionPlan(input: {
  intent?: string
  courseLabel: string
  courseId: number
  userId: number
  institutionId?: number | null
  quizTitle: string
  questionIds: number[]
  /** Optional drafts to create in QB before assessment (same schemas as bulk create). */
  questionDrafts?: unknown[]
  assessmentType?: "quiz" | "homework" | "mid_semester" | "final"
  publish?: boolean
  weakTopics?: string[]
}): CoraTransactionPlan {
  const ops: CoraPlanOperation[] = []
  if (input.questionDrafts && input.questionDrafts.length > 0) {
    ops.push({
      id: "qb",
      tool: "questionBank.createQuestions",
      risk: "confirm",
      label: `Save ${input.questionDrafts.length} Question Bank items`,
      payload: {
        courseId: input.courseId,
        drafts: input.questionDrafts,
      },
    })
  }
  ops.push({
    id: "quiz",
    tool: "assessment.createFromBank",
    risk: input.publish ? "high" : "confirm",
    label: input.publish ? "Create & publish quiz" : "Create quiz draft",
    payload: {
      courseId: input.courseId,
      title: input.quizTitle,
      questionIds: input.questionIds,
      assessmentType: input.assessmentType ?? "quiz",
      publish: input.publish === true,
    },
    dependsOn: ops.some((o) => o.id === "qb") ? "qb" : undefined,
  })

  const topicNote =
    input.weakTopics && input.weakTopics.length
      ? ` Focus topics: ${input.weakTopics.slice(0, 5).join(", ")}.`
      : ""
  const createdAt = new Date().toISOString()
  return signTransactionPlan({
    planId: `plan_${randomBytes(8).toString("hex")}`,
    intent: input.intent ?? "remediation_quiz_from_weak_topics",
    courseLabel: input.courseLabel,
    summary: `Remediation quiz with ${input.questionIds.length || input.questionDrafts?.length || 0} items.${topicNote}`,
    operations: ops,
    maxRisk: maxRisk(ops.map((o) => o.risk)),
    createdAt,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    userId: input.userId,
    role: "faculty",
    institutionId: input.institutionId ?? null,
    courseId: input.courseId,
  })
}

/** Convert a single-op plan into a signed action proposal for the existing confirm UI. */
export function planToActionProposal(input: {
  plan: CoraTransactionPlan
  userId: number
  role: "student" | "faculty" | "admin"
  institutionId?: number | null
  courseId?: number | null
  operationId?: string
}): CoraActionProposal | null {
  const op =
    (input.operationId
      ? input.plan.operations.find((o) => o.id === input.operationId)
      : input.plan.operations[0]) ?? null
  if (!op) return null
  const allowed: CoraProposalTool[] = [
    "announcement.publish",
    "questionBank.createQuestions",
    "assessment.createFromBank",
    "message.send",
    "syllabus.saveSection",
    "syllabus.publishSection",
    "lecture.createShell",
    "personalFlashcards.createDeck",
    "personalNotes.create",
    "personalCalendar.createEvents",
  ]
  if (!allowed.includes(op.tool as CoraProposalTool)) return null

  return createCoraActionProposal({
    userId: input.userId,
    role: input.role,
    institutionId: input.institutionId,
    courseId: input.courseId,
    tool: op.tool as CoraProposalTool,
    arguments: op.payload,
    preview: {
      title: op.label,
      summary: input.plan.summary,
      fields: [
        ...(input.plan.courseLabel
          ? [{ label: "Course", value: input.plan.courseLabel }]
          : []),
        { label: "Risk", value: input.plan.maxRisk },
        ...Object.entries(op.payload)
          .filter(([k]) => k === "title" || k === "topic" || k === "sectionTitle")
          .map(([k, v]) => ({ label: k, value: String(v) })),
      ],
      confirmLabel: op.label,
      entityType:
        op.tool === "announcement.publish"
          ? "announcement"
          : op.tool === "questionBank.createQuestions"
            ? "question"
            : op.tool === "assessment.createFromBank"
              ? "assessment"
              : op.tool === "message.send"
                ? "message"
                : op.tool === "syllabus.saveSection" || op.tool === "syllabus.publishSection"
                  ? "syllabus"
                  : op.tool === "lecture.createShell"
                    ? "lecture"
                    : op.tool === "personalFlashcards.createDeck"
                      ? "flashcard_deck"
                      : op.tool === "personalCalendar.createEvents"
                        ? "calendar_events"
                        : "note",
    },
  })
}

export async function confirmTransactionPlan(input: {
  session: CoraSession
  plan: CoraTransactionPlan
  courseId?: number | null
}): Promise<{
  success: boolean
  message: string
  results: ConfirmCoraActionResult[]
  error?: string
}> {
  const verified = verifyTransactionPlan(input.plan, {
    userId: input.session.userId,
    role: input.session.role,
    courseId: input.courseId ?? input.session.courseIds[0] ?? null,
  })
  if (!verified.ok) {
    return { success: false, message: verified.reason, results: [], error: verified.reason }
  }

  const results: ConfirmCoraActionResult[] = []
  let createdQuestionIds: number[] = []

  for (const op of verified.plan.operations) {
    let payload = { ...op.payload }
    if (
      op.tool === "assessment.createFromBank" &&
      op.dependsOn === "qb" &&
      createdQuestionIds.length > 0
    ) {
      const existing = Array.isArray(payload.questionIds)
        ? payload.questionIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
        : []
      payload = {
        ...payload,
        questionIds: existing.length ? existing : createdQuestionIds,
      }
    }

    const proposal = planToActionProposal({
      plan: { ...verified.plan, operations: [{ ...op, payload }] },
      userId: input.session.userId,
      role: input.session.role,
      institutionId: input.session.institutionId,
      courseId: input.courseId ?? verified.plan.courseId,
      operationId: op.id,
    })
    if (!proposal) {
      return {
        success: false,
        message: `Unsupported plan operation: ${op.tool}`,
        results,
        error: "unsupported_op",
      }
    }

    const step = await confirmCoraActionProposal({
      session: input.session,
      proposal,
      courseId: input.courseId ?? verified.plan.courseId,
    })
    results.push(step)
    if (!step.success) {
      return {
        success: false,
        message: `Stopped at "${op.label}": ${step.message}`,
        results,
        error: step.error,
      }
    }
    if (op.tool === "questionBank.createQuestions") {
      const ids = step.data?.questionIds
      if (Array.isArray(ids)) {
        createdQuestionIds = ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
      }
    }
  }

  return {
    success: true,
    message: `Completed ${results.length} step${results.length === 1 ? "" : "s"}.`,
    results,
  }
}

export const CORA_PLAN_MARKER = "__CORA_PLAN__:"

export function serializePlanForToolResult(plan: CoraTransactionPlan): string {
  return `${CORA_PLAN_MARKER}${JSON.stringify(plan)}`
}

function extractJsonObjectAt(text: string, start: number): { json: string; end: number } | null {
  if (text[start] !== "{") return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!
    if (inString) {
      if (escape) escape = false
      else if (ch === "\\") escape = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === "{") depth += 1
    else if (ch === "}") {
      depth -= 1
      if (depth === 0) return { json: text.slice(start, i + 1), end: i + 1 }
    }
  }
  return null
}

export function extractPlansFromToolText(text: string): {
  cleanText: string
  plans: CoraTransactionPlan[]
} {
  const plans: CoraTransactionPlan[] = []
  let cleanText = text
  let idx = cleanText.indexOf(CORA_PLAN_MARKER)
  while (idx >= 0) {
    const jsonStart = idx + CORA_PLAN_MARKER.length
    const extracted = extractJsonObjectAt(cleanText, jsonStart)
    if (!extracted) break
    try {
      const parsed = JSON.parse(extracted.json) as CoraTransactionPlan
      if (parsed?.planId && parsed?.hash && Array.isArray(parsed.operations)) {
        plans.push(parsed)
      }
    } catch {
      /* ignore */
    }
    cleanText = `${cleanText.slice(0, idx)}${cleanText.slice(extracted.end)}`.trim()
    idx = cleanText.indexOf(CORA_PLAN_MARKER)
  }
  return { cleanText: cleanText.trim(), plans }
}
