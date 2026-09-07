import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  classroomPointsLeaderboardForCurrentOffering,
  classroomPointsLeaderboardHasAwards,
} from "./classroom-points-leaderboard-scope"

const FALL_2026 = ["ELEG1301P01", "ELEG1301P02", "ELEG1304P03"] as const

function row(partial: Record<string, unknown> = {}) {
  return {
    rank: 1,
    full_name: "Daniel Doe",
    total_points: 0,
    award_count: 0,
    ...partial,
  }
}

describe("classroom points leaderboard scope", () => {
  it("treats a 0-pt Fall 2026 roster as no standings", () => {
    const rows = [row(), row({ rank: 2 }), row({ rank: 8 })]
    assert.equal(classroomPointsLeaderboardHasAwards(rows), false)
    for (const section of FALL_2026) {
      assert.deepEqual(classroomPointsLeaderboardForCurrentOffering(rows, { section }), [])
    }
  })

  it("keeps rows after approved points this offering", () => {
    const rows = [row({ total_points: 12, session: "ELEG1301P01" })]
    assert.equal(classroomPointsLeaderboardForCurrentOffering(rows, { section: "ELEG1301P01" }).length, 1)
  })
})
