/**
 * Run: npx tsx --test lib/codebench-live-student-ui.test.ts
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { getCodebenchLanguage } from "./codebench-languages"
import {
  LIVE_JOIN_GRACE_MS,
  LIVE_SESSION_END_CONFIRM_MISSES,
  shouldReplaceLiveEditorBuffer,
  shouldRestoreLiveStudentCode,
  shouldTreatLiveSessionAsEnded,
  studentLiveSnapshotShouldRun,
} from "./codebench-live-student-ui"

const open = [{ assignmentId: 42, sessionId: 1, title: "Live", questionText: "", session: "P01", startedAt: "" }]

describe("shouldTreatLiveSessionAsEnded", () => {
  it("does not kick while the session is still listed", () => {
    const result = shouldTreatLiveSessionAsEnded({
      isJoined: true,
      listSupported: true,
      loading: false,
      joinGraceUntilMs: 0,
      assignmentId: 42,
      sessions: open,
      missCount: 5,
    })
    assert.equal(result.ended, false)
    assert.equal(result.nextMissCount, 0)
  })

  it("does not kick on the first empty poll", () => {
    const result = shouldTreatLiveSessionAsEnded({
      isJoined: true,
      listSupported: true,
      loading: false,
      joinGraceUntilMs: 0,
      assignmentId: 42,
      sessions: [],
      missCount: 0,
    })
    assert.equal(result.ended, false)
    assert.equal(result.nextMissCount, 1)
    assert.ok(result.nextMissCount < LIVE_SESSION_END_CONFIRM_MISSES)
  })

  it("confirms ended after consecutive misses", () => {
    const result = shouldTreatLiveSessionAsEnded({
      isJoined: true,
      listSupported: true,
      loading: false,
      joinGraceUntilMs: 0,
      assignmentId: 42,
      sessions: [],
      missCount: LIVE_SESSION_END_CONFIRM_MISSES - 1,
    })
    assert.equal(result.ended, true)
  })

  it("ignores empty polls during join grace and while loading", () => {
    const duringGrace = shouldTreatLiveSessionAsEnded({
      isJoined: true,
      listSupported: true,
      loading: false,
      joinGraceUntilMs: Date.now() + LIVE_JOIN_GRACE_MS,
      assignmentId: 42,
      sessions: [],
      missCount: 9,
    })
    assert.equal(duringGrace.ended, false)
    assert.equal(duringGrace.nextMissCount, 0)

    const whileLoading = shouldTreatLiveSessionAsEnded({
      isJoined: true,
      listSupported: true,
      loading: true,
      joinGraceUntilMs: 0,
      assignmentId: 42,
      sessions: [],
      missCount: 9,
    })
    assert.equal(whileLoading.ended, false)
    assert.equal(whileLoading.nextMissCount, 0)
  })
})

describe("studentLiveSnapshotShouldRun", () => {
  it("still streams when the live-sessions list API is unsupported (server gates the POST)", () => {
    assert.equal(
      studentLiveSnapshotShouldRun({
        liveSharing: true,
        studentId: "A001",
        classroomSubmissionId: "42",
        listSupported: false,
        sessions: [],
      }),
      true,
    )
  })

  it("keeps streaming after join even when the live-sessions list is empty", () => {
    assert.equal(
      studentLiveSnapshotShouldRun({
        liveSharing: true,
        studentId: "A001",
        classroomSubmissionId: "42",
        listSupported: true,
        sessions: [],
      }),
      true,
    )
    assert.equal(
      studentLiveSnapshotShouldRun({
        liveSharing: true,
        studentId: "A001",
        classroomSubmissionId: "42",
        listSupported: true,
        sessions: open,
      }),
      true,
    )
  })

  it("never streams without explicit sharing", () => {
    assert.equal(
      studentLiveSnapshotShouldRun({
        liveSharing: false,
        studentId: "A001",
        classroomSubmissionId: "42",
        listSupported: true,
        sessions: open,
      }),
      false,
    )
  })
})

describe("shouldReplaceLiveEditorBuffer", () => {
  it("does not replace typed work with empty or boilerplate state", () => {
    assert.equal(shouldReplaceLiveEditorBuffer("int x = 1;\n", "", "cpp"), false)
    assert.equal(
      shouldReplaceLiveEditorBuffer("int x = 1;\n", getCodebenchLanguage("cpp").defaultCode, "cpp"),
      false,
    )
  })

  it("allows a real instructor push onto local work", () => {
    assert.equal(
      shouldReplaceLiveEditorBuffer("int x = 1;\n", "int y = 2;\n", "cpp"),
      true,
    )
  })
})

describe("shouldRestoreLiveStudentCode", () => {
  it("does not replace code the student already typed", () => {
    assert.equal(
      shouldRestoreLiveStudentCode("int x = 42;\n", "#include <iostream>\nint x = 1;\n", "cpp"),
      false,
    )
  })

  it("restores saved work onto a boilerplate buffer", () => {
    assert.equal(
      shouldRestoreLiveStudentCode(getCodebenchLanguage("cpp").defaultCode, "int x = 42;\n", "cpp"),
      true,
    )
  })
})
