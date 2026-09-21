/**
 * Compact Programming I topics for CodeBench teaching.
 * Questions map onto this list so the filter stays short — not one topic per prompt.
 */

export type CodebenchCourseTopicId =
  | "input-output"
  | "basic-arithmetic"
  | "if-statements"
  | "nested-if"
  | "switch"
  | "ternary"
  | "while-loops"
  | "do-while"
  | "for-loops"
  | "nested-for"
  | "arrays"
  | "functions"
  | "pointers"
  | "other"

export type CodebenchCourseTopic = {
  id: CodebenchCourseTopicId
  label: string
}

export const CODEBENCH_COURSE_TOPICS: readonly CodebenchCourseTopic[] = [
  { id: "input-output", label: "Input/output" },
  { id: "basic-arithmetic", label: "Basic arithmetic" },
  { id: "if-statements", label: "If statements" },
  { id: "nested-if", label: "Nested if statements" },
  { id: "switch", label: "Switch statements" },
  { id: "ternary", label: "Ternary operator" },
  { id: "while-loops", label: "While loops" },
  { id: "do-while", label: "Do-while loops" },
  { id: "for-loops", label: "For loops" },
  { id: "nested-for", label: "Nested for loops" },
  { id: "arrays", label: "Arrays" },
  { id: "functions", label: "Functions" },
  { id: "pointers", label: "Pointers" },
  { id: "other", label: "Other" },
] as const

const TOPIC_BY_ID = new Map(CODEBENCH_COURSE_TOPICS.map((topic) => [topic.id, topic]))
const TOPIC_BY_LABEL = new Map(
  CODEBENCH_COURSE_TOPICS.map((topic) => [topic.label.toLowerCase(), topic]),
)

const TOPIC_ALIASES: Record<string, CodebenchCourseTopicId> = {
  loops: "for-loops",
  loop: "for-loops",
  "for loop": "for-loops",
  "for loops": "for-loops",
  "for-loop": "for-loops",
  "while loop": "while-loops",
  "while loops": "while-loops",
  "do while": "do-while",
  "do-while": "do-while",
  "nested loop": "nested-for",
  "nested loops": "nested-for",
  conditionals: "if-statements",
  conditional: "if-statements",
  selection: "if-statements",
  "if else": "if-statements",
  "if-else": "if-statements",
  "else if": "nested-if",
  "if statements": "if-statements",
  io: "input-output",
  "i/o": "input-output",
  "input output": "input-output",
  arithmetic: "basic-arithmetic",
  maths: "basic-arithmetic",
  math: "basic-arithmetic",
}

type TopicRule = {
  id: CodebenchCourseTopicId
  pattern: RegExp
}

/** Most specific constructs first so “nested for” is not swallowed by “for”. */
const CLASSIFY_RULES: TopicRule[] = [
  {
    id: "nested-for",
    pattern:
      /\bnested\s+for\b|\bnested\s+loops?\b|\bfor\s+loop\s+inside\b|\bdouble\s+for\b|\btwo[-\s]?dimensional\b|\b2d\s+array\b|\bmultiplication\s+table\b/i,
  },
  {
    id: "nested-if",
    pattern: /\bnested\s+if\b|\bif\s+inside\s+(?:an?\s+)?if\b|\belse\s*if\b|\bif[-\s]else[-\s]if\b/i,
  },
  { id: "do-while", pattern: /\bdo[-\s]?while\b/i },
  { id: "ternary", pattern: /\bternary\b|\bconditional\s+operator\b/i },
  {
    id: "switch",
    pattern:
      /\bswitch\s*(?:statement|case|\()|\bcase\s+['"]?\w+|\bmenu\b|\bselector\b|\bmenu option\b|\bselect a\b|\*\s*`?1`?\s*→/i,
  },
  { id: "for-loops", pattern: /\bfor[-\s]?loops?\b|\bfor\s*\(|\biterate\b|\biteration\b/i },
  { id: "while-loops", pattern: /\bwhile[-\s]?loops?\b|\bwhile\s*\(/i },
  { id: "pointers", pattern: /\bpointers?\b|\bdereference\b|\bpointer\s+to\b/i },
  { id: "arrays", pattern: /\barrays?\b|\bvector\b|\bindices\b|\bindex\s+of\b/i },
  {
    id: "functions",
    pattern: /\bfunctions?\b|\bvoid\s+\w+\s*\(|\bparameter\b|\breturn\s+type\b|\bprototype\b/i,
  },
  {
    id: "if-statements",
    pattern:
      /\bif[-\s]?statements?\b|\bif[-\s]else\b|\bif\b|\belse\b|\botherwise\b|\bwhether\b|\b(?:check|status|surcharge|eligib|greater\s+than|less\s+than|at\s+least|at\s+most|or\s+lower|or\s+higher)\b/i,
  },
  {
    id: "basic-arithmetic",
    pattern:
      /\barithmetic\b|\baverage\b|\bsum\b|\bproduct\b|\bquotient\b|\bremainder\b|\bmodulo\b|\badd(?:ition)?\b|\bsubtract(?:ion)?\b|\bmultipl(?:y|ication)\b|\bdivid(?:e|es|ing|ision)\b|\barea\b|\bvolume\b|\bcalculat(?:e|or)\b|\bformula\b|\bconvert\b|\bcelsius\b|\bfahrenheit\b|\bcost\b|\bpay\b|\bmileage\b/i,
  },
  {
    id: "input-output",
    pattern:
      /\binput\s*\/?\s*output\b|\bhello\s+world\b|\bprintf\b|\bscanf\b|\bcin\b|\bcout\b|\bread\s+(?:a|the|from)\b|\bprompt\s+the\s+user\b/i,
  },
]

export function codebenchTopicById(id: string | null | undefined): CodebenchCourseTopic {
  return TOPIC_BY_ID.get(id as CodebenchCourseTopicId) ?? TOPIC_BY_ID.get("other")!
}

export function resolveCodebenchCourseTopic(
  raw: string | null | undefined,
): CodebenchCourseTopic | null {
  const value = String(raw ?? "").trim().toLowerCase().replace(/\s+/g, " ")
  if (!value) return null
  const byLabel = TOPIC_BY_LABEL.get(value)
  if (byLabel) return byLabel
  const byId = TOPIC_BY_ID.get(value as CodebenchCourseTopicId)
  if (byId) return byId
  const alias = TOPIC_ALIASES[value]
  if (alias) return TOPIC_BY_ID.get(alias) ?? null
  return null
}

export function classifyCodebenchCourseTopic(
  ...parts: Array<string | null | undefined>
): CodebenchCourseTopic {
  const stored = parts.map((part) => resolveCodebenchCourseTopic(part)).find(Boolean)
  if (stored) return stored

  const haystack = parts.filter(Boolean).join(" \n ")
  for (const rule of CLASSIFY_RULES) {
    if (rule.pattern.test(haystack)) return TOPIC_BY_ID.get(rule.id)!
  }
  return TOPIC_BY_ID.get("other")!
}

export function groupRowsByCodebenchTopic<T>(
  rows: T[],
  topicOf: (row: T) => CodebenchCourseTopic,
): Array<[CodebenchCourseTopic, T[]]> {
  const buckets = new Map<CodebenchCourseTopicId, T[]>()
  for (const row of rows) {
    const topic = topicOf(row)
    const list = buckets.get(topic.id) ?? []
    list.push(row)
    buckets.set(topic.id, list)
  }
  return CODEBENCH_COURSE_TOPICS.filter((topic) => buckets.has(topic.id)).map((topic) => [
    topic,
    buckets.get(topic.id) ?? [],
  ])
}

export function codebenchTopicsPresent<T>(
  rows: T[],
  topicOf: (row: T) => CodebenchCourseTopic,
): CodebenchCourseTopic[] {
  const seen = new Set<CodebenchCourseTopicId>()
  for (const row of rows) seen.add(topicOf(row).id)
  return CODEBENCH_COURSE_TOPICS.filter((topic) => seen.has(topic.id))
}

export const CODEBENCH_TOPIC_SELECT_CLASS =
  "h-9 shrink-0 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-sm"
