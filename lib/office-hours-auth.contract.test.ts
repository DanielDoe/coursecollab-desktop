/**
 * Run: npx tsx --test lib/office-hours-auth.contract.test.ts
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

function handlerSource(src: string, name: "GET" | "POST" | "PATCH" | "DELETE") {
  const start = src.indexOf(`export async function ${name}`)
  assert.ok(start >= 0, `missing ${name} handler`)
  const next = src.slice(start + 1).search(/export async function /)
  return next >= 0 ? src.slice(start, start + 1 + next) : src.slice(start)
}

describe("Office Hours student auth contract", () => {
  it("student GET/POST bind requireBoundStudentCaller", () => {
    const src = readRel("app/api/student/office-hours/route.ts")
    assert.match(handlerSource(src, "GET"), /requireBoundStudentCaller/)
    assert.match(handlerSource(src, "POST"), /requireBoundStudentCaller/)
  })

  it("student [id] PATCH and DELETE bind requireBoundStudentCaller before mutation", () => {
    const src = readRel("app/api/student/office-hours/[id]/route.ts")
    const patch = handlerSource(src, "PATCH")
    const del = handlerSource(src, "DELETE")

    assert.match(patch, /requireBoundStudentCaller/)
    assert.ok(
      patch.indexOf("requireBoundStudentCaller") < patch.search(/UPDATE\s+office_hour_requests/),
      "PATCH must bind before UPDATE office_hour_requests",
    )
    assert.ok(
      patch.indexOf("requireBoundStudentCaller") < patch.search(/DELETE\s+FROM\s+office_hour_preferred_dates/),
      "PATCH must bind before DELETE FROM preferred dates",
    )

    assert.match(del, /requireBoundStudentCaller/)
    assert.match(del, /bound\.studentDbId/)
    assert.ok(
      del.indexOf("requireBoundStudentCaller") < del.search(/DELETE\s+FROM\s+office_hour_requests/),
      "DELETE must bind before DELETE FROM office_hour_requests",
    )
    assert.doesNotMatch(del, /SELECT id FROM students WHERE student_id/)
    assert.doesNotMatch(del, /studentId required/)
  })
})
