/**
 * Run: npx tsx --test lib/project-request-auth.contract.test.ts
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

const here = dirname(fileURLToPath(import.meta.url))

function sliceFn(src: string, name: string, nextName?: string) {
  const start = src.indexOf(`export async function ${name}`)
  assert.ok(start >= 0, `missing ${name}`)
  const end = nextName ? src.indexOf(`export async function ${nextName}`, start + 1) : src.length
  return src.slice(start, end > start ? end : src.length)
}

describe("Projects request auth contract", () => {
  it("requireGroupReadAccess and requireProjectLeaderOrInstructor session-bind and reject admin-header short-circuit", () => {
    const groupSrc = readFileSync(join(here, "group-request-auth.ts"), "utf8")
    const projectSrc = readFileSync(join(here, "project-request-auth.ts"), "utf8")

    const readAccess = sliceFn(groupSrc, "requireGroupReadAccess")
    assert.match(readAccess, /requireBoundStudentCaller/)
    assert.match(readAccess, /requireInstructorSession/)
    assert.doesNotMatch(readAccess, /if \(adminIdFromGroupsRequest/)

    const leader = sliceFn(projectSrc, "requireProjectLeaderOrInstructor", "requireProjectMemberOrInstructor")
    assert.match(leader, /requireBoundStudentCaller/)
    assert.match(leader, /requireInstructorSession/)
    assert.doesNotMatch(leader, /if \(adminIdFromGroupsRequest/)
  })
})
