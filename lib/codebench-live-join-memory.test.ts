/**
 * Run: npx tsx --test lib/codebench-live-join-memory.test.ts
 */
import { beforeEach, describe, it } from "node:test"
import assert from "node:assert/strict"
import { editorHoldsOtherLiveAssignment, rememberLiveSyncedCode } from "./codebench-live-join-memory"

function installSessionStorage() {
  const store = new Map<string, string>()
  ;(globalThis as { window?: unknown }).window = {
    sessionStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  }
}

describe("editorHoldsOtherLiveAssignment", () => {
  beforeEach(installSessionStorage)

  it("detects code synced to a different assignment", () => {
    rememberLiveSyncedCode("7", "788", "int a = 1;\n")
    assert.equal(editorHoldsOtherLiveAssignment("7", "796", "int a = 1;"), true)
  })

  it("ignores the same assignment", () => {
    rememberLiveSyncedCode("7", "796", "int a = 1;\n")
    assert.equal(editorHoldsOtherLiveAssignment("7", "796", "int a = 1;\n"), false)
  })

  it("ignores edits made since the last sync", () => {
    rememberLiveSyncedCode("7", "788", "int a = 1;\n")
    assert.equal(editorHoldsOtherLiveAssignment("7", "796", "int a = 2;\n"), false)
  })

  it("ignores another student's record", () => {
    rememberLiveSyncedCode("8", "788", "int a = 1;\n")
    assert.equal(editorHoldsOtherLiveAssignment("7", "796", "int a = 1;\n"), false)
  })
})
