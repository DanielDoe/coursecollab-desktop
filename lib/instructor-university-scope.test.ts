import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { parseUniversityIdFromScopeValues } from "./instructor-university-scope"

const here = dirname(fileURLToPath(import.meta.url))

describe("instructor university / institution scope", () => {
  it("reads x-university-id first", () => {
    assert.equal(
      parseUniversityIdFromScopeValues({
        universityHeader: "12",
        institutionHeader: "99",
      }),
      12,
    )
  })

  it("falls back to x-institution-id when university is absent", () => {
    assert.equal(
      parseUniversityIdFromScopeValues({
        universityHeader: "",
        institutionHeader: "12",
      }),
      12,
    )
  })

  it("rejects empty or non-positive ids", () => {
    assert.equal(parseUniversityIdFromScopeValues({ institutionHeader: "0" }), null)
    assert.equal(parseUniversityIdFromScopeValues({ institutionQuery: "abc" }), null)
  })

  it("request parser reads x-institution-id", () => {
    const source = readFileSync(join(here, "instructor-university-scope.ts"), "utf8")
    assert.match(source, /x-institution-id/)
    assert.match(source, /institutionId/)
  })
})
