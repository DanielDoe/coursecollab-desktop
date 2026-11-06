/**
 * Run: npx tsx --test lib/codebench-live-instructor-push-state.test.ts
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  joinBaselineForInstructorPush,
  knownLiveInstructorRevision,
  seedLiveInstructorPushBaseline,
  shouldApplyLiveInstructorPush,
  studentSnapshotCodeAfterInstructorPush,
} from "./codebench-live-instructor-push-state"

const memory = new Map<string, string>()

const fakeStorage: Storage = {
  get length() {
    return memory.size
  },
  clear() {
    memory.clear()
  },
  getItem(key) {
    return memory.get(key) ?? null
  },
  key() {
    return null
  },
  removeItem(key) {
    memory.delete(key)
  },
  setItem(key, value) {
    memory.set(key, value)
  },
}

describe("shouldApplyLiveInstructorPush", () => {
  it("does not replay the revision already on the snapshot at join", () => {
    assert.equal(
      shouldApplyLiveInstructorPush({ revision: 4, baselineRevision: 4, appliedRevision: 0 }),
      false,
    )
  })

  it("applies only instructor edits after the join baseline", () => {
    assert.equal(
      shouldApplyLiveInstructorPush({ revision: 5, baselineRevision: 4, appliedRevision: 4 }),
      true,
    )
  })

  it("ignores revisions already applied locally", () => {
    assert.equal(
      shouldApplyLiveInstructorPush({ revision: 5, baselineRevision: 4, appliedRevision: 5 }),
      false,
    )
  })
})

describe("joinBaselineForInstructorPush", () => {
  const now = Date.parse("2026-10-20T18:46:16.000Z")

  it("leaves a push that just arrived eligible to apply", () => {
    assert.equal(
      joinBaselineForInstructorPush({
        serverRevision: 4,
        pushedAt: "2026-10-20T18:45:55.000Z",
        now,
      }),
      3,
    )
  })

  it("marks an older push as already seen", () => {
    assert.equal(
      joinBaselineForInstructorPush({
        serverRevision: 4,
        pushedAt: "2026-10-20T18:30:00.000Z",
        now,
      }),
      4,
    )
  })

  it("does not replay a push with no timestamp", () => {
    assert.equal(joinBaselineForInstructorPush({ serverRevision: 4, pushedAt: null, now }), 4)
  })
})

describe("studentSnapshotCodeAfterInstructorPush", () => {
  const now = Date.parse("2026-10-20T18:46:20.000Z")
  const fresh = "2026-10-20T18:46:16.000Z"

  it("keeps the sent edit when the snapshot is still the pre-send buffer", () => {
    assert.equal(
      studentSnapshotCodeAfterInstructorPush({
        storedCode: "sent",
        incomingCode: "old",
        instructorCode: "sent",
        preInstructorCode: "old",
        instructorUpdatedAt: fresh,
        now,
      }),
      "sent",
    )
  })

  it("accepts the student's next edit", () => {
    assert.equal(
      studentSnapshotCodeAfterInstructorPush({
        storedCode: "sent",
        incomingCode: "sent-and-typed",
        instructorCode: "sent",
        preInstructorCode: "old",
        instructorUpdatedAt: fresh,
        now,
      }),
      "sent-and-typed",
    )
  })

  it("does not let a late copy of the old buffer replace work the student already continued", () => {
    assert.equal(
      studentSnapshotCodeAfterInstructorPush({
        storedCode: "sent-and-typed",
        incomingCode: "old",
        instructorCode: "sent",
        preInstructorCode: "old",
        instructorUpdatedAt: fresh,
        now,
      }),
      "sent-and-typed",
    )
  })

  it("accepts the old buffer once the send is no longer fresh", () => {
    assert.equal(
      studentSnapshotCodeAfterInstructorPush({
        storedCode: "sent",
        incomingCode: "old",
        instructorCode: "sent",
        preInstructorCode: "old",
        instructorUpdatedAt: "2026-10-20T18:40:00.000Z",
        now,
      }),
      "old",
    )
  })
})

describe("seedLiveInstructorPushBaseline", () => {
  it("records the server revision so catch-up cannot overwrite student code", () => {
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: fakeStorage,
    })
    memory.clear()
    const stored = seedLiveInstructorPushBaseline("stu-1", "42", 7)
    assert.equal(stored, 7)
    assert.equal(knownLiveInstructorRevision("stu-1", "42"), 7)
    assert.equal(
      shouldApplyLiveInstructorPush({
        revision: 7,
        baselineRevision: knownLiveInstructorRevision("stu-1", "42"),
        appliedRevision: 0,
      }),
      false,
    )
  })

  it("can lower a placeholder baseline so a fresh push is applied after rejoin", () => {
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: fakeStorage,
    })
    memory.clear()
    seedLiveInstructorPushBaseline("stu-1", "42", 4)
    const lowered = seedLiveInstructorPushBaseline("stu-1", "42", 3, { allowLower: true })
    assert.equal(lowered, 3)
    assert.equal(
      shouldApplyLiveInstructorPush({
        revision: 4,
        baselineRevision: knownLiveInstructorRevision("stu-1", "42"),
        appliedRevision: 0,
      }),
      true,
    )
  })
})
