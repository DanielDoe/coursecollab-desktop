import { codesDifferOnlyByLayout, getCodeFromTypingReplay } from "@/lib/code-typing-consistency"
import {
  getDocumentAtTime,
  normalizeTypingReplay,
  trimTypingReplay,
  type TypingReplay,
} from "@/lib/typing-replay"

export function replayReconstructsTo(
  replay: TypingReplay | null | undefined,
  code: string | null | undefined,
): boolean {
  if (!replay) return false
  const expected = String(code ?? "")
  const reconstructed =
    replay.events.length > 0 ? getCodeFromTypingReplay(replay) : (replay.initialDocument ?? "")
  if (reconstructed == null) return false
  return codesDifferOnlyByLayout(reconstructed, expected)
}

export function selectFaithfulTypingReplay(
  raw: unknown,
  code: string | null | undefined,
): TypingReplay | null {
  const replay = normalizeTypingReplay(raw)
  if (!replay || !replayReconstructsTo(replay, code)) return null
  return replay
}

/**
 * Keep the keystroke log that actually produces `code`.
 * Prefer the longer faithful history so a remount fragment cannot replace a real session.
 * Equal length means the sliding window moved forward — take incoming.
 */
export function chooseTypingReplayForCode(input: {
  existing: TypingReplay | null | undefined
  incoming: TypingReplay | null | undefined
  code: string | null | undefined
}): TypingReplay | null {
  const incoming = input.incoming?.events?.length && replayReconstructsTo(input.incoming, input.code)
    ? input.incoming
    : null
  const existing = input.existing?.events?.length && replayReconstructsTo(input.existing, input.code)
    ? input.existing
    : null
  if (incoming && existing) {
    if (incoming.events.length !== existing.events.length) {
      return incoming.events.length > existing.events.length ? incoming : existing
    }
    return incoming
  }
  return incoming ?? existing
}

export function replayDocumentAtTime(replay: TypingReplay | null | undefined, currentMs: number): string | null {
  if (!replay?.events?.length) return null
  return getDocumentAtTime(replay, currentMs)
}

/**
 * Mid-replay shows the reconstructed keystroke buffer.
 * Once that buffer is the same program as the saved file (ignoring whitespace),
 * show the saved file so instructors see the student’s real indent/newlines.
 */
export function resolveLiveReplayDisplayCode(input: {
  liveCode: string | null | undefined
  replayDoc: string | null | undefined
  showReplayFrames: boolean
  isAtEnd?: boolean
}): string {
  const live = input.liveCode ?? ""
  if (!input.showReplayFrames || input.replayDoc == null) return live
  if (live.trim() && (input.isAtEnd || codesDifferOnlyByLayout(input.replayDoc, live))) return live
  return input.replayDoc
}

export function prepareLiveTypingReplay(raw: unknown): TypingReplay | null {
  const replay = normalizeTypingReplay(raw)
  if (!replay) return null
  return trimTypingReplay(replay)
}
