/**
 * Run: npx tsx --test lib/codebench-languages.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  CODEBENCH_LANGUAGE_OPTIONS,
  detectCodebenchLanguageFromCode,
  languageIdFromFileName,
  normalizeCodebenchLanguageId,
} from "./codebench-languages"

describe("CodeBench languages", () => {
  it("exposes only C++, C, and Python in the picker", () => {
    assert.deepEqual(
      CODEBENCH_LANGUAGE_OPTIONS.map((language) => language.id),
      ["cpp", "c", "python"],
    )
  })

  it("maps leftover stored languages onto C++", () => {
    assert.equal(normalizeCodebenchLanguageId("javascript"), "cpp")
    assert.equal(normalizeCodebenchLanguageId("autodetect"), "cpp")
    assert.equal(normalizeCodebenchLanguageId("typescript"), "cpp")
    assert.equal(normalizeCodebenchLanguageId("c"), "c")
    assert.equal(normalizeCodebenchLanguageId("python"), "python")
  })

  it("detects C, C++, and Python from source", () => {
    assert.equal(detectCodebenchLanguageFromCode("#include <iostream>\nint main() {}"), "cpp")
    assert.equal(detectCodebenchLanguageFromCode("#include <stdio.h>\nint main(void) { return 0; }"), "c")
    assert.equal(detectCodebenchLanguageFromCode("def main():\n    pass\n"), "python")
  })

  it("maps file extensions onto the three languages", () => {
    assert.equal(languageIdFromFileName("main.cpp"), "cpp")
    assert.equal(languageIdFromFileName("main.c"), "c")
    assert.equal(languageIdFromFileName("main.py"), "python")
    assert.equal(languageIdFromFileName("app.js"), "cpp")
  })
})
