/**
 * Run: npx tsx --test lib/cora/assessment-policy-output.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { CoraAssessmentPolicy } from "./assessment-policy"
import { validateCoraAssessmentOutput } from "./assessment-policy-output"

function guidedPolicy(overrides: { questionType?: string } = {}) {
  return CoraAssessmentPolicy.evaluate({
    questionType: overrides.questionType ?? "code_write",
    source: "quiz",
    assessmentActive: true,
    submitted: false,
    solutionsReleased: false,
    instructorPolicy: "review_after_release",
    message: "How do loops work here?",
  })
}

describe("validateCoraAssessmentOutput — guided attempt", () => {
  it("blocks explicit answer leaks", () => {
    const policy = guidedPolicy()
    const out = validateCoraAssessmentOutput("The correct answer is B because …", policy)
    assert.equal(out.blockedAnswer, true)
    assert.match(out.text, /won't provide the complete solution/i)
  })

  it("blocks submission-ready C++ in fences", () => {
    const policy = guidedPolicy()
    const leak = `\`\`\`cpp
#include <iostream>
using namespace std;
int main() {
  for (int i = 0; i < 10; i++) cout << i;
  return 0;
}
\`\`\``
    const out = validateCoraAssessmentOutput(leak, policy)
    assert.equal(out.blockedAnswer, true)
  })

  it("allows short syntax snippets", () => {
    const policy = guidedPolicy()
    const ok = validateCoraAssessmentOutput(
      "A `for` loop header looks like `for (int i = 0; i < n; i++)` — what should `n` represent in your problem?",
      policy,
    )
    assert.equal(ok.blockedAnswer, false)
  })

  it("allows a short fenced syntax example", () => {
    const policy = guidedPolicy()
    const ok = validateCoraAssessmentOutput(
      "Declare an integer with `int count = 0;`. A for loop looks like this:\n```cpp\nfor (int i = 0; i < n; i++) {\n  count = count + 1;\n}\n```\nUse your own bound instead of copying a full program.",
      policy,
    )
    assert.equal(ok.blockedAnswer, false)
    assert.match(ok.text, /for \(int i/)
  })

  it("keeps the explanation when a response also contains a full program", () => {
    const policy = guidedPolicy()
    const mixed = `A loop repeats a block of statements. Start by deciding which value changes on each pass, then write that update yourself.\n\`\`\`cpp\n#include <iostream>\nusing namespace std;\nint main() {\n  for (int i = 0; i < 10; i++) cout << i;\n  return 0;\n}\n\`\`\``
    const out = validateCoraAssessmentOutput(mixed, policy)
    assert.equal(out.blockedAnswer, true)
    assert.match(out.text, /loop repeats/i)
    assert.doesNotMatch(out.text, /#include/)
  })

  it("passes through when policy allows full solutions", () => {
    const policy = CoraAssessmentPolicy.evaluate({
      source: "custom",
      message: "Review my homework",
    })
    assert.equal(policy.canGenerateSolutionCode, true)
    const out = validateCoraAssessmentOutput("The final answer is 42", policy)
    assert.equal(out.blockedAnswer, false)
  })
})
