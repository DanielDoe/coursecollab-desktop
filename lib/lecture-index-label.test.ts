/**
 * Run: npx tsx --test lib/lecture-index-label.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  dedupeElegSharedLectureRows,
  formatElegLectureDisplayTitle,
  normalizeLectureDedupeKey,
} from "@/lib/lecture-index-label"

describe("lecture display + dedupe", () => {
  it("rewrites ELEG 130X to scoped catalog digits", () => {
    assert.equal(
      formatElegLectureDisplayTitle("ELEG 130X: Lecture 1 — Intro", "ELEG1301"),
      "ELEG 1301: Lecture 1 — Intro",
    )
    assert.equal(
      formatElegLectureDisplayTitle("ELEG 130X: Lecture 1 — Intro", "ELEG1304P03"),
      "ELEG 1304: Lecture 1 — Intro",
    )
  })

  it("dedupes shared ELEG rows by week + title", () => {
    const rows = [
      { id: 10, week: 1, title: "ELEG 130X: Lecture 1 — Intro", course_id: 5, session: null },
      { id: 11, week: 1, title: "ELEG 130X: Lecture 1 — Intro", course_id: 6, session: null },
      { id: 12, week: 2, title: "ELEG 130X: Lecture 2 — Basics", course_id: 5, session: null },
      { id: 13, week: 2, title: "ELEG 130X: Lecture 2 — Basics", course_id: 6, session: null },
    ]
    const out = dedupeElegSharedLectureRows(rows, 5)
    assert.equal(out.length, 2)
    assert.equal(out[0].id, 10)
    assert.equal(out[1].id, 12)
  })

  it("normalizes dedupe keys across 130X and 1301 prefixes", () => {
    assert.equal(
      normalizeLectureDedupeKey("ELEG 130X: Lecture 1 — Intro"),
      normalizeLectureDedupeKey("ELEG 1301: Lecture 1 — Intro"),
    )
  })
})
