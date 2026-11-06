/**
 * Run: npx tsx --test lib/cora/models/ui-payloads.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  applyUnifiedDiff,
  followUpsForCoraUi,
  resolveCoraChatUi,
  flagQuestionItems,
  verifyCodePatch,
} from "@/lib/cora/models/ui-payloads"

describe("resolveCoraChatUi", () => {
  it("keeps a short sentence and a walkthrough object", () => {
    const resolved = resolveCoraChatUi({
      message: `Work the first step only.
\`\`\`json
{"type":"walkthrough","title":"KVL","steps":[{"id":"1","title":"Loop","explanation":"Sum the drops.","equation":"v1+v2=0","hint":"Start at the source."}]}
\`\`\``,
    })
    assert.equal(resolved.reply, "Work the first step only.")
    assert.equal(resolved.ui?.type, "walkthrough")
    if (resolved.ui?.type !== "walkthrough") return
    assert.equal(resolved.ui.steps[0]?.equation, "v1+v2=0")
  })

  it("turns question drafts into one preview and flags a leaked answer", () => {
    const resolved = resolveCoraChatUi({
      questionDraftsJson: JSON.stringify([
        {
          question_text: "The resistor is 10 ohms. What is the resistor?",
          options: ["10 ohms", "20 ohms"],
          correct_answer: "10 ohms",
          bloom: "remember",
        },
      ]),
      verificationIssues: ["Stem does not name the quantity."],
      message: "Two drafts are ready.\n```json\n{}\n```",
    })
    assert.match(resolved.reply, /Two drafts/)
    assert.equal(resolved.ui?.type, "question_preview")
    if (resolved.ui?.type !== "question_preview") return
    const kinds = (resolved.ui.data.items[0]?.flags ?? []).map((flag) => flag.kind)
    assert.ok(kinds.includes("leaked_answer"))
  })

  it("blocks a hint that repeats the live answer", () => {
    const resolved = resolveCoraChatUi({
      blockAnswerLeaks: true,
      message: `{"type":"walkthrough","title":"Check","steps":[{"id":"1","title":"Check","explanation":"Try it.","hint":"The answer is 12","expectedAnswer":"12"}]}`,
    })
    assert.equal(resolved.ui?.type, "walkthrough")
    if (resolved.ui?.type !== "walkthrough") return
    assert.equal(resolved.ui.steps[0]?.hintBlocked, true)
    assert.equal(resolved.ui.steps[0]?.hint, undefined)
  })

  it("reads a diff fence as a code change and flags a removed assert", () => {
    const resolved = resolveCoraChatUi({
      message: "Apply this to the open buffer.\n```diff\n@@ -1,2 +1,2 @@\n-assert(ok)\n+ok = true\n```",
    })
    assert.equal(resolved.ui?.type, "code_patch")
    if (resolved.ui?.type !== "code_patch") return
    assert.match(resolved.ui.data.issues?.join(" ") ?? "", /assertion/)
    assert.equal(applyUnifiedDiff("assert(ok)\nreturn", resolved.ui.data.diff), "ok = true\nreturn")
  })
})

describe("flagQuestionItems", () => {
  it("marks duplicate stems", () => {
    const [first, second] = flagQuestionItems([
      { id: "1", stem: "Same stem here now", choices: ["a"], answer: "a", bloom: "apply" },
      { id: "2", stem: "Same stem here now", choices: ["b"], answer: "b", bloom: "apply" },
    ])
    assert.ok(first?.flags?.some((flag) => flag.kind === "duplicate"))
    assert.ok(second?.flags?.some((flag) => flag.kind === "duplicate"))
  })
})

describe("followUpsForCoraUi", () => {
  it("offers a diff on a plain Codebench reply", () => {
    assert.deepEqual(followUpsForCoraUi(undefined, "student", "codebench"), [
      "Propose a diff against my open code",
      "Explain the next issue without rewriting the file",
    ])
  })

  it("keeps the walkthrough hints in Codebench", () => {
    const prompts = followUpsForCoraUi(
      { type: "walkthrough", title: "Loop", steps: [] },
      "student",
      "codebench",
    )
    assert.equal(prompts[1], "Give a hint that does not reveal the answer")
  })
})

describe("verifyCodePatch", () => {
  it("allows a normal added line", () => {
    assert.deepEqual(verifyCodePatch("@@ -1 +1 @@\n-int x;\n+int x = 0;"), [])
  })
})
