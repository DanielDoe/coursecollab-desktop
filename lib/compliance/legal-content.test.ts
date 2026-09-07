import assert from "node:assert/strict"
import test from "node:test"
import {
  LEGAL_CONTENT_VERSION,
  getLegalContentCatalog,
  getLegalDocument,
  isLegalDocumentId,
} from "./legal-content"

test("isLegalDocumentId validates known ids", () => {
  assert.equal(isLegalDocumentId("privacy"), true)
  assert.equal(isLegalDocumentId("unknown"), false)
})

test("getLegalDocument returns structured sections", () => {
  const privacy = getLegalDocument("privacy")
  assert.equal(privacy.id, "privacy")
  assert.ok(privacy.sections.length >= 5)
  assert.ok(privacy.sections.some((section) => section.title === "Information We Process"))
})

test("getLegalContentCatalog includes all documents with version", () => {
  const catalog = getLegalContentCatalog()
  assert.equal(catalog.version, LEGAL_CONTENT_VERSION)
  assert.ok(catalog.documents.privacy)
  assert.ok(catalog.documents.terms)
  assert.ok(catalog.documents.support)
  assert.ok(catalog.documents["ai-and-data"])
})
