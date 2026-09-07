/**
 * Run: npx tsx --test lib/faculty-password.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  facultyPasswordNeedsRehash,
  hashFacultyPassword,
  isFacultyDefaultPassword,
  verifyFacultyPassword,
} from "@/lib/faculty-password"
import { FACULTY_DEFAULT_PASSWORD } from "@/lib/faculty-default-password"

describe("faculty password", () => {
  it("rejects a wrong password against a bcrypt hash", async () => {
    const hash = await hashFacultyPassword("CorrectHorse1!")
    assert.equal(await verifyFacultyPassword("CorrectHorse1!", hash), true)
    assert.equal(await verifyFacultyPassword("wrong", hash), false)
    assert.equal(facultyPasswordNeedsRehash(hash), false)
  })

  it("accepts a legacy plaintext row and marks it for rehash", async () => {
    assert.equal(await verifyFacultyPassword("dmdoe123", "dmdoe123"), true)
    assert.equal(await verifyFacultyPassword("nope", "dmdoe123"), false)
    assert.equal(facultyPasswordNeedsRehash("dmdoe123"), true)
  })

  it("detects the default faculty password whether hashed or plaintext", async () => {
    assert.equal(await isFacultyDefaultPassword(FACULTY_DEFAULT_PASSWORD), true)
    const hash = await hashFacultyPassword(FACULTY_DEFAULT_PASSWORD)
    assert.equal(await isFacultyDefaultPassword(hash), true)
    assert.equal(await isFacultyDefaultPassword("other"), false)
  })
})
