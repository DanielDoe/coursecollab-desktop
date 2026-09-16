import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  applyTimingBoosterBackfill,
  CLASSROOM_BASE_POINTS,
  getTimingBoosterSinceOpened,
  resolveClassroomSubmissionBooster,
} from "./classroom-point-booster"

describe("classroom timing booster (time since assignment opened)", () => {
  const opened = "2026-09-09T06:00:00.000Z"

  it("awards x3 within 24 hours of creation", () => {
    assert.equal(getTimingBoosterSinceOpened(opened, "2026-09-09T18:00:00.000Z"), 3)
    assert.equal(getTimingBoosterSinceOpened(opened, "2026-09-10T06:00:00.000Z"), 3)
  })

  it("awards x2 the next day (24–48 hours after creation)", () => {
    assert.equal(getTimingBoosterSinceOpened(opened, "2026-09-10T06:00:01.000Z"), 2)
    assert.equal(getTimingBoosterSinceOpened(opened, "2026-09-11T06:00:00.000Z"), 2)
  })

  it("awards x1 after 48 hours", () => {
    assert.equal(getTimingBoosterSinceOpened(opened, "2026-09-11T06:00:01.000Z"), 1)
    assert.equal(getTimingBoosterSinceOpened(opened, "2026-09-16T06:00:00.000Z"), 1)
  })

  it("does not use hours-until-deadline", () => {
    const farDeadline = "2026-09-16T06:00:00.000Z"
    assert.equal(
      resolveClassroomSubmissionBooster({
        openedAt: opened,
        deadline: farDeadline,
        submittedAt: "2026-09-09T08:00:00.000Z",
      }),
      3,
    )
  })

  it("backfills unboosted 2.5 to 7.5 when same-day", () => {
    const result = applyTimingBoosterBackfill({
      storedPoints: CLASSROOM_BASE_POINTS,
      storedBooster: 1,
      nextBooster: 3,
    })
    assert.equal(result.points, 7.5)
    assert.equal(result.booster, 3)
    assert.equal(result.changed, true)
  })

  it("never lowers an existing award", () => {
    const result = applyTimingBoosterBackfill({
      storedPoints: 7.5,
      storedBooster: 3,
      nextBooster: 1,
    })
    assert.equal(result.points, 7.5)
    assert.equal(result.booster, 3)
    assert.equal(result.changed, false)
  })
})
