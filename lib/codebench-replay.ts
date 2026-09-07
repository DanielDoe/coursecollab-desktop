import { CODEBENCH_CPP_WALKTHROUGH_SAMPLE } from "@/lib/codebench-samples"
import { getDeepInsight } from "@/lib/codebench-replay-modes"

export type CodeReplayPhase =
  | "setup"
  | "loop"
  | "condition"
  | "body"
  | "update"
  | "output"
  | "return"
  | "call"

export type CodeReplayStep = {
  lineNumber: number
  code: string
  title: string
  phase?: CodeReplayPhase
  concept?: string
  explanation: string
  /** Short bullet points revealed one-by-one in the UI */
  bullets?: string[]
  /** Extra context shown only in Deep dive mode */
  deepInsight?: string
  variables: Record<string, string | number | boolean>
  changedVariables?: string[]
  condition?: string
  result?: string
  consoleOutput?: string
  teachingNote?: string
}

function normCode(s: string) {
  return s.replace(/\r\n/g, "\n").trim()
}

/** Hand-crafted rich walkthrough for the CodeBench demo program. */
export const CPP_SUM_LOOP_REPLAY: CodeReplayStep[] = [
  {
    lineNumber: 1,
    code: "#include <iostream>",
    title: "Load iostream library",
    phase: "setup",
    concept: "Preprocessor",
    explanation:
      "Before main() runs, the preprocessor pulls in the iostream header. That header declares cout, cin, and endl — the tools we need to print Sum 1..5 = 15 to the terminal.",
    bullets: [
      "#include copies declarations from a header file into your translation unit.",
      "Without this line, cout and endl would be unknown names.",
    ],
    variables: {},
    teachingNote: "Headers describe what exists; they do not run code by themselves.",
  },
  {
    lineNumber: 2,
    code: "using namespace std;",
    title: "Import std names",
    phase: "setup",
    concept: "Namespaces",
    explanation:
      "std is the standard library namespace. writing using namespace std; lets us type cout instead of std::cout. In larger programs you often skip this to avoid name clashes.",
    bullets: ["Namespaces group related names so different libraries do not collide."],
    variables: {},
  },
  {
    lineNumber: 4,
    code: "int main() {",
    title: "Program starts at main()",
    phase: "setup",
    concept: "Entry point",
    explanation:
      "The operating system launches your program and jumps to main(). A stack frame is created — a scratch area on the stack where local variables like sum and i will live until main returns.",
    bullets: [
      "main() must return int in standard C++.",
      "Everything inside the braces belongs to this function.",
    ],
    variables: {},
    teachingNote: "Every C++ program you run from the terminal starts here unless the platform defines a custom entry.",
  },
  {
    lineNumber: 5,
    code: "    int sum = 0;",
    title: "Create the accumulator",
    phase: "setup",
    concept: "Variable declaration",
    explanation:
      "We declare an int named sum and initialize it to 0. This variable remembers the running total. Starting at zero guarantees we begin from a known value instead of whatever bits happened to be in memory.",
    bullets: [
      "int reserves 4 bytes (typically) for a whole number.",
      "The = 0 part runs before any loop work begins.",
    ],
    variables: { sum: 0 },
    changedVariables: ["sum"],
    teachingNote: "Accumulators almost always start at 0 unless you are counting something that already has a baseline.",
  },
  {
    lineNumber: 6,
    code: "    for (int i = 1; i <= 5; i++) {",
    title: "Loop init — i becomes 1",
    phase: "loop",
    concept: "for-loop init",
    explanation:
      "The for-loop executes its initialization clause once: int i = 1 creates a counter starting at 1. Next the runtime will evaluate the condition i <= 5 before entering the body.",
    bullets: [
      "This is the only time the init clause runs.",
      "We will add 1 + 2 + 3 + 4 + 5 into sum.",
    ],
    variables: { sum: 0, i: 1 },
    changedVariables: ["i"],
  },
  {
    lineNumber: 6,
    code: "    for (int i = 1; i <= 5; i++) {",
    title: "Check: i <= 5 ? (i is 1)",
    phase: "condition",
    concept: "Loop condition",
    explanation:
      "Before each iteration body runs, C++ evaluates i <= 5. Substituting i = 1 gives 1 <= 5, which is true, so control enters the loop body on line 7.",
    bullets: ["False would skip the body and jump to the statement after the loop."],
    variables: { sum: 0, i: 1 },
    condition: "i <= 5  →  1 <= 5",
    result: "true — enter body",
  },
  {
    lineNumber: 7,
    code: "        sum += i;",
    title: "1st iteration — add 1 to sum",
    phase: "body",
    concept: "Compound assignment",
    explanation:
      "sum += i is shorthand for sum = sum + i. The right-hand side reads the current i (1), adds it to sum (0), and stores the result back into sum. After this line, sum holds 1.",
    bullets: [
      "Equivalent long form: sum = sum + i;",
      "Only sum changes; i stays 1 until the increment step.",
    ],
    variables: { sum: 1, i: 1 },
    changedVariables: ["sum"],
    teachingNote: "+= evaluates the right side first, then writes the left side.",
  },
  {
    lineNumber: 6,
    code: "    for (int i = 1; i <= 5; i++) {",
    title: "Increment — i becomes 2",
    phase: "update",
    concept: "Loop increment",
    explanation:
      "After the body finishes, the increment clause i++ runs. Post-increment adds 1 to i, so i moves from 1 to 2. Control jumps back to the condition on the for-line.",
    variables: { sum: 1, i: 2 },
    changedVariables: ["i"],
  },
  {
    lineNumber: 6,
    code: "    for (int i = 1; i <= 5; i++) {",
    title: "Check: i <= 5 ? (i is 2)",
    phase: "condition",
    concept: "Loop condition",
    explanation:
      "The condition runs again with i = 2. Since 2 <= 5 is still true, we enter the body a second time. Mentally track sum: we already have 1, and we are about to add 2.",
    variables: { sum: 1, i: 2 },
    condition: "i <= 5  →  2 <= 5",
    result: "true — enter body",
  },
  {
    lineNumber: 7,
    code: "        sum += i;",
    title: "2nd iteration — add 2 to sum",
    phase: "body",
    concept: "Compound assignment",
    explanation:
      "sum was 1. Adding i (2) yields sum = 3. We have now accounted for 1 + 2. The loop pattern — check, body, increment — will repeat until the condition fails.",
    variables: { sum: 3, i: 2 },
    changedVariables: ["sum"],
  },
  {
    lineNumber: 6,
    code: "    for (int i = 1; i <= 5; i++) {",
    title: "Increment — i becomes 3",
    phase: "update",
    concept: "Loop increment",
    explanation: "i++ executes again, moving the counter from 2 to 3. The loop is not finished because 3 <= 5.",
    variables: { sum: 3, i: 3 },
    changedVariables: ["i"],
  },
  {
    lineNumber: 7,
    code: "        sum += i;",
    title: "3rd iteration — add 3 to sum",
    phase: "body",
    concept: "Compound assignment",
    explanation:
      "sum becomes 3 + 3 = 6. Running total now includes 1, 2, and 3. Watch how the same two lines — condition check and sum += i — drive the entire loop.",
    variables: { sum: 6, i: 3 },
    changedVariables: ["sum"],
  },
  {
    lineNumber: 6,
    code: "    for (int i = 1; i <= 5; i++) {",
    title: "Increment — i becomes 4",
    phase: "update",
    concept: "Loop increment",
    explanation: "Another increment cycle: i moves from 3 to 4. The condition will still pass because 4 <= 5.",
    variables: { sum: 6, i: 4 },
    changedVariables: ["i"],
  },
  {
    lineNumber: 7,
    code: "        sum += i;",
    title: "4th iteration — add 4 to sum",
    phase: "body",
    concept: "Compound assignment",
    explanation: "sum was 6; adding 4 produces sum = 10. Four numbers (1 through 4) are now included in the total.",
    variables: { sum: 10, i: 4 },
    changedVariables: ["sum"],
  },
  {
    lineNumber: 6,
    code: "    for (int i = 1; i <= 5; i++) {",
    title: "Increment — i becomes 5",
    phase: "update",
    concept: "Loop increment",
    explanation: "i++ brings the counter to 5 — the last value that should enter the loop body for this problem.",
    variables: { sum: 10, i: 5 },
    changedVariables: ["i"],
  },
  {
    lineNumber: 7,
    code: "        sum += i;",
    title: "5th iteration — add 5 to sum",
    phase: "body",
    concept: "Compound assignment",
    explanation:
      "sum becomes 10 + 5 = 15. That is the closed-form result of 1+2+3+4+5. One more increment will push i past the limit and end the loop.",
    bullets: ["Verify with n(n+1)/2 → 5×6/2 = 15."],
    variables: { sum: 15, i: 5 },
    changedVariables: ["sum"],
    teachingNote: "Gauss's formula n(n+1)/2 gives the same answer for summing 1..n.",
  },
  {
    lineNumber: 6,
    code: "    for (int i = 1; i <= 5; i++) {",
    title: "Increment — i becomes 6",
    phase: "update",
    concept: "Loop increment",
    explanation:
      "After processing i = 5, i++ runs one more time. i is now 6. The next condition check will fail because 6 is not less than or equal to 5.",
    variables: { sum: 15, i: 6 },
    changedVariables: ["i"],
  },
  {
    lineNumber: 6,
    code: "    for (int i = 1; i <= 5; i++) {",
    title: "Condition fails — leave loop",
    phase: "condition",
    concept: "Loop termination",
    explanation:
      "With i = 6, the test i <= 5 evaluates to false. C++ skips the body entirely and continues with the first statement after the loop's closing brace — the cout line.",
    bullets: ["sum stays 15; only control flow changes here."],
    variables: { sum: 15, i: 6 },
    condition: "i <= 5  →  6 <= 5",
    result: "false — exit loop",
  },
  {
    lineNumber: 9,
    code: '    cout << "Sum 1..5 = " << sum << endl;',
    title: "Print the final answer",
    phase: "output",
    concept: "Standard output",
    explanation:
      "cout sends text to standard output. The << operator chains fragments left-to-right: the literal string, then the value of sum (15), then endl which inserts a newline and flushes the buffer so you see output immediately.",
    bullets: [
      "String literal prints verbatim.",
      "sum inserts its decimal representation.",
      "endl adds \\n and flush.",
    ],
    variables: { sum: 15, i: 6 },
    consoleOutput: "Sum 1..5 = 15",
  },
  {
    lineNumber: 10,
    code: "    return 0;",
    title: "Return success to the OS",
    phase: "return",
    concept: "Exit status",
    explanation:
      "return 0 ends main(), destroys its stack frame, and tells the operating system the program finished without error. Non-zero return codes conventionally signal failure.",
    variables: { sum: 15, i: 6 },
    teachingNote: "Your shell exposes this as $? on Unix or ERRORLEVEL on Windows.",
  },
]

export function normalizeReplayStep(raw: unknown, index: number): CodeReplayStep | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const lineNumber = Number(o.lineNumber ?? o.line ?? index + 1)
  const code = String(o.code ?? o.lineText ?? "").trim()
  const explanation = String(o.explanation ?? o.description ?? "").trim()
  if (!explanation && !code) return null

  const variables: Record<string, string | number | boolean> = {}
  if (o.variables && typeof o.variables === "object") {
    for (const [k, v] of Object.entries(o.variables as Record<string, unknown>)) {
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        variables[k] = v
      } else if (v != null) variables[k] = String(v)
    }
  }

  const changedVariables = Array.isArray(o.changedVariables)
    ? o.changedVariables.map(String)
    : undefined

  return {
    lineNumber: Number.isFinite(lineNumber) ? lineNumber : index + 1,
    code: code || `Line ${lineNumber}`,
    title: String(o.title ?? o.stepTitle ?? `Step ${index + 1}`),
    phase: o.phase as CodeReplayPhase | undefined,
    concept: o.concept ? String(o.concept) : undefined,
    explanation: explanation || "Executing this line updates program state.",
    bullets: Array.isArray(o.bullets) ? o.bullets.map(String) : undefined,
    deepInsight: o.deepInsight ? String(o.deepInsight) : undefined,
    variables,
    changedVariables,
    condition: o.condition ? String(o.condition) : undefined,
    result: o.result ? String(o.result) : undefined,
    consoleOutput: o.consoleOutput ? String(o.consoleOutput) : undefined,
    teachingNote: o.teachingNote ? String(o.teachingNote) : undefined,
  }
}

export function enrichReplaySteps(code: string, steps: unknown[]): CodeReplayStep[] {
  if (normCode(code) === normCode(CODEBENCH_CPP_WALKTHROUGH_SAMPLE)) {
    return CPP_SUM_LOOP_REPLAY
  }

  const normalized = steps
    .map((s, i) => normalizeReplayStep(s, i))
    .filter((s): s is CodeReplayStep => s != null)

  if (!normalized.length) return []

  return normalized.map((step, i) => {
    const explanation =
      step.explanation.length >= 60
        ? step.explanation
        : `${step.explanation} Watch how variables change — this builds your mental model of control flow.`
    const sentences = explanation.split(/(?<=[.!?])\s+/).filter(Boolean)
    const bullets =
      step.bullets ??
      (sentences.length > 1 ? sentences.slice(1, Math.min(sentences.length, 3)) : undefined)

    return {
      ...step,
      title: step.title || `Step ${i + 1}`,
      explanation,
      bullets,
      teachingNote:
        step.teachingNote ??
        (step.concept ? `Key idea: ${step.concept} — revisit this label if the step feels unclear.` : undefined),
      deepInsight: step.deepInsight ?? getDeepInsight(step),
    }
  })
}

export function parseReplayStepsFromApi(content: string): CodeReplayStep[] {
  let s = content.trim()
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)```/im.exec(s)
  if (fence) s = fence[1].trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(s)
  } catch {
    const start = s.indexOf("{")
    const end = s.lastIndexOf("}")
    if (start < 0 || end <= start) return []
    try {
      parsed = JSON.parse(s.slice(start, end + 1))
    } catch {
      return []
    }
  }

  let arr: unknown[] = []
  if (Array.isArray(parsed)) arr = parsed
  else if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>
    if (Array.isArray(o.steps)) arr = o.steps
    else if (Array.isArray(o.replay)) arr = o.replay
  }

  return arr.map((item, i) => normalizeReplayStep(item, i)).filter((s): s is CodeReplayStep => s != null)
}
