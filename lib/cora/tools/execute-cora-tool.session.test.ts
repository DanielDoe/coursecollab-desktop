/**
 * Run: npx tsx --test lib/cora/tools/execute-cora-tool.session.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { executeCoraTool } from "@/lib/cora/tools/execute-cora-tool"

describe("Cora tool session gate", () => {
  it("rejects tool execution without a Cora session", async () => {
    const result = await executeCoraTool(
      { role: "assistant", studentDbId: 1002 },
      "get_student_summary",
      {},
    )
    assert.match(result, /session required/i)
  })

  it("does not treat a client-supplied faculty role as authorization", async () => {
    const result = await executeCoraTool(
      { role: "copilot", instructorId: 99, courseId: 1 },
      "propose_announcement",
      { title: "x", content: "y" },
    )
    assert.match(result, /session required/i)
  })
})
