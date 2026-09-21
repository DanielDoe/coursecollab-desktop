/**
 * Typing replay types and utilities for code write anti-cheat.
 * Records how code was written over time to detect pasting (large chunks appearing suddenly).
 */

export interface TypingReplayEvent {
  /** Milliseconds since replay start */
  t: number
  /** 'i' = insert, 'd' = delete */
  op: "i" | "d"
  /** Character offset in document */
  offset: number
  /** For insert: text inserted. For delete: length of deleted segment (stored as number in JSON) */
  text: string
  /** For delete: number of chars removed (text may be empty) */
  len?: number
}

export interface TypingReplay {
  /** Timestamp when first edit occurred */
  startTime: number
  /** Ordered list of edit events */
  events: TypingReplayEvent[]
  /** Pre-filled template (Trailblazer) or empty string (Scholar) - document state when recording started */
  initialDocument?: string
}

/** Threshold: chars inserted in under this many ms = suspicious (possible paste) */
export const PASTE_SUSPICION_MS = 500
/** Threshold: more than this many chars in one burst = flag */
export const PASTE_SUSPICION_CHARS = 30
/** Min time (ms) expected for substantial code - shorter = suspicious */
export const MIN_EXPECTED_TIME_MS = 30_000
/** Min chars to consider "substantial" for time check */
export const SUBSTANTIAL_CODE_CHARS = 100

/**
 * Known initial templates that appear when the editor loads (e.g. Trailblazer C++ template).
 * These should NOT be flagged as suspicious - they're provided by the system, not pasted.
 */
const KNOWN_INITIAL_TEMPLATES = [
  // Trailblazer C++ template (quiz-taker, quiz-results)
  `#include <iostream>\nusing namespace std;\n\nint main() {\n    //Your code goes in here....\n    return 0;\n}`,
  // With blank line before return (227 chars)
  `#include <iostream>\nusing namespace std;\n\nint main() {\n    //Your code goes in here....\n    \n    return 0;\n}`,
  // CodeBench default (slight variation: "here" vs "in here")
  `#include <iostream>\nusing namespace std;\n\nint main() {\n    //Your code goes here....\n    return 0;\n}`,
  // Hello World template (legacy)
  `#include <iostream>\nusing namespace std;\n\nint main() {\n    // Start your code here\n    cout << "Hello, world!" << endl;\n    return 0;\n}`,
  // MATLAB template
  `% MATLAB Script\n% Start your code here\n\ndisp('Hello, MATLAB!');\n`,
]

function normalizeForTemplateCompare(s: string): string {
  return s.trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n")
}

export function isKnownInitialTemplate(content: string): boolean {
  if (!content || content.length < 50) return false
  const n = normalizeForTemplateCompare(content)
  if (KNOWN_INITIAL_TEMPLATES.some((t) => normalizeForTemplateCompare(t) === n)) return true
  // Relaxed: C++ template-like (Trailblazer/Scholar boilerplate) - ~100–250 chars
  if (n.length >= 100 && n.length <= 280) {
    const hasCppBoilerplate =
      n.includes("#include <iostream>") &&
      n.includes("using namespace std") &&
      n.includes("int main()") &&
      (n.includes("//Your code goes in here") || n.includes("//Your code goes here") || n.includes("// Start your code here"))
    if (hasCppBoilerplate) return true
  }
  // MATLAB template-like
  if (n.includes("% MATLAB Script") && n.includes("disp(")) return true
  return false
}

/**
 * Get total time spent writing (ms from first to last edit).
 */
export function getTimeSpentMs(replay: TypingReplay | null | undefined): number {
  if (!replay?.events?.length) return 0
  const times = replay.events.map((e) => e.t)
  return Math.max(0, Math.max(...times) - Math.min(...times))
}

/**
 * Get final document length after all events.
 */
export function getFinalDocumentLength(replay: TypingReplay | null | undefined): number {
  if (!replay?.events?.length) return (replay?.initialDocument ?? "").length
  const lastT = Math.max(...replay.events.map((e) => e.t))
  return getDocumentAtTime(replay, lastT + 1).length
}

/**
 * Analyze replay for suspicious patterns (large pastes, very short time).
 * Returns { flagged: boolean, suspicionReasons: string[] }
 */
export function analyzeReplayForSuspicion(replay: TypingReplay | null | undefined): {
  flagged: boolean
  suspicionReasons: string[]
} {
  const reasons: string[] = []
  if (!replay?.events?.length) return { flagged: false, suspicionReasons: [] }

  const events = replay.events
  let maxBurstChars = 0
  let maxBurstMs = 0
  let burstStart = 0
  let burstChars = 0

  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    if (e.op === "i" && e.text.length > 0) {
      if (burstChars === 0) burstStart = e.t
      burstChars += e.text.length
      const elapsed = e.t - burstStart
      if (elapsed <= PASTE_SUSPICION_MS && burstChars > PASTE_SUSPICION_CHARS) {
        maxBurstChars = Math.max(maxBurstChars, burstChars)
        maxBurstMs = Math.max(maxBurstMs, elapsed)
      }
    } else {
      burstChars = 0
    }
  }

  // Also check: total chars in any 500ms window
  for (let i = 0; i < events.length; i++) {
    const windowStart = events[i].t
    let windowChars = 0
    for (let j = i; j < events.length && events[j].t - windowStart <= PASTE_SUSPICION_MS; j++) {
      if (events[j].op === "i") windowChars += events[j].text.length
    }
    if (windowChars > PASTE_SUSPICION_CHARS) {
      maxBurstChars = Math.max(maxBurstChars, windowChars)
    }
  }

  if (maxBurstChars >= PASTE_SUSPICION_CHARS) {
    // Exception: Trailblazer C++ template (and similar) - appears when editor loads or on reset, not a paste
    let isTemplate = false

    // Find the burst window: first window with >30 chars
    let burstWindowEnd = 0
    for (let i = 0; i < events.length; i++) {
      const t0 = events[i].t
      let total = 0
      for (let j = i; j < events.length && events[j].t - t0 <= PASTE_SUSPICION_MS; j++) {
        if (events[j].op === "i") total += (events[j].text || "").length
      }
      if (total >= maxBurstChars) {
        burstWindowEnd = t0 + PASTE_SUSPICION_MS + 50
        break
      }
    }

    // Check document at end of burst - if it's template-like, skip flagging
    if (maxBurstChars >= 200 && maxBurstChars <= 260) {
      const docAtBurst = getDocumentAtTime(replay, burstWindowEnd || 3000)
      if (
        docAtBurst.includes("#include <iostream>") &&
        docAtBurst.includes("using namespace std") &&
        docAtBurst.includes("int main()") &&
        (docAtBurst.includes("//Your code goes") || docAtBurst.includes("// Start your code"))
      ) {
        isTemplate = true
      }
    }

    // Also check: first large insert is template (single-event load)
    const firstLargeInsert = events.find((e) => e.op === "i" && (e.text || "").length >= 100)
    if (!isTemplate && firstLargeInsert && firstLargeInsert.t < 3000) {
      isTemplate = isKnownInitialTemplate(firstLargeInsert.text)
    }

    if (!isTemplate) {
      reasons.push(
        `Large text block (${maxBurstChars} chars) appeared in under ${PASTE_SUSPICION_MS}ms - possible copy/paste`
      )
    }
  }

  // Very short time for substantial code = suspicious (unless it's template + minimal edits)
  const timeSpentMs = getTimeSpentMs(replay)
  const finalLen = getFinalDocumentLength(replay)
  const finalDoc = getDocumentAtTime(replay, Math.max(...events.map((e) => e.t), 0) + 1000)
  const hasTemplateBoilerplate =
    finalDoc.includes("#include <iostream>") &&
    finalDoc.includes("using namespace std") &&
    finalDoc.includes("//Your code goes")
  const isTemplateLike =
    isKnownInitialTemplate(finalDoc) ||
    (hasTemplateBoilerplate && finalLen <= 300)
  if (
    finalLen >= SUBSTANTIAL_CODE_CHARS &&
    timeSpentMs < MIN_EXPECTED_TIME_MS &&
    !isTemplateLike
  ) {
    const sec = Math.round(timeSpentMs / 1000)
    reasons.push(
      `Very short time (${sec}s) for ${finalLen} chars of code - possible copy/paste or external help`
    )
  }

  return {
    flagged: reasons.length > 0,
    suspicionReasons: reasons,
  }
}

/**
 * Replay events to reconstruct document at a given time (ms since start).
 * For Trailblazer: starts with initialDocument (pre-filled template); for Scholar: starts empty.
 * This ensures playback shows the template from t=0, then student edits - no false "paste" flag.
 */
export function getDocumentAtTime(
  replay: TypingReplay | null | undefined,
  targetMs: number
): string {
  let doc = replay?.initialDocument ?? ""
  if (!replay?.events?.length) return doc
  for (const e of replay.events) {
    if (e.t > targetMs) break
    if (e.op === "i") {
      doc = doc.slice(0, e.offset) + e.text + doc.slice(e.offset)
    } else {
      const delLen = e.len ?? e.text.length
      doc = doc.slice(0, e.offset) + doc.slice(e.offset + delLen)
    }
  }
  return doc
}

/** Sliding window for live classroom keystroke logs. Trim must rebase `initialDocument`. */
export const MAX_LIVE_REPLAY_EVENTS = 800

export function normalizeTypingReplay(raw: unknown): TypingReplay | null {
  if (!raw || typeof raw !== "object") return null
  const replay = raw as {
    startTime?: unknown
    events?: unknown
    initialDocument?: unknown
  }
  if (!Array.isArray(replay.events) || replay.events.length === 0) return null
  const events: TypingReplayEvent[] = []
  for (const item of replay.events) {
    if (!item || typeof item !== "object") continue
    const event = item as {
      t?: unknown
      op?: unknown
      offset?: unknown
      text?: unknown
      len?: unknown
    }
    if (event.op !== "i" && event.op !== "d") continue
    if (typeof event.t !== "number" || !Number.isFinite(event.t)) continue
    if (typeof event.offset !== "number" || !Number.isFinite(event.offset)) continue
    events.push({
      t: Math.max(0, event.t),
      op: event.op,
      offset: Math.max(0, Math.trunc(event.offset)),
      text: typeof event.text === "string" ? event.text : "",
      len: typeof event.len === "number" && Number.isFinite(event.len) ? Math.max(0, Math.trunc(event.len)) : undefined,
    })
  }
  if (events.length === 0) return null
  return {
    startTime: typeof replay.startTime === "number" && Number.isFinite(replay.startTime) ? replay.startTime : 0,
    initialDocument: typeof replay.initialDocument === "string" ? replay.initialDocument : "",
    events,
  }
}

/**
 * Drop the oldest events without breaking playback: apply them into `initialDocument`
 * so the remaining inserts/deletes still reconstruct the same file.
 */
export function trimTypingReplay(
  replay: TypingReplay,
  maxEvents = MAX_LIVE_REPLAY_EVENTS,
): TypingReplay {
  if (replay.events.length <= maxEvents) return replay
  const dropped = replay.events.slice(0, replay.events.length - maxEvents)
  const kept = replay.events.slice(-maxEvents)
  const initialDocument = getDocumentAtTime(
    { ...replay, events: dropped },
    Number.POSITIVE_INFINITY,
  )
  const t0 = kept[0]?.t ?? 0
  return {
    startTime: replay.startTime + t0,
    initialDocument,
    events: kept.map((event) => ({ ...event, t: Math.max(0, event.t - t0) })),
  }
}
