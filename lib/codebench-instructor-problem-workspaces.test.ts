/**
 * Run: npx tsx --test lib/codebench-instructor-problem-workspaces.test.ts
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { getCodebenchLanguage } from "./codebench-languages"
import {
  bufferHasUserCode,
  shouldKeepInstructorWorkspace,
} from "./codebench-instructor-problem-workspaces"

describe("shouldKeepInstructorWorkspace", () => {
  it("keeps a workspace that already has code when the live assignment is still a blank template", () => {
    assert.equal(
      shouldKeepInstructorWorkspace({
        currentProjectId: "proj_personal",
        currentHasUserCode: true,
        destinationProjectId: "iproblem_classroom_600",
        destinationHasUserCode: false,
      }),
      true,
    )
  })

  it("opens an assignment the instructor has already worked on", () => {
    assert.equal(
      shouldKeepInstructorWorkspace({
        currentProjectId: "proj_personal",
        currentHasUserCode: true,
        destinationProjectId: "iproblem_classroom_600",
        destinationHasUserCode: true,
      }),
      false,
    )
  })

  it("does not treat the template as code worth protecting", () => {
    assert.equal(bufferHasUserCode(getCodebenchLanguage("cpp").defaultCode, "cpp"), false)
    assert.equal(bufferHasUserCode("int row = 1;\n", "cpp"), true)
  })
})
