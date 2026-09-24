import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  invalidateCodebenchMenuCache,
  readCodebenchMenuCache,
  writeCodebenchMenuCache,
} from "./codebench-menu-cache"

describe("codebench menu cache", () => {
  it("returns a value written in this session", () => {
    writeCodebenchMenuCache("test:leaderboard", [{ rank: 1 }])
    assert.deepEqual(readCodebenchMenuCache("test:leaderboard"), [{ rank: 1 }])
  })

  it("drops expired values", () => {
    writeCodebenchMenuCache("test:streak", { streakDays: 2 })
    assert.equal(readCodebenchMenuCache("test:streak", -1), null)
  })

  it("clears a prefix without wiping other menus", () => {
    writeCodebenchMenuCache("faculty:assignments:P03", [1])
    writeCodebenchMenuCache("student:leaderboard:9", [2])
    invalidateCodebenchMenuCache("faculty:assignments:")
    assert.equal(readCodebenchMenuCache("faculty:assignments:P03"), null)
    assert.deepEqual(readCodebenchMenuCache("student:leaderboard:9"), [2])
    invalidateCodebenchMenuCache("student:leaderboard:")
  })
})
