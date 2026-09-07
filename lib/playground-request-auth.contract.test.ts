/**
 * Run: npx tsx --test lib/playground-request-auth.contract.test.ts
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, "..")

function readRel(rel: string) {
  return readFileSync(join(repo, rel), "utf8")
}

describe("Playground request auth contract", () => {
  it("admin start requires instructor session and does not end every CLASSROOM session", () => {
    const start = readRel("app/api/playground/admin/start/route.ts")
    assert.match(start, /requireInstructorSession/)
    assert.match(start, /resolvePlaygroundClassroomInstructorScopeSql/)
    assert.doesNotMatch(
      start,
      /WHERE mode = 'CLASSROOM' AND is_active = true\s*`/,
    )
    assert.match(start, /instructor_id|course_id|psScope/)
  })

  it("credits and join bind requireBoundStudentCaller before lookups", () => {
    const credits = readRel("app/api/playground/credits/route.ts")
    assert.match(credits, /requireBoundStudentCaller/)
    const creditsGet = credits.slice(credits.indexOf("export async function GET"))
    const bindCredits = creditsGet.indexOf("requireBoundStudentCaller")
    const lookupCredits = creditsGet.indexOf("getPlaygroundCredits")
    assert.ok(bindCredits >= 0, "missing requireBoundStudentCaller in credits GET")
    assert.ok(lookupCredits > bindCredits, "credits lookup must run after requireBoundStudentCaller")

    const join = readRel("app/api/playground/join/route.ts")
    assert.match(join, /requireBoundStudentCaller/)
    const joinPost = join.slice(join.indexOf("export async function POST"))
    const bindJoin = joinPost.indexOf("requireBoundStudentCaller")
    const passcodeLookup = joinPost.search(/Invalid passcode|join_passcode/)
    assert.ok(bindJoin >= 0, "missing requireBoundStudentCaller in join POST")
    assert.ok(passcodeLookup > bindJoin, "passcode lookup must run after requireBoundStudentCaller")
  })
})
