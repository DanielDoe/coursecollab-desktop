/**
 * Run: npx tsx --test lib/classroom-points-auth.contract.test.ts
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

function extractFunction(src: string, name: string): string {
  const start = src.indexOf(`async function ${name}`)
  assert.ok(start >= 0, `missing ${name}`)
  const after = src.slice(start)
  const next = after.slice(1).search(/\nexport async function |\nasync function /)
  return next === -1 ? after : after.slice(0, next + 1)
}

describe("Classroom Points auth / redact contract", () => {
  it("solution-upload binds requireBoundStudentCaller before assignment lookup", () => {
    const src = readRel("app/api/student/classroom-points/solution-upload/route.ts")
    assert.match(src, /requireBoundStudentCaller/)
    const post = src.slice(src.indexOf("export async function POST"))
    const bindAt = post.indexOf("requireBoundStudentCaller")
    const lookupAt = post.search(/FROM classroom_point_submissions|Assignment not found or expired/)
    assert.ok(bindAt >= 0, "missing requireBoundStudentCaller in POST")
    assert.ok(lookupAt > bindAt, "assignment lookup must run after requireBoundStudentCaller")
    assert.doesNotMatch(post, /resolveStudentDatabaseIdFromParam/)
    assert.match(post, /access\.studentDbId/)
  })

  it("student submissions list redacts and course-scopes", () => {
    const src = readRel("app/api/classroom-points/submissions/route.ts")
    assert.match(src, /redactClassroomPointsStudentSubmission/)
    assert.match(src, /sqlSubmissionCourseScope/)
    assert.match(src, /resolveStudentCourseContextByDbId/)
    assert.match(src, /CLASSROOM_SUBMISSION_IS_ACTIVE_SQL/)
    const studentFn = extractFunction(src, "loadStudentClassroomPointSubmissions")
    assert.match(studentFn, /sqlSubmissionCourseScope/)
    assert.match(studentFn, /redactClassroomPointsStudentSubmission/)
    assert.doesNotMatch(studentFn, /OR session IS NULL/)
    assert.match(studentFn, /opts\.studentDbId/)
    assert.doesNotMatch(studentFn, /resolveStudentDatabaseIdFromParam/)
  })

  it("session leaderboard omits 0-pt roster dumps until someone earns points", () => {
    const src = readRel("app/api/classroom-points/leaderboard/route.ts")
    assert.match(src, /classroomPointsLeaderboardForCurrentOffering/)
    assert.match(src, /HAVING COALESCE\(SUM\(CASE WHEN cp\.status = 'approved'/)
    assert.match(src, /TRIM\(UPPER\(COALESCE\(cp\.session, s\.section, ''\)\)\) = TRIM\(UPPER\(\$\{session\}\)\)/)
  })

  it("student GET-by-id redacts and course-scopes", () => {
    const src = readRel("app/api/classroom-points/submissions/[id]/route.ts")
    const get = src.slice(src.indexOf("export async function GET"))
    const put = get.indexOf("export async function PUT")
    const getOnly = put === -1 ? get : get.slice(0, put)
    assert.match(getOnly, /redactClassroomPointsStudentSubmission/)
    assert.match(getOnly, /resolveStudentCourseContextByDbId/)
    assert.match(getOnly, /submissionBelongsToCourse/)
    assert.match(getOnly, /access\.role === "student"|access\.studentDbId/)
  })
})
