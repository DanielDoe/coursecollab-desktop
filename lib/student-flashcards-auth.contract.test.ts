/**
 * Run: npx tsx --test lib/student-flashcards-auth.contract.test.ts
 */
import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

const here = dirname(fileURLToPath(import.meta.url))

function walkTsFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      out.push(...walkTsFiles(full))
      continue
    }
    if (full.endsWith(".ts")) out.push(full)
  }
  return out
}

describe("flashcard route auth wiring", () => {
  it("binds every student flashcard route to requireCallerStudentDbId", () => {
    const root = join(here, "../app/api/student/flashcards")
    const files = walkTsFiles(root)
    assert.ok(files.length >= 6, `expected student flashcard routes, found ${files.length}`)
    for (const file of files) {
      const source = readFileSync(file, "utf8")
      assert.match(source, /requireCallerStudentDbId/, file)
      assert.doesNotMatch(source, /headers\.get\("x-student-id"\)\s*\|\|/, file)
    }
  })

  it("binds every instructor flashcard route to requireInstructorCourse", () => {
    const root = join(here, "../app/api/instructor/flashcards")
    const files = walkTsFiles(root)
    assert.ok(files.length >= 8, `expected instructor flashcard routes, found ${files.length}`)
    for (const file of files) {
      const source = readFileSync(file, "utf8")
      assert.match(source, /requireInstructorCourse/, file)
    }
  })
})
