/**
 * Run: npx tsx --test lib/sql-compose.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { composeSql, isAlreadyAppliedSchemaDdl, renumberSqlPlaceholders } from "./sql-compose"

describe("composeSql", () => {
  it("binds ordinary values", () => {
    const query = composeSql(Object.assign(["SELECT * FROM students WHERE id = ", ""], { raw: ["SELECT * FROM students WHERE id = ", ""] }), [42])
    assert.equal(query.text, "SELECT * FROM students WHERE id = $1")
    assert.deepEqual(query.params, [42])
  })

  it("splices a nested snippet instead of binding it as a value", () => {
    const filter = composeSql(Object.assign(["qa.id = ", ""], { raw: ["qa.id = ", ""] }), [9])
    const query = composeSql(
      Object.assign(["SELECT 1 WHERE ", " AND student_id = ", ""], { raw: ["SELECT 1 WHERE ", " AND student_id = ", ""] }),
      [filter, 3],
    )
    assert.equal(query.text, "SELECT 1 WHERE qa.id = $1 AND student_id = $2")
    assert.deepEqual(query.params, [9, 3])
  })

  it("renumbers placeholders past the parent parameters", () => {
    assert.equal(renumberSqlPlaceholders("a = $1 AND b = $2", 2), "a = $3 AND b = $4")
    assert.equal(renumberSqlPlaceholders("a = $1 AND b = $10", 1), "a = $2 AND b = $11")
  })

  it("injects unsafe SQL without a parameter", () => {
    const query = composeSql(Object.assign(["SELECT 1 ", ""], { raw: ["SELECT 1 ", ""] }), [
      { __unsafe: true, __sql: "WHERE true" },
    ])
    assert.equal(query.text, "SELECT 1 WHERE true")
    assert.deepEqual(query.params, [])
  })
})

describe("isAlreadyAppliedSchemaDdl", () => {
  it("treats an existing constraint or policy as already applied", () => {
    assert.equal(
      isAlreadyAppliedSchemaDdl("42710", "ALTER TABLE courses ADD CONSTRAINT courses_course_scope_check CHECK (true)"),
      true,
    )
    assert.equal(isAlreadyAppliedSchemaDdl("42710", "CREATE POLICY tenant_delete_courses ON courses FOR DELETE USING (true)"), true)
    assert.equal(isAlreadyAppliedSchemaDdl("23505", "INSERT INTO cora_interaction_events (source) VALUES ($1)"), false)
    assert.equal(isAlreadyAppliedSchemaDdl("42710", "INSERT INTO students (id) VALUES ($1)"), false)
  })
})
