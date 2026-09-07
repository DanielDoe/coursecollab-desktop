import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { canManageFaculty, INSTITUTION_ADMIN_ROLES } from "@/lib/institutions/auth"

describe("institution RBAC", () => {
  it("does not treat faculty as institution admins", () => {
    assert.equal((INSTITUTION_ADMIN_ROLES as readonly string[]).includes("faculty"), false)
    assert.equal((INSTITUTION_ADMIN_ROLES as readonly string[]).includes("student"), false)
    assert.equal(canManageFaculty("institution_admin"), true)
    assert.equal(canManageFaculty("billing_admin"), false)
  })
})
