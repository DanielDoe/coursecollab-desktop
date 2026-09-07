import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { authorize } from "@/lib/authz/authorize"
import { roleHasPermission } from "@/lib/authz/permissions"

describe("authorization", () => {
  it("rejects unauthenticated actors", () => {
    const decision = authorize({ actor: null, action: "course.read" })
    assert.equal(decision.ok, false)
  })

  it("prevents students from managing grades", () => {
    assert.equal(roleHasPermission("student", "grade.manage"), false)
    const decision = authorize({
      actor: { id: 2, role: "student" },
      action: "grade.manage",
    })
    assert.equal(decision.ok, false)
  })

  it("prevents students from reading another student's submission", () => {
    const decision = authorize({
      actor: { id: 2, role: "student" },
      action: "submission.readOwn",
      resource: { type: "submission", ownerId: 9 },
    })
    assert.equal(decision.ok, false)
  })

  it("prevents faculty from another course", () => {
    const decision = authorize({
      actor: { id: 4, role: "instructor", courseIds: [10] },
      action: "quiz.manage",
      resource: { type: "quiz", courseId: 99 },
    })
    assert.equal(decision.ok, false)
  })

  it("blocks observer mutations", () => {
    const decision = authorize({
      actor: { id: 8, role: "observer" },
      action: "assignment.create",
    })
    assert.equal(decision.ok, false)
  })

  it("blocks cross-institution access", () => {
    const decision = authorize({
      actor: { id: 3, role: "instructor", institutionId: 1, courseIds: [10] },
      action: "course.read",
      resource: { type: "course", courseId: 10, institutionId: 2 },
    })
    assert.equal(decision.ok, false)
  })
})
