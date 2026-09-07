/**
 * Signed, short-lived Cora action proposals.
 *
 * Consequential mutations must not execute from a bare "Yes" in chat.
 * The UI Confirm button posts the exact proposal token; the server verifies
 * user/role/scope/hash/expiry before running the registered tool.
 */

import { createHmac, randomBytes, timingSafeEqual } from "crypto"

export type CoraProposalTool =
  | "announcement.publish"
  | "questionBank.createQuestions"
  | "assessment.createFromBank"
  | "message.send"
  | "syllabus.saveSection"
  | "syllabus.publishSection"
  | "lecture.createShell"
  | "flashcard.generateFromBank"
  | "courseNote.create"
  | "account.passwordReset.approve"
  | "account.passwordReset.reject"
  | "account.accessRequest.approve"
  | "account.accessRequest.reject"
  | "personalFlashcards.createDeck"
  | "personalNotes.create"
  | "personalCalendar.createEvents"
  | "personalPracticeQuiz.create"
  | "personalStudyPlan.create"
  | "courseExchange.request"
  | "courseExchange.approve"
  | "courseExchange.reject"
  | "courseExchange.importCopy"

export type CoraProposalPreviewField = {
  label: string
  value: string
}

export type CoraProposalPreview = {
  title: string
  summary: string
  fields: CoraProposalPreviewField[]
  /** Primary CTA label on the action card */
  confirmLabel: string
  entityType:
    | "announcement"
    | "question"
    | "assessment"
    | "message"
    | "syllabus"
    | "lecture"
    | "account"
    | "flashcard_deck"
    | "note"
    | "calendar_events"
    | "practice_quiz"
    | "study_plan"
    | "course"
}

export type CoraActionProposalBody = {
  actionId: string
  userId: number
  role: "student" | "faculty" | "admin"
  institutionId: number | null
  courseId: number | null
  tool: CoraProposalTool
  arguments: Record<string, unknown>
  createdAt: string
  expiresAt: string
  preview: CoraProposalPreview
}

export type CoraActionProposal = CoraActionProposalBody & {
  hash: string
}

const DEFAULT_TTL_MS = 30 * 60 * 1000

function proposalSecret(): string {
  const secret =
    process.env.CORA_ACTION_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim()
  if (secret) return secret
  // Node's test runner sets NODE_TEST_CONTEXT. Never fall back in deployed envs.
  if (process.env.NODE_TEST_CONTEXT) return "test-cora-action-secret"
  throw new Error("CORA_ACTION_SECRET (or NEXTAUTH_SECRET / AUTH_SECRET) must be set")
}

function canonicalPayload(body: CoraActionProposalBody): string {
  return JSON.stringify({
    actionId: body.actionId,
    userId: body.userId,
    role: body.role,
    institutionId: body.institutionId,
    courseId: body.courseId,
    tool: body.tool,
    arguments: body.arguments,
    createdAt: body.createdAt,
    expiresAt: body.expiresAt,
  })
}

export function signCoraActionProposal(body: CoraActionProposalBody): CoraActionProposal {
  const hash = createHmac("sha256", proposalSecret()).update(canonicalPayload(body)).digest("hex")
  return { ...body, hash }
}

export function createCoraActionProposal(input: {
  userId: number
  role: "student" | "faculty" | "admin"
  institutionId?: number | null
  courseId?: number | null
  tool: CoraProposalTool
  arguments: Record<string, unknown>
  preview: CoraProposalPreview
  ttlMs?: number
}): CoraActionProposal {
  const now = Date.now()
  const body: CoraActionProposalBody = {
    actionId: `cap_${now.toString(36)}_${randomBytes(8).toString("hex")}`,
    userId: input.userId,
    role: input.role,
    institutionId: input.institutionId ?? null,
    courseId: input.courseId ?? null,
    tool: input.tool,
    arguments: input.arguments,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + (input.ttlMs ?? DEFAULT_TTL_MS)).toISOString(),
    preview: input.preview,
  }
  return signCoraActionProposal(body)
}

export type VerifyProposalResult =
  | { ok: true; proposal: CoraActionProposal }
  | { ok: false; reason: string }

export function verifyCoraActionProposal(
  proposal: CoraActionProposal,
  expected: { userId: number; role: "student" | "faculty" | "admin"; courseId?: number | null },
): VerifyProposalResult {
  if (!proposal?.actionId || !proposal.hash || !proposal.tool) {
    return { ok: false, reason: "Invalid proposal." }
  }

  const expiresAt = Date.parse(proposal.expiresAt)
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return { ok: false, reason: "This action proposal has expired. Ask Cora to prepare it again." }
  }

  if (proposal.userId !== expected.userId || proposal.role !== expected.role) {
    return { ok: false, reason: "Proposal does not match the authenticated user." }
  }

  if (
    expected.courseId != null &&
    proposal.courseId != null &&
    Number(expected.courseId) !== Number(proposal.courseId)
  ) {
    return { ok: false, reason: "Proposal course scope mismatch." }
  }

  const { hash: _ignored, ...body } = proposal
  const expectedHash = createHmac("sha256", proposalSecret())
    .update(canonicalPayload(body as CoraActionProposalBody))
    .digest("hex")

  try {
    const a = Buffer.from(expectedHash, "hex")
    const b = Buffer.from(String(proposal.hash), "hex")
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: "Proposal signature invalid." }
    }
  } catch {
    return { ok: false, reason: "Proposal signature invalid." }
  }

  return { ok: true, proposal }
}

/** Marker embedded in tool results for the agent runner / chat API to extract. */
export const CORA_PROPOSAL_MARKER = "__CORA_PROPOSAL__:"

export function serializeProposalForToolResult(proposal: CoraActionProposal): string {
  return `${CORA_PROPOSAL_MARKER}${JSON.stringify(proposal)}`
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

export function extractProposalsFromToolText(text: string): {
  cleanText: string
  proposals: CoraActionProposal[]
} {
  const proposals: CoraActionProposal[] = []
  let cleanText = text
  let idx = cleanText.indexOf(CORA_PROPOSAL_MARKER)
  while (idx >= 0) {
    const jsonStart = idx + CORA_PROPOSAL_MARKER.length
    const extracted = extractJsonObjectAt(cleanText, jsonStart)
    if (!extracted) break
    try {
      const parsed = JSON.parse(extracted.json) as CoraActionProposal
      if (parsed?.actionId && parsed?.hash && parsed?.tool) {
        proposals.push(parsed)
      }
    } catch {
      /* ignore malformed */
    }
    cleanText = `${cleanText.slice(0, idx)}${cleanText.slice(extracted.end)}`.trim()
    idx = cleanText.indexOf(CORA_PROPOSAL_MARKER)
  }
  return { cleanText: cleanText.trim(), proposals }
}
