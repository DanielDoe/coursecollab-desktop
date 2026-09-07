/**
 * Align displayed code with typing replay: stored `answer_data.code` / `selected_answer`
 * can drift from the editor final state (save race, template overwrite).
 *
 * **Substantive drift** (template vs real code, empty vs filled): prefer replay.
 * **Layout-only** (whitespace / newlines / indentation): treat as equivalent — keep the
 * saved snapshot, no mismatch warning, and do not show instructor side-by-side alert.
 */

import { isCodeAnswerCorrupt } from "@/lib/code-answer-validation"
import { getDocumentAtTime, type TypingReplay } from "@/lib/typing-replay"

function normText(s: string): string {
  return s.replace(/\r\n/g, "\n").trim()
}

/**
 * Collapses all whitespace (including newlines) to single spaces for comparison.
 * Treats `cout` + newline + `}` vs `cout }` as equivalent — not a "real" drift.
 */
export function normCodeLayoutInsensitive(s: string): string {
  return String(s ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim()
}

/** True when the only differences are whitespace / line breaks / indentation. */
export function codesDifferOnlyByLayout(a: string | null | undefined, b: string | null | undefined): boolean {
  return normCodeLayoutInsensitive(a ?? "") === normCodeLayoutInsensitive(b ?? "")
}

export interface CodeTypingResolution {
  /** Code to show in instructor/student UI */
  displayCode: string
  /** True when stored code text !== replay final document (after normalize) */
  mismatchWarning: boolean
}

/**
 * Resolve which code string to display when both DB-stored code and typing_replay exist.
 * Prefers replay's final document when replay has events and the result is non-empty and
 * not more corrupt than stored — fixes "shows template but replay has real typing" cases.
 */
export function resolveCodeDisplayWithTypingReplay(opts: {
  storedCode: string | null | undefined
  typingReplay: TypingReplay | null | undefined
}): CodeTypingResolution {
  const stored = opts.storedCode != null ? String(opts.storedCode) : ""
  const replay = opts.typingReplay
  if (!replay?.events?.length) {
    return { displayCode: stored, mismatchWarning: false }
  }

  const lastT = Math.max(...replay.events.map((e) => e.t), 0)
  const fromReplay = getDocumentAtTime(replay, lastT + 1000)
  const nd = normText(fromReplay)
  if (!nd) {
    return { displayCode: stored, mismatchWarning: false }
  }

  const ns = normText(stored)

  // Same program text, different formatting — keep DB snapshot; no warning
  if (codesDifferOnlyByLayout(stored, fromReplay)) {
    return { displayCode: stored, mismatchWarning: false }
  }

  const significantMismatch = !codesDifferOnlyByLayout(stored, fromReplay)

  // Replay looks like MCQ garbage but stored looks like code — keep stored
  if (isCodeAnswerCorrupt(fromReplay) && !isCodeAnswerCorrupt(stored) && ns.length > 0) {
    return { displayCode: stored, mismatchWarning: significantMismatch }
  }

  // Authoritative: real content drift (e.g. template in DB vs typed solution in replay)
  return { displayCode: fromReplay, mismatchWarning: significantMismatch }
}

/** Final document from typing replay at end of session, or null if no usable replay. */
export function getCodeFromTypingReplay(typingReplay: TypingReplay | null | undefined): string | null {
  if (!typingReplay?.events?.length) return null
  const lastT = Math.max(...typingReplay.events.map((e) => e.t), 0)
  const doc = getDocumentAtTime(typingReplay, lastT + 1000)
  return doc.trim() ? doc : null
}

/** For instructor review: raw DB snapshot vs replay reconstruction (side-by-side). */
export function getDualCodeComparison(opts: {
  storedCode: string | null | undefined
  typingReplay: TypingReplay | null | undefined
}): {
  savedCode: string
  fromTypingReplay: string | null
  mismatch: boolean
} {
  const saved = opts.storedCode != null ? String(opts.storedCode) : ""
  const fromTypingReplay = getCodeFromTypingReplay(opts.typingReplay)
  const mismatch =
    fromTypingReplay != null && !codesDifferOnlyByLayout(saved, fromTypingReplay)
  return { savedCode: saved, fromTypingReplay, mismatch }
}
