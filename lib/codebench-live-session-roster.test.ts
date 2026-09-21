/**
 * Run: npx tsx --test lib/codebench-live-session-roster.test.ts
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  mergeLiveRosterIdentities,
  resolveInstructorLiveViewCode,
} from "./codebench-live-session-roster"

describe("resolveInstructorLiveViewCode", () => {
  it("prefers the student snapshot even when instructor_code is newer", () => {
    const view = resolveInstructorLiveViewCode({
      studentSnapshotCode: "int student = 1;",
      submittedCode: "int submitted = 2;",
    })
    assert.equal(view.code, "int student = 1;")
    assert.equal(view.codeSource, "live")
  })

  it("falls back to submitted work when the student has not streamed yet", () => {
    const view = resolveInstructorLiveViewCode({
      studentSnapshotCode: "   ",
      submittedCode: "int submitted = 2;",
    })
    assert.equal(view.code, "int submitted = 2;")
    assert.equal(view.codeSource, "submitted")
  })
})

describe("mergeLiveRosterIdentities", () => {
  it("keeps every enrolled student and adds snapshot joiners without dropping anyone", () => {
    const roster = mergeLiveRosterIdentities(
      [
        {
          student_db_id: 1,
          student_id: "A001",
          full_name: "Ada",
          section: "P01",
          session_code: "P01",
        },
        {
          student_db_id: 2,
          student_id: "A002",
          full_name: "Ben",
          section: "P01",
          session_code: "P01",
        },
      ],
      [
        {
          student_db_id: 2,
          student_id: "A002",
          full_name: "Ben",
          section: "P01",
          session_code: "P01",
        },
        {
          student_db_id: 99,
          student_id: "A099",
          full_name: "Cara",
          section: "P01",
          session_code: "P01",
        },
      ],
    )
    assert.equal(roster.length, 3)
    assert.deepEqual(
      roster.map((row) => row.student_db_id).sort((a, b) => a - b),
      [1, 2, 99],
    )
  })

  it("normalizes string ids from the DB driver so downstream Map lookups hit", () => {
    const roster = mergeLiveRosterIdentities(
      [
        {
          student_db_id: "7" as unknown as number,
          student_id: "A007",
          full_name: "Dee",
          section: "P01",
          session_code: "P01",
        },
      ],
      [
        {
          student_db_id: 7,
          student_id: "A007",
          full_name: "Dee",
          section: "P01",
          session_code: "P01",
        },
      ],
    )
    assert.equal(roster.length, 1)
    assert.strictEqual(roster[0].student_db_id, 7)
  })
})
