/**
 * Run: npx tsx --test lib/announcement-auth.contract.test.ts
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, "..")

const FACULTY_AUTH = /requireInstructorCourse|requireInstructorSession/
const STUDENT_AUTH = /requireBoundStudentCaller|requireCallerStudentDbId/

function readRel(rel: string) {
  return readFileSync(join(repo, rel), "utf8")
}

function handlerSource(src: string, name: "GET" | "POST" | "PUT" | "DELETE") {
  const start = src.indexOf(`export async function ${name}`)
  assert.ok(start >= 0, `missing ${name} handler`)
  const next = src.slice(start + 1).search(/export async function /)
  return next >= 0 ? src.slice(start, start + 1 + next) : src.slice(start)
}

describe("Announcements auth contract", () => {
  it("faculty list GET/POST bind requireInstructorCourse and use scope.instructorId", () => {
    const src = readRel("app/api/announcements/route.ts")
    const get = handlerSource(src, "GET")
    const post = handlerSource(src, "POST")
    assert.match(get, /requireInstructorCourse/)
    assert.match(post, /requireInstructorCourse/)
    assert.match(post, /scope\.instructorId/)
    assert.doesNotMatch(post, /Number\(instructorId\)/)
    assert.match(get, /requireBoundStudentCaller/)
    assert.match(get, /studentAnnouncementsWhereClause/)
  })

  it("student list still binds requireBoundStudentCaller", () => {
    const get = handlerSource(readRel("app/api/announcements/route.ts"), "GET")
    assert.match(get, /requireBoundStudentCaller/)
    const studentAt = get.indexOf("requireBoundStudentCaller")
    const facultyAt = get.indexOf("requireInstructorCourse")
    assert.ok(studentAt >= 0 && facultyAt > studentAt, "student bind stays on the studentId branch")
  })

  it("GET :id / PUT / DELETE bind session helpers", () => {
    const src = readRel("app/api/announcements/[id]/route.ts")
    const get = handlerSource(src, "GET")
    const put = handlerSource(src, "PUT")
    const del = handlerSource(src, "DELETE")
    assert.match(get, /requireBoundStudentCaller/)
    assert.match(get, FACULTY_AUTH)
    assert.match(put, FACULTY_AUTH)
    assert.match(del, FACULTY_AUTH)
    assert.match(put, /scope\.instructorId/)
    assert.match(del, /scope\.instructorId/)
  })

  it("view / react / comments bind requireBoundStudentCaller before SQL", () => {
    const view = readRel("app/api/announcements/[id]/view/route.ts")
    const react = readRel("app/api/announcements/[id]/react/route.ts")
    const comments = readRel("app/api/announcements/[id]/comments/route.ts")
    const viewPost = handlerSource(view, "POST")
    const reactPost = handlerSource(react, "POST")
    const commentsGet = handlerSource(comments, "GET")
    const commentsPost = handlerSource(comments, "POST")

    assert.match(viewPost, /requireBoundStudentCaller/)
    assert.ok(
      viewPost.indexOf("requireBoundStudentCaller") < viewPost.indexOf("FROM announcements"),
      "view POST must bind before SQL",
    )
    assert.match(viewPost, /auth\.studentDbId/)

    assert.match(reactPost, /requireBoundStudentCaller/)
    assert.ok(
      reactPost.indexOf("requireBoundStudentCaller") < reactPost.indexOf("FROM announcements"),
      "react POST must bind before SQL",
    )
    assert.match(reactPost, /auth\.studentDbId/)

    assert.match(commentsGet, /requireBoundStudentCaller/)
    assert.match(commentsGet, STUDENT_AUTH)
    assert.match(commentsPost, /requireBoundStudentCaller/)
    assert.ok(
      commentsPost.indexOf("requireBoundStudentCaller") < commentsPost.indexOf("FROM announcements"),
      "comments POST must bind before SQL",
    )
    assert.match(commentsPost, /auth\.studentDbId/)
  })

  it("view-stats GET and upload bind requireInstructorCourse", () => {
    const viewGet = handlerSource(readRel("app/api/announcements/[id]/view/route.ts"), "GET")
    const upload = readRel("app/api/announcements/upload/route.ts")
    assert.match(viewGet, /requireInstructorCourse/)
    assert.match(upload, /requireInstructorCourse/)
    assert.doesNotMatch(upload, /requireInstructorOrTaCourse/)
  })
})
