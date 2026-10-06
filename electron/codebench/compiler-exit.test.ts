/**
 * Run: npx tsx --test electron/codebench/compiler-exit.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { silentCompilerExitMessage } from "./compiler-exit"

describe("silentCompilerExitMessage", () => {
  it("explains a missing Windows compiler DLL", () => {
    assert.match(silentCompilerExitMessage(3221225781), /compiler library \(DLL\) was missing/)
    assert.match(silentCompilerExitMessage(-1073741515), /compiler library \(DLL\) was missing/)
  })

  it("explains a compiler crash", () => {
    assert.match(silentCompilerExitMessage(3221225477), /crashed/)
    assert.match(silentCompilerExitMessage(-1073741819), /crashed/)
  })

  it("explains a stop with no exit code", () => {
    assert.match(silentCompilerExitMessage(null), /stopped before it printed/)
  })

  it("includes other exit codes", () => {
    assert.match(silentCompilerExitMessage(1), /exited with code 1/)
  })
})
