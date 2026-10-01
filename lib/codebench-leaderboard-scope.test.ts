import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { codebenchLeaderboardTermPredicateSql } from "./codebench-leaderboard-scope"

describe("codebench leaderboard term scope", () => {
  it("keeps peers on the caller's academic term", () => {
    const sql = codebenchLeaderboardTermPredicateSql(42)
    assert.match(sql, /peer_term\.academic_term_id = 42/)
    assert.match(sql, /s\.session_id/)
    assert.match(sql, /s\.deleted_at IS NULL/)
  })

  it("still drops deleted students when the caller has no term", () => {
    const sql = codebenchLeaderboardTermPredicateSql(null)
    assert.equal(sql.includes("academic_term_id"), false)
    assert.match(sql, /s\.deleted_at IS NULL/)
  })

  it("rejects a non-identifier alias", () => {
    const sql = codebenchLeaderboardTermPredicateSql(7, "s; drop")
    assert.match(sql, /peer_term\.id = s\.session_id/)
    assert.equal(sql.includes("drop"), false)
  })
})
