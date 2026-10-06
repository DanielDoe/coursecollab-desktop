import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  playgroundSessionDisplayLabel,
  studentMayEnterPlaygroundLobby,
} from "./playground-open-lobby"

describe("playground lobby access", () => {
  it("labels a session from the part title", () => {
    assert.equal(
      playgroundSessionDisplayLabel(
        ["Performing repetitions — Part 1 (ELEG1301P01)", "Performing Repetitions: Loops"],
        "P135",
      ),
      "Performing repetitions — Part 1 (ELEG1301P01)",
    )
  })

  it("admits only the section locked on the lobby", () => {
    assert.equal(
      studentMayEnterPlaygroundLobby({
        allowedSessions: [505],
        playgroundCourseId: 5,
        studentSessionId: 505,
        studentCourseId: 5,
      }),
      true,
    )
    assert.equal(
      studentMayEnterPlaygroundLobby({
        allowedSessions: [505],
        playgroundCourseId: 5,
        studentSessionId: 506,
        studentCourseId: 5,
      }),
      false,
    )
  })

  it("keeps an unrestricted lobby on the same course", () => {
    assert.equal(
      studentMayEnterPlaygroundLobby({
        allowedSessions: null,
        playgroundCourseId: 5,
        studentSessionId: 506,
        studentCourseId: 5,
      }),
      true,
    )
    assert.equal(
      studentMayEnterPlaygroundLobby({
        allowedSessions: [],
        playgroundCourseId: 6,
        studentSessionId: 506,
        studentCourseId: 5,
      }),
      false,
    )
  })
})
