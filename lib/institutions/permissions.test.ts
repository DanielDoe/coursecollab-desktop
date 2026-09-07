import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { institutionHasPermission, institutionPermissions } from "@/lib/institutions/permissions"

describe("institution permissions", () => {
  it("owner has full operational permissions", () => {
    assert.equal(institutionHasPermission("owner", "manage_organization"), true)
    assert.equal(institutionHasPermission("owner", "view_billing"), true)
    assert.equal(institutionHasPermission("owner", "manage_admins"), true)
  })

  it("billing_admin is limited to commercial modules", () => {
    assert.equal(institutionHasPermission("billing_admin", "view_billing"), true)
    assert.equal(institutionHasPermission("billing_admin", "manage_faculty"), false)
    assert.equal(institutionHasPermission("billing_admin", "view_license"), true)
  })

  it("department_admin cannot manage billing", () => {
    assert.equal(institutionHasPermission("department_admin", "manage_students"), true)
    assert.equal(institutionHasPermission("department_admin", "view_billing"), false)
    assert.ok(institutionPermissions("department_admin").includes("view_cora_ops"))
  })
})
