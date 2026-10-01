/**
 * Run: npx tsx --test lib/codebench-analytics-read.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildStudioSnapshot } from "@/lib/codebench-studio-analytics"
import { buildCodebenchCoraRead, buildStudentCodingInsight } from "@/lib/codebench-analytics-read"

const emptyPerf = {
  submissionCount: 0,
  avgScore: 0,
  approvedCount: 0,
  xpEarned: 0,
  streakDays: 0,
  sourceCounts: { codebench: 0, practice: 0, challenge: 0 },
  recent: [],
}

describe("buildCodebenchCoraRead", () => {
  it("does not invent concept scores or JavaScript starter copy when there is no work", () => {
    const read = buildCodebenchCoraRead(emptyPerf, buildStudioSnapshot([]))
    assert.equal(read.level, "New")
    assert.equal(read.proficiencyScore, 0)
    assert.match(read.overview, /Nothing recorded/)
    assert.doesNotMatch(read.overview, /JavaScript|main\(\)|Beginner/)
    assert.equal(read.strengths.length, 0)
    assert.ok(read.workshopBars.every((bar) => bar.value === 0))
  })

  it("names the real clang fault and file, not a template story", () => {
    const studio = buildStudioSnapshot([
      {
        id: "1",
        at: Date.now(),
        type: "run",
        language: "cpp",
        fileName: "campus_gpa_calculator.cpp",
      },
      {
        id: "2",
        at: Date.now(),
        type: "compile_error",
        language: "cpp",
        fileName: "campus_gpa_calculator.cpp",
        errorFamily: "missing-semicolon",
        errorMessage: "expected ';' after expression",
      },
      {
        id: "3",
        at: Date.now(),
        type: "suggest_fix",
      },
    ])
    const read = buildCodebenchCoraRead(
      {
        ...emptyPerf,
        submissionCount: 1,
        avgScore: 0,
        sourceCounts: { codebench: 0, practice: 0, challenge: 1 },
        recent: [{ title: "Count Balanced Prefixes", score: 0, status: "pending", source: "challenge" }],
      },
      studio,
    )
    assert.match(read.overview, /campus_gpa_calculator\.cpp/)
    assert.match(read.overview, /missing semicolon/i)
    assert.doesNotMatch(read.overview, /JavaScript|starter workflow|template/)
    assert.ok(read.weaknesses.some((w) => /Missing semicolon/i.test(w)))
    assert.ok(read.weaknesses.some((w) => /Count Balanced Prefixes scored 0/.test(w)))
    assert.ok(read.strengths.some((s) => /Suggest fix/.test(s)))
    assert.ok(!read.tasks.some((t) => /90 min|study time|Loops|Pointers/.test(t)))
    const insight = buildStudentCodingInsight(studio, {
      ...emptyPerf,
      submissionCount: 1,
      recent: [{ title: "Count Balanced Prefixes", score: 0, status: "pending", source: "challenge" }],
    })
    assert.match(insight.summary, /missing semicolon/i)
    assert.equal(insight.problemTitle, "Missing semicolon")
    assert.match(insight.compilerNote ?? "", /expected ';'/i)
    assert.ok(insight.improve.length > 0)
    assert.ok(insight.watchOuts.some((item) => /watch out for missing semicolon/i.test(item)))
    assert.ok(insight.strengths.some((item) => /running your code/i.test(item)))
    assert.equal(studio.runRows.filter((row) => row.outcome === "error").length, 1)
    assert.equal(studio.runRows[0]?.title, "Missing semicolon")
  })
})
