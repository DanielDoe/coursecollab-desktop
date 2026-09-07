/**
 * Run: npx tsx --test lib/instructor-attendance-auth.contract.test.ts
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

function sliceFn(src: string, name: string, nextName?: string) {
  const start = src.indexOf(`export async function ${name}`)
  assert.ok(start >= 0, `missing ${name}`)
  const end = nextName ? src.indexOf(`export async function ${nextName}`, start + 1) : src.length
  return src.slice(start, end > start ? end : src.length)
}

function handlerSource(src: string, name: "GET" | "POST") {
  const start = src.indexOf(`export async function ${name}`)
  assert.ok(start >= 0, `missing ${name} handler`)
  const next = src.slice(start + 1).search(/export async function /)
  return next >= 0 ? src.slice(start, start + 1 + next) : src.slice(start)
}

describe("Attendance auth contract", () => {
  it("requireInstructorAttendanceAccess session-binds and rejects admin-header short-circuit", () => {
    const src = readRel("lib/instructor-attendance-auth.ts")
    const access = sliceFn(src, "requireInstructorAttendanceAccess", "canActorAccessAttendanceSession")
    assert.match(access, /requireInstructorSession/)
    assert.doesNotMatch(access, /if \(adminId\)/)
  })

  it("records GET, leaderboard, and mark contain requireBoundStudentCaller", () => {
    const recordsGet = handlerSource(readRel("app/api/attendance/records/route.ts"), "GET")
    const leaderboard = readRel("app/api/attendance/leaderboard/route.ts")
    const mark = readRel("app/api/attendance/mark/route.ts")
    assert.match(recordsGet, /requireBoundStudentCaller/)
    assert.match(leaderboard, /requireBoundStudentCaller/)
    assert.match(mark, /requireBoundStudentCaller/)
  })
})
