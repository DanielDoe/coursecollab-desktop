import type { CoraStudentContextPayload } from "@/lib/cora/fetch-student-context"

export type CoraCodeLanguage =
  | "auto"
  | "cpp"
  | "matlab"
  | "python"
  | "java"
  | "javascript"
  | "unknown"

export type CoraCodeTemplateId = "new_program" | "homework" | "lab" | "project" | "practice"

/** Student-facing intentions (not internal taxonomy cards). */
export type CoraCodeActionId =
  | "explain"
  | "find_bugs"
  | "visualize"
  | "improve"
  | "check_work"

export type CoraCodeAnalysisTab = "overview" | "execution" | "debug" | "quality"

export type CoraCodeContinue = {
  hasSession: boolean
  title: string
  subtitle: string
  progressPct: number
  href: string
}

export type CoraCodeQualityLabel = "Strong" | "Good" | "Needs work"

export type CoraCodePedagogicalIssue = {
  id: string
  title: string
  line?: number
  snippet?: string
  question: string
  hint: string
  explain: string
  severity: "error" | "warning" | "info"
}

export type CoraCodeChallenge = {
  id: string
  level: "Easy" | "Medium" | "Hard"
  prompt: string
}

export type CoraCodeAnalysis = {
  language: Exclude<CoraCodeLanguage, "auto">
  languageLabel: string
  compiles: boolean
  runtimeOk: boolean
  improvementCount: number
  summary: string
  keyConcepts: string[]
  notice: string
  difficulty: "Introductory" | "Intermediate" | "Advanced"
  estimatedMinutes: number
  topics: string[]
  complexity: { time: string; memory: string; why: string }
  issues: CoraCodePedagogicalIssue[]
  suggestions: string[]
  quality: {
    overall: number
    readability: CoraCodeQualityLabel
    efficiency: CoraCodeQualityLabel
    correctness: CoraCodeQualityLabel
    maintainability: CoraCodeQualityLabel
  }
  variables: Array<{ name: string; value: string }>
  callStack: string[]
  executionSteps: Array<{ id: string; label: string; detail?: string }>
  outputPreview: string
  challenges: CoraCodeChallenge[]
  relatedConcepts: string[]
}

export const CORA_CODE_LANGUAGES: Array<{ id: CoraCodeLanguage; label: string }> = [
  { id: "auto", label: "Auto Detect" },
  { id: "cpp", label: "C++" },
  { id: "python", label: "Python" },
  { id: "matlab", label: "MATLAB" },
  { id: "java", label: "Java" },
  { id: "javascript", label: "JavaScript" },
]

export const CORA_CODE_TEMPLATES: Array<{
  id: CoraCodeTemplateId
  label: string
  snippet: string
}> = [
  {
    id: "new_program",
    label: "New Program",
    snippet: `#include <iostream>\nusing namespace std;\n\nint main() {\n  // your code\n  return 0;\n}\n`,
  },
  {
    id: "homework",
    label: "Homework",
    snippet: `// Homework — describe the prompt above, then implement.\n#include <iostream>\nusing namespace std;\n\nint main() {\n  \n  return 0;\n}\n`,
  },
  {
    id: "lab",
    label: "Lab",
    snippet: `// Lab exercise\n#include <iostream>\nusing namespace std;\n\nint main() {\n  \n  return 0;\n}\n`,
  },
  {
    id: "project",
    label: "Project",
    snippet: `// Project module\n#include <vector>\n#include <string>\nusing namespace std;\n\nclass Solution {\npublic:\n  \n};\n`,
  },
  {
    id: "practice",
    label: "Practice",
    snippet: `// Practice: implement and test edge cases\n#include <iostream>\nusing namespace std;\n\nint solve() {\n  return 0;\n}\n\nint main() {\n  cout << solve() << endl;\n  return 0;\n}\n`,
  },
]

export const CORA_CODE_ACTIONS: Array<{
  id: CoraCodeActionId
  label: string
  prompt: string
}> = [
  {
    id: "explain",
    label: "Explain Code",
    prompt:
      "Explain this program: purpose → algorithm → functions → important lines → complexity. Prefer intuition before jargon.",
  },
  {
    id: "find_bugs",
    label: "Find Bugs",
    prompt:
      "Find bugs pedagogically. Cover compile errors, runtime errors, and logic errors. Ask guiding questions before revealing fixes. Never dump a full corrected solution first.",
  },
  {
    id: "visualize",
    label: "Visualize",
    prompt:
      "Visualize execution step-by-step: variables, call stack, heap/pointers if relevant, loops, and recursion. Narrate each step as if animating an execution visualizer.",
  },
  {
    id: "improve",
    label: "Improve Code",
    prompt:
      "Improve this code for readability, efficiency, structure, and best practices. Suggest changes with rationale — do not silently rewrite the whole file.",
  },
  {
    id: "check_work",
    label: "Check My Work",
    prompt:
      "Check my work against typical assignment requirements. Point out gaps and ask me to fix them. Do not reveal a full instructor solution.",
  },
]

const LANGUAGE_LABEL: Record<Exclude<CoraCodeLanguage, "auto">, string> = {
  cpp: "C++",
  matlab: "MATLAB",
  python: "Python",
  java: "Java",
  javascript: "JavaScript",
  unknown: "Unknown",
}

const CODE_SESSION_KEY = "coraCodeLastSession"

export function detectCodeLanguage(code: string, filename?: string): Exclude<CoraCodeLanguage, "auto"> {
  const name = (filename || "").toLowerCase()
  if (/\.(cpp|cc|cxx|h|hpp)$/.test(name)) return "cpp"
  if (/\.m$/.test(name)) return "matlab"
  if (/\.py$/.test(name)) return "python"
  if (/\.java$/.test(name)) return "java"
  if (/\.(js|ts|tsx|jsx)$/.test(name)) return "javascript"

  const t = code
  if (/#include\s*<|using\s+namespace\s+std|std::|int\s+main\s*\(/.test(t)) return "cpp"
  if (/\bfunction\s+\w+\s*\(|fprintf\s*\(|zeros\s*\(|ones\s*\(/.test(t) && /;/.test(t)) return "matlab"
  if (/^\s*def\s+\w+\s*\(|^\s*import\s+\w+|print\s*\(/m.test(t)) return "python"
  if (/\bpublic\s+class\b|\bSystem\.out\.println/.test(t)) return "java"
  if (/\bfunction\b|\bconst\b|\blet\b|\bconsole\.log/.test(t)) return "javascript"
  return "unknown"
}

function detectTopics(code: string): string[] {
  const topics: string[] = []
  const checks: Array<[RegExp, string]> = [
    [/\bfor\s*\(|\bwhile\s*\(|\bdo\s*\{/, "Loops"],
    [/\b\[|vector\s*<|array\s*</i, "Arrays"],
    [/\b\w+\s*\([^;]*\)\s*\{|function\s+\w+|def\s+\w+/, "Functions"],
    [/\*|pointer|->|nullptr|NULL\b/i, "Pointers"],
    [/\b(factorial|fibonacci|recurse|recursion)\b/i, "Recursion"],
    [/\bclass\b|\bstruct\b/, "Classes"],
    [/\bnew\b|\bmalloc\b|\bfree\b|\bdelete\b/, "Memory"],
    [/\bqueue\b|\bstack\b|\blinked\b|\btree\b/i, "Data Structures"],
    [/\bsort\b|\bbinary.?search|O\(/i, "Algorithms"],
    [/\bsum\s*[+\=]|accumulat/i, "Accumulators"],
  ]
  for (const [re, label] of checks) {
    if (re.test(code) && !topics.includes(label)) topics.push(label)
    if (topics.length >= 6) break
  }
  if (topics.length === 0) topics.push("Fundamentals")
  return topics
}

function detectDifficulty(code: string): CoraCodeAnalysis["difficulty"] {
  const lines = code.split("\n").filter((l) => l.trim()).length
  const advanced =
    /\btemplate\b|\bvirtual\b|\bmutex\b|\bthread\b|\bshared_ptr\b|\bunique_ptr\b|recursion|dynamic.?program/i.test(
      code,
    )
  if (advanced || lines > 80) return "Advanced"
  if (lines > 25 || /\bclass\b|\bpointer|\*|vector</i.test(code)) return "Intermediate"
  return "Introductory"
}

function estimateComplexity(code: string, topics: string[]): CoraCodeAnalysis["complexity"] {
  if (/for\s*\([^)]*for\s*\(/.test(code) || /nested/i.test(code)) {
    return {
      time: "O(n²)",
      memory: "O(1)",
      why: "Nested iteration over the input dominates runtime; little extra storage is allocated.",
    }
  }
  if (topics.includes("Recursion") && !/memo|cache|dp/i.test(code)) {
    return {
      time: "O(2ⁿ) possible",
      memory: "O(n)",
      why: "Recursive branching without memoization can explode; call stack grows with depth.",
    }
  }
  if (topics.includes("Arrays") || topics.includes("Loops")) {
    return {
      time: "O(n)",
      memory: "O(1)",
      why: "A single pass (or constant passes) over the data with fixed auxiliary variables.",
    }
  }
  return {
    time: "O(1)–O(n)",
    memory: "O(1)",
    why: "Short routine — cost depends on input size and control flow once filled in.",
  }
}

function lineOf(code: string, re: RegExp): number | undefined {
  const lines = code.split("\n")
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i]!)) return i + 1
  }
  return undefined
}

function detectPedagogicalIssues(
  code: string,
  language: Exclude<CoraCodeLanguage, "auto">,
): CoraCodePedagogicalIssue[] {
  const issues: CoraCodePedagogicalIssue[] = []

  const leq = code.match(/for\s*\([^;]*;\s*\w+\s*<=\s*(\w+)/)
  if (leq) {
    const line = lineOf(code, /for\s*\([^;]*;\s*\w+\s*<=/)
    const snippet = code.split("\n")[(line ?? 1) - 1]?.trim()
    issues.push({
      id: "bounds",
      title: "Possible array bounds error",
      line,
      snippet,
      question: `When the loop index equals ${leq[1]}, what array element will the program attempt to access?`,
      hint: "Valid indices for an array of length n usually run from 0 through n − 1.",
      explain:
        "Using `<= size` (or `<= length`) often reads one past the last valid index — a classic off-by-one.",
      severity: "warning",
    })
  }

  if (language === "cpp" && /\bnew\b/.test(code) && !/\bdelete\b|\bunique_ptr\b|\bshared_ptr\b/.test(code)) {
    issues.push({
      id: "leak",
      title: "Possible memory leak",
      line: lineOf(code, /\bnew\b/),
      question: "Who is responsible for freeing this heap allocation, and when?",
      hint: "Every `new` needs a matching `delete`, or ownership via a smart pointer.",
      explain: "`new` without cleanup (or RAII) leaks memory for the lifetime of the process.",
      severity: "warning",
    })
  }

  if (/while\s*\(\s*true\s*\)|for\s*\(\s*;\s*;\s*\)/.test(code)) {
    issues.push({
      id: "infinite",
      title: "Infinite loop risk",
      line: lineOf(code, /while\s*\(\s*true\s*\)|for\s*\(\s*;\s*;\s*\)/),
      question: "What condition guarantees this loop eventually stops?",
      hint: "Look for a `break`, return, or a changing loop variable that fails the condition.",
      explain: "A loop with no clear exit path can hang — confirm the termination condition.",
      severity: "error",
    })
  }

  if (!/\breturn\b/.test(code) && /int\s+\w+\s*\(/.test(code) && language === "cpp") {
    issues.push({
      id: "return",
      title: "Missing return path",
      question: "On every path through this non-void function, what value is returned?",
      hint: "Trace each branch — if any exits without `return`, the result is undefined.",
      explain: "A non-void function must return on all paths.",
      severity: "warning",
    })
  }

  return issues.slice(0, 4)
}

function qualityLabel(score: number): CoraCodeQualityLabel {
  if (score >= 85) return "Strong"
  if (score >= 70) return "Good"
  return "Needs work"
}

function qualityScore(
  code: string,
  issues: CoraCodePedagogicalIssue[],
): CoraCodeAnalysis["quality"] {
  const lines = Math.max(1, code.split("\n").filter((l) => l.trim()).length)
  const commentRatio = (code.match(/\/\/|\/\*|#|%/g) || []).length / lines
  const penalty = issues.filter((i) => i.severity !== "info").length * 6
  const readabilityN = Math.min(98, Math.round(78 + commentRatio * 40 + Math.min(lines, 40) * 0.2))
  const efficiencyN = Math.min(96, 88 - (/for\s*\([^)]*for\s*\(/.test(code) ? 12 : 0))
  const correctnessN = Math.max(55, 93 - penalty)
  const maintainabilityN = Math.min(
    97,
    Math.round(70 + (/\bclass\b|function|def /.test(code) ? 12 : 5) + commentRatio * 20),
  )
  const overall = Math.round((readabilityN + efficiencyN + correctnessN + maintainabilityN) / 4)
  return {
    overall,
    readability: qualityLabel(readabilityN),
    efficiency: qualityLabel(efficiencyN),
    correctness: qualityLabel(correctnessN),
    maintainability: qualityLabel(maintainabilityN),
  }
}

function mockVariables(code: string): CoraCodeAnalysis["variables"] {
  const names = Array.from(
    code.matchAll(/\b(?:int|double|float|size_t|auto|var|let|const)\s+(\w+)/g),
  ).map((m) => m[1]!)
  const uniq = [...new Set(names)].slice(0, 5)
  if (uniq.length === 0) {
    return [
      { name: "i", value: "0" },
      { name: "sum", value: "0" },
    ]
  }
  return uniq.map((name, idx) => ({
    name,
    value: String(idx === 0 ? 0 : idx === 1 ? 3 : idx),
  }))
}

function mockCallStack(code: string): string[] {
  const fns = Array.from(code.matchAll(/\b([A-Za-z_]\w*)\s*\([^;]*\)\s*\{/g)).map((m) => m[1]!)
  const uniq = [...new Set(fns.filter((f) => !["if", "for", "while", "switch"].includes(f)))].slice(
    0,
    4,
  )
  if (uniq.length === 0) return ["main()"]
  if (!uniq.includes("main")) return ["main()", ...uniq.map((f) => `${f}()`)]
  return uniq.map((f) => `${f}()`)
}

function buildSummary(code: string, topics: string[]): string {
  if (/sum\s*\+|sum\s*\+=/.test(code) && /\bfor\s*\(/.test(code)) {
    return "This program accumulates a running total with a loop — likely summing a sequence of values."
  }
  if (topics.includes("Recursion")) {
    return "This program uses recursion: a function calls itself (directly or indirectly) to solve a smaller subproblem."
  }
  if (topics.includes("Pointers")) {
    return "This program works with pointers or addresses — pay attention to what each pointer refers to and when memory is valid."
  }
  if (topics.includes("Classes")) {
    return "This program defines or uses a class/struct — behavior is split across data members and methods."
  }
  if (topics.includes("Loops")) {
    return "This program uses iteration to process values repeatedly until a stopping condition is met."
  }
  return "This program implements a short routine. Focus on inputs, control flow, and what gets printed or returned."
}

function buildNotice(topics: string[], variables: CoraCodeAnalysis["variables"]): string {
  const accum = variables.find((v) => /sum|total|acc|count/i.test(v.name))
  if (accum) {
    return `\`${accum.name}\` acts as an accumulator. Its value typically changes on every iteration.`
  }
  if (topics.includes("Pointers")) {
    return "Trace what each pointer points to after every assignment — aliases make bugs subtle."
  }
  if (topics.includes("Loops")) {
    return "Watch the loop variable and the stopping condition — most logic errors hide there."
  }
  return "Read the program top-to-bottom once, then predict the output before stepping execution."
}

function buildSuggestions(code: string, issues: CoraCodePedagogicalIssue[]): string[] {
  const tips: string[] = []
  if (/\b[a-z]\b\s*=/.test(code) && !/\bsum\b|\bcount\b|\bindex\b/.test(code)) {
    tips.push("Prefer descriptive variable names instead of single letters where meaning matters.")
  }
  if ((code.match(/\bfor\s*\(/g) || []).length >= 2) {
    tips.push("Repeated blocks can often become a helper function for clarity.")
  }
  if (!/cin\s*>>|scanf|input\(|readline|prompt/i.test(code) && /int\s+n\b/.test(code)) {
    tips.push("Consider validating input before processing.")
  }
  if (issues.some((i) => i.id === "bounds")) {
    tips.push("Double-check loop bounds against array length (0 … n−1).")
  }
  if (tips.length === 0) {
    tips.push("Add a brief comment stating the program’s purpose in one sentence.")
    tips.push("Write one edge-case test (empty input, n = 0, or max size).")
  }
  return tips.slice(0, 3)
}

function buildChallenges(topics: string[], code: string): CoraCodeChallenge[] {
  const challenges: CoraCodeChallenge[] = [
    {
      id: "predict",
      level: "Easy",
      prompt: "Predict the output before running the program. Then compare.",
    },
  ]
  if (topics.includes("Loops") || /\bfor\s*\(/.test(code)) {
    challenges.push({
      id: "even",
      level: "Medium",
      prompt: "Modify the loop so it only processes even values (or every other element).",
    })
    challenges.push({
      id: "no-for",
      level: "Hard",
      prompt: "Rewrite the algorithm so it works without using a `for` loop.",
    })
  } else if (topics.includes("Recursion")) {
    challenges.push({
      id: "iterative",
      level: "Medium",
      prompt: "Rewrite the recursive solution iteratively and compare stack usage.",
    })
    challenges.push({
      id: "memo",
      level: "Hard",
      prompt: "Add memoization (or dynamic programming) and explain the new complexity.",
    })
  } else if (topics.includes("Pointers")) {
    challenges.push({
      id: "draw",
      level: "Medium",
      prompt: "Draw the pointer/pointee relationships after each assignment.",
    })
    challenges.push({
      id: "ownership",
      level: "Hard",
      prompt: "Refactor to make ownership explicit (e.g., smart pointers or clear free points).",
    })
  } else {
    challenges.push({
      id: "edge",
      level: "Medium",
      prompt: "Add handling for an edge case your current code does not cover.",
    })
    challenges.push({
      id: "variant",
      level: "Hard",
      prompt: "Change the algorithm to a different approach with the same result.",
    })
  }
  return challenges.slice(0, 3)
}

function buildExecutionSteps(topics: string[]): CoraCodeAnalysis["executionSteps"] {
  return [
    { id: "compile", label: "Compile", detail: "Syntax check / translate source" },
    { id: "init", label: "Initialize", detail: "Declare and set starting values" },
    {
      id: "loop",
      label: topics.includes("Loops") ? "Loop body" : "Execute",
      detail: topics.includes("Loops") ? "Update accumulators / indices" : "Run main logic",
    },
    {
      id: "fn",
      label: topics.includes("Functions") ? "Call function" : "Continue",
      detail: topics.includes("Functions") ? "Enter callee frame" : "Finish remaining statements",
    },
    { id: "out", label: "Output", detail: "Print or return result" },
  ]
}

export function analyzeCode(
  code: string,
  filename?: string,
  languageOverride?: CoraCodeLanguage,
): CoraCodeAnalysis | null {
  const trimmed = code.trim()
  if (!trimmed) return null

  const detected = detectCodeLanguage(trimmed, filename)
  const language =
    languageOverride && languageOverride !== "auto" ? languageOverride : detected
  const topics = detectTopics(trimmed)
  const difficulty = detectDifficulty(trimmed)
  const issues = detectPedagogicalIssues(trimmed, language)
  const variables = mockVariables(trimmed)
  const realIssues = issues.filter((i) => i.severity !== "info")
  const suggestions = buildSuggestions(trimmed, issues)

  return {
    language,
    languageLabel: LANGUAGE_LABEL[language],
    compiles: !issues.some((i) => i.id === "return" && i.severity === "error"),
    runtimeOk: !issues.some((i) => i.id === "infinite"),
    improvementCount: Math.max(suggestions.length, realIssues.length),
    summary: buildSummary(trimmed, topics),
    keyConcepts: topics.slice(0, 4),
    notice: buildNotice(topics, variables),
    difficulty,
    estimatedMinutes: difficulty === "Introductory" ? 3 : difficulty === "Intermediate" ? 5 : 9,
    topics,
    complexity: estimateComplexity(trimmed, topics),
    issues,
    suggestions,
    quality: qualityScore(trimmed, issues),
    variables,
    callStack: mockCallStack(trimmed),
    executionSteps: buildExecutionSteps(topics),
    outputPreview: /cout\s*<<|print\s*\(|printf\s*\(|disp\s*\(/.test(trimmed)
      ? "Waiting…"
      : "No output statement detected",
    challenges: buildChallenges(topics, trimmed),
    relatedConcepts: [
      ...topics.slice(0, 2),
      "Algorithm Complexity",
    ].filter((v, i, a) => a.indexOf(v) === i),
  }
}

export function buildCodeActionPrompt(actionId: CoraCodeActionId, code: string): string {
  const action = CORA_CODE_ACTIONS.find((a) => a.id === actionId)
  const body = code.trim()
    ? `${action?.prompt ?? "Help with this code."}\n\n\`\`\`\n${code.trim()}\n\`\`\``
    : `${action?.prompt ?? "Help with this code."}\n\n(No code pasted yet — ask what to write.)`
  return body
}

export function deriveCodeContinue(ctx: CoraStudentContextPayload | null | undefined): CoraCodeContinue {
  const submissions = (ctx?.codebenchSubmissions || []) as Array<Record<string, unknown>>
  const latest = submissions[0]
  const avg = ctx?.summary?.avgCodebenchScore || 0
  const total = ctx?.summary?.totalCodebenchSubmissions || 0

  if (latest || total > 0) {
    const title = String(
      latest?.title || latest?.problem_title || latest?.assignment_name || "Last CodeBench session",
    )
    const chapter = String(latest?.chapter || latest?.topic || "Programming")
    const score = Number(latest?.score ?? avg) || Math.min(90, 40 + total * 3)
    return {
      hasSession: true,
      title,
      subtitle: chapter.includes("•") ? chapter : `Continue · ${chapter}`,
      progressPct: Math.max(8, Math.min(99, Math.round(score))),
      href: "/student/dashboard-v2/codebench",
    }
  }

  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(CODE_SESSION_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { title?: string; subtitle?: string; progressPct?: number }
        if (parsed.title) {
          return {
            hasSession: true,
            title: parsed.title,
            subtitle: parsed.subtitle || "Local draft",
            progressPct: parsed.progressPct ?? 35,
            href: "/student/dashboard-v2/codebench",
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  return {
    hasSession: false,
    title: "Start Coding",
    subtitle: "Write better code. Understand every line. Cora coaches — CodeBench runs.",
    progressPct: 0,
    href: "/student/dashboard-v2/codebench",
  }
}

export function saveCodeSessionDraft(input: {
  title: string
  subtitle?: string
  progressPct?: number
}): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(CODE_SESSION_KEY, JSON.stringify(input))
  } catch {
    /* ignore */
  }
}

export function acceptedCodeUpload(file: File): boolean {
  const name = file.name.toLowerCase()
  return (
    /\.(cpp|cc|cxx|c|h|hpp|hxx|m|py|java|js|ts|tsx|jsx|zip|txt)$/.test(name) ||
    file.type.startsWith("text/") ||
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed"
  )
}
