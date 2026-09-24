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

/**
 * Keystrokes from before `sinceMs` (epoch ms, e.g. the live session start) fold into
 * `initialDocument`, and the replay clock restarts at `sinceMs`. Without this, a snapshot
 * row reused across sessions replays (and times) every earlier session too.
 * Returns null when no keystrokes remain.
 */
export function typingReplaySince(
  replay: TypingReplay | null | undefined,
  sinceMs: number | null | undefined,
): TypingReplay | null {
  if (!replay?.events?.length) return null
  if (sinceMs == null || !Number.isFinite(sinceMs)) return replay
  const cut = sinceMs - replay.startTime
  if (cut <= 0) return replay
  const firstKept = replay.events.findIndex((event) => event.t >= cut)
  if (firstKept < 0) return null
  return {
    startTime: sinceMs,
    initialDocument: getDocumentAtTime(
      { ...replay, events: replay.events.slice(0, firstKept) },
      Number.POSITIVE_INFINITY,
    ),
    events: replay.events.slice(firstKept).map((event) => ({ ...event, t: event.t - cut })),
  }
}

/** Move a replay between client and server clocks (`offsetMs` = targetNow - sourceNow). */
export function shiftTypingReplayClock<T extends TypingReplay | null>(replay: T, offsetMs: number): T {
  if (!replay || !Number.isFinite(offsetMs) || offsetMs === 0) return replay
  return { ...replay, startTime: replay.startTime + offsetMs }
}

export function prepareLiveTypingReplay(raw: unknown): TypingReplay | null {
  const replay = normalizeTypingReplay(raw)
  if (!replay) return null
  return trimTypingReplay(replay)
}
