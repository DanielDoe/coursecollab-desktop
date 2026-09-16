export const CODEBENCH_MISTAKE_KINDS = [
  "missing_semicolon",
  "cin_wrong_operator",
  "cout_wrong_operator",
] as const

export type CodebenchMistakeKind = (typeof CODEBENCH_MISTAKE_KINDS)[number]

export type CodebenchMistakeHit = {
  kind: CodebenchMistakeKind
  label: string
  line: number
  snippet: string
}

export const CODEBENCH_MISTAKE_LABELS: Record<CodebenchMistakeKind, string> = {
  missing_semicolon: "Missing semicolon",
  cin_wrong_operator: "cin used << instead of >>",
  cout_wrong_operator: "cout used >> instead of <<",
}

export const CODEBENCH_MISTAKE_DETAIL: Record<CodebenchMistakeKind, string> = {
  missing_semicolon:
    "These CodeBench submissions have a C++ statement that never ends with a semicolon. The compiler stops there.",
  cin_wrong_operator:
    "cin reads input with >> . These submissions used << — the cout / insertion operator — on cin.",
  cout_wrong_operator:
    "cout writes output with << . These submissions used >> — the cin / extraction operator — on cout.",
}

function stripLine(raw: string) {
  return raw.replace(/\$\d+\s*$/, "").split("//")[0].trim()
}

function isSkippable(line: string) {
  if (!line) return true
  if (line.startsWith("#") || line.startsWith("/*") || line.startsWith("*")) return true
  if (/^[\s{}]*$/.test(line)) return true
  if (line.endsWith("{") || line.endsWith("\\") || line.endsWith(",")) return true
  if (line === "}" || line === "{") return true
  return false
}

function looksLikeStatement(line: string) {
  return (
    /^(cin|cout|cerr|return|using)\b/.test(line) ||
    /^(int|double|float|char|bool|long|short|unsigned|auto|string)\b/.test(line) ||
    /^[A-Za-z_]\w*\s*=/.test(line)
  )
}

/** Static findings from actual student CodeBench source — not inferred chat labels. */
export function scanCodebenchMistakes(code?: string | null): CodebenchMistakeHit[] {
  const src = String(code ?? "")
  if (!src.trim()) return []
  const hits: CodebenchMistakeHit[] = []
  src.split("\n").forEach((raw, i) => {
    const line = stripLine(raw)
    if (isSkippable(line)) return
    const n = i + 1
    const snippet = line.slice(0, 160)

    if (/\bcin\s*<</.test(line)) {
      hits.push({
        kind: "cin_wrong_operator",
        label: CODEBENCH_MISTAKE_LABELS.cin_wrong_operator,
        line: n,
        snippet,
      })
      return
    }
    if (/\bcout\s*>>/.test(line)) {
      hits.push({
        kind: "cout_wrong_operator",
        label: CODEBENCH_MISTAKE_LABELS.cout_wrong_operator,
        line: n,
        snippet,
      })
      return
    }
    if (/^(int|void|double|float|char|bool|auto|string|long)\s+\w+\s*\(/.test(line) && !/;$/.test(line)) {
      return
    }
    if (looksLikeStatement(line) && !/;$/.test(line) && !line.endsWith("<<") && !line.endsWith(">>")) {
      hits.push({
        kind: "missing_semicolon",
        label: CODEBENCH_MISTAKE_LABELS.missing_semicolon,
        line: n,
        snippet,
      })
    }
  })
  return hits
}
