import type { StudioDiagnostic } from "@/lib/codebench-compiler-diagnostics"

export type StudioErrorFamily =
  | "missing-semicolon"
  | "undeclared-name"
  | "type-mismatch"
  | "missing-include"
  | "return-issue"
  | "brace-mismatch"
  | "unused-or-warning"
  | "linker"
  | "runtime"
  | "timeout"
  | "other"

export type StudioEventType =
  | "run"
  | "compile_success"
  | "compile_error"
  | "runtime_exit"
  | "cora_tool"
  | "save"
  | "suggest_fix"

export type StudioEvent = {
  id: string
  at: number
  type: StudioEventType
  language?: string
  fileName?: string
  tool?: string
  success?: boolean
  errorFamily?: StudioErrorFamily
  errorMessage?: string
  line?: number
  exitCode?: number | null
}

export type StudioErrorStat = {
  family: StudioErrorFamily
  label: string
  count: number
  share: number
  tip: string
  why: string
  nextMove: string
  checks: string[]
  lastMessage?: string
  lastFile?: string
  lastLine?: number
  lastAt?: number
}

export type StudioLogItem = {
  at: number
  title: string
  detail: string
  tone: "error" | "ok" | "tool" | "info"
}

export type StudioSnapshot = {
  runs: number
  compileErrors: number
  compileSuccesses: number
  successRate: number
  saves: number
  suggestFixes: number
  toolsUsed: Record<string, number>
  topTools: Array<{ tool: string; label: string; count: number }>
  topErrors: StudioErrorStat[]
  lastError: StudioErrorStat | null
  coachTitle: string
  coachBody: string
  habit: string
  nextActionLabel: string
  nextActionDetail: string
  focusSkill: string
  coraBrief: string
  workshopLog: StudioLogItem[]
  recent: StudioEvent[]
}

const STORAGE_PREFIX = "codebench_studio_analytics_v1_"
const MAX_EVENTS = 400

const FAMILY_COPY: Record<
  StudioErrorFamily,
  { label: string; tip: string; why: string; nextMove: string; checks: string[] }
> = {
  "missing-semicolon": {
    label: "Missing semicolon",
    tip: "C++ statements end with `;`. Check the flagged line and the line above it.",
    why: "Clang often points one line below the real miss. The program never starts until that first `;` is there.",
    nextMove: "Open the file, add `;` on the flagged line or the line above, then Run once — do not edit anything else yet.",
    checks: [
      "Read the first diagnostic only",
      "Look at that line and the line above it",
      "Add the `;`, then Run again before asking Cora",
    ],
  },
  "undeclared-name": {
    label: "Undeclared name",
    tip: "The compiler does not know that identifier yet. Check spelling, scope, and whether you declared it.",
    why: "A typo or a name used before it is declared stops the whole build. Later errors are usually leftovers.",
    nextMove: "Copy the exact name from the error, find where you meant to declare it, then Run again.",
    checks: ["Spelling and capitalization", "Declared before first use", "Right scope / `#include` if it is from a header"],
  },
  "type-mismatch": {
    label: "Type mismatch",
    tip: "A value is the wrong type for that slot. Match the declared type, or convert it on purpose.",
    why: "C++ will not silently change a type the way some languages do. The first mismatch is the one to fix.",
    nextMove: "Match the value to the declared type, or convert it on purpose, then Run.",
    checks: ["What type did you declare?", "What type is the value?", "Is a cast actually what you want?"],
  },
  "missing-include": {
    label: "Missing include",
    tip: "Add the header that declares the name, such as `#include <iostream>` for `cout`.",
    why: "`cout`, `string`, and `vector` live in headers. Without the include, they look undeclared.",
    nextMove: "Add the matching `#include` at the top, then Run.",
    checks: ["`cout` / `cin` → `<iostream>`", "`string` → `<string>`", "`vector` → `<vector>`"],
  },
  "return-issue": {
    label: "Return / main exit",
    tip: "Every non-void function needs a return, and `main` should return an int.",
    why: "A missing `return` is undefined behavior. `main` should end with `return 0;`.",
    nextMove: "Give every non-void path a return, and put `return 0;` at the end of `main`.",
    checks: ["Does every branch return?", "Is `return 0;` present in `main`?", "Did you forget the `;` after return?"],
  },
  "brace-mismatch": {
    label: "Brace or parenthesis",
    tip: "Count `{` `}` and `(` `)`. A missing closer often shows up on a later line.",
    why: "One missing `}` makes clang complain far below the real hole.",
    nextMove: "Count braces from the top of the function clang named. Fix the first imbalance, then Run.",
    checks: ["Match every `{` with `}`", "Match every `(` with `)`", "Fix the earliest mismatch first"],
  },
  "unused-or-warning": {
    label: "Warning / unused",
    tip: "Warnings are practice for clean code. Unused names usually mean leftover draft work.",
    why: "The program may still run, but leftover names hide real bugs later.",
    nextMove: "Delete or use the unused name, then Run so the warning list shrinks.",
    checks: ["Is the name leftover draft?", "Did you mean to use it in a print or return?", "Treat warnings as a cleanup pass"],
  },
  linker: {
    label: "Linker",
    tip: "The compiler finished, but a symbol is missing at link time. Check the function name and definition.",
    why: "You called a function the linker cannot find — usually a name mismatch or a missing definition.",
    nextMove: "Match the call to the exact function definition, then Run.",
    checks: ["Same spelling as the definition", "Definition is in this file or linked", "Argument types match"],
  },
  runtime: {
    label: "Runtime exit",
    tip: "The program compiled, then exited with a non-zero code. Print more, then step through the last output.",
    why: "The build was clean. The bug is in the running program — a crash, a wrong return, or missing input.",
    nextMove: "Read the last terminal line, add one print before the crash, then Run again.",
    checks: ["What was the last printed line?", "Are you waiting on `cin`?", "Did `main` return a non-zero code?"],
  },
  timeout: {
    label: "Time limit",
    tip: "The program ran too long. Look for a loop that never ends, or input the process is waiting for.",
    why: "An infinite loop or a blocking `cin` looks like a hang.",
    nextMove: "Stop the run, then check the last loop condition or whether the program is waiting for typed input.",
    checks: ["Does the loop condition ever become false?", "Is the program waiting for you to type?", "Did you mean to Stop?"],
  },
  other: {
    label: "Other compiler note",
    tip: "Read the first error only. Later errors are often leftovers from that first mistake.",
    why: "The first diagnostic is the teacher. The rest usually disappear after that one fix.",
    nextMove: "Fix only the first error clang printed, then Run again.",
    checks: ["Read the first error in the terminal", "Change one line", "Run again before the next edit"],
  },
}

const TOOL_LABEL: Record<string, string> = {
  explain: "Explain",
  walkthrough: "Walkthrough",
  debug: "Debug",
  improve: "Improve",
  pseudocode: "Pseudo",
  tutor: "Tutor",
  practice: "Practice",
  evaluate: "Evaluate",
}

export function studioToolLabel(tool: string) {
  return TOOL_LABEL[tool] ?? tool
}

const FAMILY_RULES: Array<{ family: StudioErrorFamily; test: RegExp }> = [
  { family: "missing-semicolon", test: /expected ';'|expected semicolon/i },
  { family: "undeclared-name", test: /undeclared|was not declared|unknown type name|use of undeclared/i },
  { family: "missing-include", test: /iostream|no member named|did you forget to '#include'|file not found/i },
  { family: "type-mismatch", test: /cannot convert|invalid conversion|no viable conversion|mismatched types|incompatible/i },
  { family: "return-issue", test: /return type|non-void function|control reaches end|void function/i },
  { family: "brace-mismatch", test: /expected '\}'|expected '\{'|expected '\)'|unmatched|extraneous closing/i },
  { family: "linker", test: /undefined reference|ld:|symbol\(s\) not found|duplicate symbol/i },
  { family: "timeout", test: /time limit|timed out/i },
  { family: "unused-or-warning", test: /unused|warning:/i },
]

export function classifyCompilerMessage(message: string): StudioErrorFamily {
  const text = message.trim()
  if (!text) return "other"
  for (const rule of FAMILY_RULES) {
    if (rule.test.test(text)) return rule.family
  }
  return "other"
}

export function studioFamilyLabel(family: StudioErrorFamily) {
  return FAMILY_COPY[family].label
}

export function studioFamilyTip(family: StudioErrorFamily) {
  return FAMILY_COPY[family].tip
}

export function diagnosticsToFamilies(diagnostics: StudioDiagnostic[]) {
  return diagnostics
    .filter((item) => item.severity === "error" || item.severity === "fatal")
    .map((item) => ({
      family: classifyCompilerMessage(item.message),
      message: item.message,
    }))
}

function storageKey(studentId: string) {
  return `${STORAGE_PREFIX}${studentId || "local"}`
}

function newId() {
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function loadStudioEvents(studentId: string): StudioEvent[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(storageKey(studentId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as StudioEvent[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveStudioEvents(studentId: string, events: StudioEvent[]) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(storageKey(studentId), JSON.stringify(events.slice(-MAX_EVENTS)))
  } catch {
    // ignore quota
  }
}

let liveAssignmentId: string | null = null

/** Tag studio events with the live classroom the editor is streaming to (null when not live). */
export function setStudioLiveAssignment(assignmentId: string | null) {
  liveAssignmentId = assignmentId?.trim() || null
}

export function recordStudioEvent(studentId: string, event: Omit<StudioEvent, "id" | "at">): StudioEvent {
  const next: StudioEvent = { ...event, id: newId(), at: Date.now() }
  const events = [...loadStudioEvents(studentId), next]
  saveStudioEvents(studentId, events)
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("codebench-studio-analytics", { detail: next }))
    void fetch("/api/codebench/studio-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        ...event,
        liveAssignmentId: liveAssignmentId ? Number(liveAssignmentId) : null,
      }),
    }).catch(() => undefined)
  }
  return next
}

function familyGuide(family: StudioErrorFamily) {
  return FAMILY_COPY[family] ?? FAMILY_COPY.other
}

function toErrorStat(
  family: StudioErrorFamily,
  count: number,
  totalErrors: number,
  sample?: StudioEvent,
): StudioErrorStat {
  const guide = familyGuide(family)
  return {
    family,
    count,
    share: totalErrors === 0 ? 0 : Math.round((count / totalErrors) * 100),
    label: guide.label,
    tip: guide.tip,
    why: guide.why,
    nextMove: guide.nextMove,
    checks: guide.checks,
    lastMessage: sample?.errorMessage,
    lastFile: sample?.fileName,
    lastLine: sample?.line,
    lastAt: sample?.at,
  }
}

export function buildStudioSnapshot(events: StudioEvent[]): StudioSnapshot {
  const runs = events.filter((event) => event.type === "run").length
  const compileErrors = events.filter((event) => event.type === "compile_error").length
  const compileSuccesses = events.filter((event) => event.type === "compile_success").length
  const saves = events.filter((event) => event.type === "save").length
  const suggestFixes = events.filter((event) => event.type === "suggest_fix").length
  const decided = compileErrors + compileSuccesses
  const successRate = decided === 0 ? 0 : Math.round((compileSuccesses / decided) * 100)
  const toolsUsed: Record<string, number> = {}
  for (const event of events) {
    if (event.type === "cora_tool" && event.tool) {
      toolsUsed[event.tool] = (toolsUsed[event.tool] ?? 0) + 1
    }
  }
  const latestByFamily = new Map<StudioErrorFamily, StudioEvent>()
  const counts = new Map<StudioErrorFamily, number>()
  for (const event of events) {
    if (event.type !== "compile_error" || !event.errorFamily) continue
    counts.set(event.errorFamily, (counts.get(event.errorFamily) ?? 0) + 1)
    latestByFamily.set(event.errorFamily, event)
  }
  const topErrors = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([family, count]) => toErrorStat(family, count, compileErrors, latestByFamily.get(family)))
  const lastErrorEvent = [...events].reverse().find((event) => event.type === "compile_error" && event.errorFamily)
  const lastError = lastErrorEvent?.errorFamily
    ? toErrorStat(
        lastErrorEvent.errorFamily,
        counts.get(lastErrorEvent.errorFamily) ?? 1,
        compileErrors,
        lastErrorEvent,
      )
    : null

  const focus = topErrors[0]
  const coach = buildCoachCopy({ runs, compileErrors, compileSuccesses, successRate, focus, lastError })
  const coraBrief = buildCoraBrief({ topErrors, successRate, compileErrors, compileSuccesses, toolsUsed })
  const topTools = Object.entries(toolsUsed)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([tool, count]) => ({ tool, label: studioToolLabel(tool), count }))

  return {
    runs,
    compileErrors,
    compileSuccesses,
    successRate,
    saves,
    suggestFixes,
    toolsUsed,
    topTools,
    topErrors,
    lastError,
    coachTitle: coach.title,
    coachBody: coach.body,
    habit: coach.habit,
    nextActionLabel: coach.nextActionLabel,
    nextActionDetail: coach.nextActionDetail,
    focusSkill: focus?.label ?? "First clean compile",
    coraBrief,
    workshopLog: buildWorkshopLog(events),
    recent: events.slice(-12).reverse(),
  }
}

function buildCoachCopy(input: {
  runs: number
  compileErrors: number
  compileSuccesses: number
  successRate: number
  focus?: StudioErrorStat
  lastError: StudioErrorStat | null
}) {
  if (input.runs === 0) {
    return {
      title: "Cora is watching your workshop",
      body: "Run, save, and ask Cora from the editor. Your compile habits and common faults become a private coach note for you — and a class heat map for your instructor.",
      habit: "Change one thing, Run, read the first diagnostic.",
      nextActionLabel: "Open the editor and Run",
      nextActionDetail: "Your first compile becomes the start of this story.",
    }
  }
  if (input.focus && input.compileErrors >= 2) {
    return {
      title: `Your pattern: ${input.focus.label.toLowerCase()}`,
      body: `This is ${input.focus.share || 0}% of your failed builds (${input.focus.count}×). ${input.focus.why}`,
      habit: "Fix the first clang error only, then Run again.",
      nextActionLabel: input.focus.nextMove,
      nextActionDetail: input.focus.tip,
    }
  }
  if (input.lastError) {
    const where = input.lastError.lastFile
      ? `${input.lastError.lastFile}${input.lastError.lastLine ? `:${input.lastError.lastLine}` : ""}`
      : "the last file you ran"
    return {
      title: `Last trip-up: ${input.lastError.label.toLowerCase()}`,
      body: `Clang stopped ${where}. ${input.lastError.why}`,
      habit: "Read the first diagnostic, change one line, Run.",
      nextActionLabel: input.lastError.nextMove,
      nextActionDetail: input.lastError.tip,
    }
  }
  if (input.successRate >= 70) {
    return {
      title: "Your compile rhythm is getting clean",
      body: `${input.successRate}% of recent builds succeeded (${input.compileSuccesses} clean / ${input.compileErrors} failed). Keep the short loop.`,
      habit: "Change one thing, Run, read the first diagnostic.",
      nextActionLabel: "Keep a clean-build streak",
      nextActionDetail: "Ask Cora only if the next diagnostic still feels opaque.",
    }
  }
  return {
    title: "Build a compile streak",
    body: "You are using the editor. The next win is a clean compile.",
    habit: "Read the first error, change one line, Run again.",
    nextActionLabel: "Run until the first diagnostic is gone",
    nextActionDetail: "Later errors often vanish after that one fix.",
  }
}

function buildWorkshopLog(events: StudioEvent[]): StudioLogItem[] {
  return [...events]
    .reverse()
    .slice(0, 10)
    .map((event) => {
      const whenFile = event.fileName ? ` in ${event.fileName}` : ""
      if (event.type === "compile_error") {
        const label = event.errorFamily ? familyGuide(event.errorFamily).label : "Compiler error"
        return {
          at: event.at,
          title: label,
          detail: event.errorMessage || `Compile failed${whenFile}`,
          tone: "error" as const,
        }
      }
      if (event.type === "compile_success") {
        return { at: event.at, title: "Clean compile", detail: `Build succeeded${whenFile}`, tone: "ok" as const }
      }
      if (event.type === "runtime_exit") {
        return {
          at: event.at,
          title: "Runtime exit",
          detail: `Exited ${event.exitCode != null ? `with code ${event.exitCode}` : "after run"}${whenFile}`,
          tone: "error" as const,
        }
      }
      if (event.type === "suggest_fix") {
        return {
          at: event.at,
          title: "Asked Cora to suggest a fix",
          detail: event.errorMessage || "Cora read the compiler output",
          tone: "tool" as const,
        }
      }
      if (event.type === "cora_tool") {
        return {
          at: event.at,
          title: `Cora · ${studioToolLabel(event.tool || "tool")}`,
          detail: `Opened ${studioToolLabel(event.tool || "a tool")}${whenFile}`,
          tone: "tool" as const,
        }
      }
      if (event.type === "save") {
        return { at: event.at, title: "Saved", detail: event.fileName || "File saved", tone: "info" as const }
      }
      return { at: event.at, title: "Ran program", detail: `Pressed Run${whenFile}`, tone: "info" as const }
    })
}

function buildCoraBrief(input: {
  topErrors: StudioErrorStat[]
  successRate: number
  compileErrors: number
  compileSuccesses: number
  toolsUsed: Record<string, number>
}) {
  const errors =
    input.topErrors.length > 0
      ? input.topErrors.map((item) => `${item.label} (${item.count})`).join(", ")
      : "none recorded yet"
  const tools =
    Object.entries(input.toolsUsed)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([tool, count]) => `${tool}×${count}`)
      .join(", ") || "none yet"
  return [
    `CodeBench studio: compile success ${input.successRate}% (${input.compileSuccesses} clean / ${input.compileErrors} failed).`,
    `Common faults: ${errors}.`,
    `Cora tools used: ${tools}.`,
    "Remind the student of their most common fault, why it happens, and one small habit to improve. Do not rewrite their whole program.",
  ].join(" ")
}

export function getStudioSnapshot(studentId: string) {
  return buildStudioSnapshot(loadStudioEvents(studentId))
}

export function studioContextForPrompts(studentId: string) {
  return getStudioSnapshot(studentId).coraBrief
}

export function studioPromptBlock(studioContext?: unknown) {
  const text = typeof studioContext === "string" ? studioContext.trim() : ""
  if (!text) return ""
  return `\n\nStudent CodeBench studio history (remind them of their common fault and one small habit to improve; do not rewrite their whole program):\n${text.slice(0, 900)}`
}
