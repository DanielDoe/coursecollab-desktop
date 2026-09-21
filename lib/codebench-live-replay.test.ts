/**
 * Run: npx tsx --test lib/codebench-live-replay.test.ts
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  chooseTypingReplayForCode,
  replayReconstructsTo,
  resolveLiveReplayDisplayCode,
  selectFaithfulTypingReplay,
} from "./codebench-live-replay"
import { getDocumentAtTime, trimTypingReplay, type TypingReplay } from "./typing-replay"

function replayFromTyping(text: string, initialDocument = ""): TypingReplay {
  const events: TypingReplay["events"] = []
  let offset = initialDocument.length
  for (let i = 0; i < text.length; i++) {
    events.push({ t: (i + 1) * 40, op: "i", offset, text: text[i]! })
    offset += 1
  }
  return { startTime: 1_000, initialDocument, events }
}

describe("trimTypingReplay", () => {
  it("rebases initialDocument so remaining events still rebuild the file", () => {
    const replay = replayFromTyping("hello world")
    const trimmed = trimTypingReplay(replay, 5)
    const originalFinal = getDocumentAtTime(replay, Number.POSITIVE_INFINITY)
    const trimmedFinal = getDocumentAtTime(trimmed, Number.POSITIVE_INFINITY)
    assert.equal(trimmed.events.length, 5)
    assert.equal(trimmedFinal, originalFinal)
    assert.equal(trimmed.initialDocument, "hello ")
    assert.equal(trimmedFinal, "hello world")
  })

  it("naive last-N slice without rebase does not reconstruct the file", () => {
    const replay = replayFromTyping("hello world")
    const broken: TypingReplay = {
      ...replay,
      events: replay.events.slice(-5),
    }
    const brokenFinal = getDocumentAtTime(broken, Number.POSITIVE_INFINITY)
    assert.notEqual(brokenFinal, "hello world")
  })
})

describe("replayReconstructsTo", () => {
  it("accepts a log that produces the student’s current code", () => {
    const replay = replayFromTyping("int main() { return 0; }")
    assert.equal(replayReconstructsTo(replay, "int main() { return 0; }"), true)
  })

  it("rejects a stale log that belongs to a different file", () => {
    const replay = replayFromTyping("old homework")
    assert.equal(replayReconstructsTo(replay, "int submitted = 2;"), false)
  })
})

describe("chooseTypingReplayForCode", () => {
  it("keeps the longer faithful session instead of a remount fragment", () => {
    const existing = replayFromTyping("int submitted = 2;")
    const incoming: TypingReplay = {
      startTime: 9_000,
      initialDocument: "int submitted = 2",
      events: [{ t: 10, op: "i", offset: "int submitted = 2".length, text: ";" }],
    }
    const chosen = chooseTypingReplayForCode({
      existing,
      incoming,
      code: "int submitted = 2;",
    })
    assert.equal(chosen, existing)
  })

  it("replaces a stale stored log with incoming keystrokes that match the code", () => {
    const existing = replayFromTyping("random leftover")
    const incoming = replayFromTyping("int submitted = 2;")
    const chosen = chooseTypingReplayForCode({
      existing,
      incoming,
      code: "int submitted = 2;",
    })
    assert.equal(chosen, incoming)
  })

  it("drops both logs when neither reconstructs the student’s code", () => {
    const chosen = chooseTypingReplayForCode({
      existing: replayFromTyping("aaaa"),
      incoming: replayFromTyping("bbbb"),
      code: "int submitted = 2;",
    })
    assert.equal(chosen, null)
  })
})

describe("selectFaithfulTypingReplay", () => {
  it("returns null for events that do not produce the displayed code", () => {
    const replay = replayFromTyping("stale")
    assert.equal(selectFaithfulTypingReplay(replay, "live student code"), null)
  })
})

describe("resolveLiveReplayDisplayCode", () => {
  it("keeps the saved file formatting when replay only lost whitespace", () => {
    const live = "int main() {\n    int discount;\n    return 0;\n}\n"
    const replayDoc = "int main() { int discount; return 0; }"
    assert.equal(
      resolveLiveReplayDisplayCode({ liveCode: live, replayDoc, showReplayFrames: true }),
      live,
    )
  })

  it("shows the in-progress reconstruction while the student is still typing", () => {
    const live = "int main() {\n    return 0;\n}\n"
    const replayDoc = "int main() {\n    ret"
    assert.equal(
      resolveLiveReplayDisplayCode({ liveCode: live, replayDoc, showReplayFrames: true }),
      replayDoc,
    )
  })

  it("uses the saved file at the end of the timeline even if reconstruction is messy", () => {
    const live = "int main() {\n    cin >> bill;\n    return 0;\n}\n"
    const replayDoc = "int main() { cin >> bill        return 0; }"
    assert.equal(
      resolveLiveReplayDisplayCode({ liveCode: live, replayDoc, showReplayFrames: true, isAtEnd: true }),
      live,
    )
  })
})
