/**
 * Run: npx tsx --test lib/calendar-auth.contract.test.ts
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, "..")

const STUDENT_AUTH = /requireBoundStudentCaller|requireCallerStudentDbId/

const ROUTES = [
  "app/api/calendar/events/route.ts",
  "app/api/calendar/goals/route.ts",
  "app/api/calendar/study-plan/route.ts",
] as const

function readRel(rel: string) {
  return readFileSync(join(repo, rel), "utf8")
}

function handlerSource(src: string, name: "GET" | "POST" | "PUT" | "DELETE") {
  const start = src.indexOf(`export async function ${name}`)
  assert.ok(start >= 0, `missing ${name} handler`)
  const next = src.slice(start + 1).search(/export async function /)
  return next >= 0 ? src.slice(start, start + 1 + next) : src.slice(start)
}

describe("Calendar student auth contract", () => {
  for (const rel of ROUTES) {
    it(`${rel} binds the student caller session`, () => {
      assert.match(readRel(rel), STUDENT_AUTH)
    })
  }

  it("events GET queries auth.studentDbId after bind, not raw searchParams studentId", () => {
    const get = handlerSource(readRel("app/api/calendar/events/route.ts"), "GET")
    assert.match(get, /requireBoundStudentCaller/)
    assert.match(get, /auth\.studentDbId|caller\.studentDbId/)
    assert.doesNotMatch(get, /student_id = \$\{studentId\}/)
  })

  it("events PUT/DELETE call requireCallerStudentDbId before UPDATE/DELETE", () => {
    const src = readRel("app/api/calendar/events/route.ts")
    const put = handlerSource(src, "PUT")
    const del = handlerSource(src, "DELETE")

    assert.match(put, /requireCallerStudentDbId/)
    assert.ok(
      put.indexOf("requireCallerStudentDbId") < put.search(/UPDATE\s+calendar_events/),
      "PUT must bind before UPDATE",
    )

    assert.match(del, /requireCallerStudentDbId/)
    assert.ok(
      del.indexOf("requireCallerStudentDbId") < del.search(/DELETE\s+FROM\s+calendar_events/),
      "DELETE must bind before DELETE",
    )
  })

  it("goals GET/POST bind requireBoundStudentCaller; PUT binds requireCallerStudentDbId", () => {
    const src = readRel("app/api/calendar/goals/route.ts")
    const get = handlerSource(src, "GET")
    const post = handlerSource(src, "POST")
    const put = handlerSource(src, "PUT")

    assert.match(get, /requireBoundStudentCaller/)
    assert.match(get, /auth\.studentDbId|caller\.studentDbId/)
    assert.doesNotMatch(get, /student_id = \$\{studentId\}/)

    assert.match(post, /requireBoundStudentCaller/)
    assert.match(post, /auth\.studentDbId|caller\.studentDbId/)

    assert.match(put, /requireCallerStudentDbId/)
    assert.ok(
      put.indexOf("requireCallerStudentDbId") < put.search(/UPDATE\s+study_goals/),
      "goals PUT must bind before UPDATE",
    )
  })

  it("study-plan POST binds before SQL or OpenAI and inserts auth.studentDbId", () => {
    const post = handlerSource(readRel("app/api/calendar/study-plan/route.ts"), "POST")
    assert.match(post, /requireBoundStudentCaller/)
    const bindAt = post.indexOf("requireBoundStudentCaller")
    assert.ok(bindAt >= 0)
    assert.ok(bindAt < post.indexOf("FROM ai_tutor_conversations"), "bind before SQL")
    assert.ok(bindAt < post.indexOf("createForFeature"), "bind before OpenAI")
    assert.match(post, /auth\.studentDbId|caller\.studentDbId/)
    assert.doesNotMatch(post, /student_id = \$\{studentId\}/)
    assert.doesNotMatch(post, /VALUES \(\s*\$\{studentId\}/)
  })
})
