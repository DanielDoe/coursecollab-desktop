/**
 * Run: npx tsx --test lib/codebench-live-instructor-push-state.test.ts
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  knownLiveInstructorRevision,
  seedLiveInstructorPushBaseline,
  shouldApplyLiveInstructorPush,
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
})
