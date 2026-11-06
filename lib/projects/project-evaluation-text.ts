export type ParsedRubricItem = { title: string; level: string | null; note: string }

export type ParsedProjectEvaluation = {
  score: string | null
  reason: string | null
  rubric: ParsedRubricItem[]
  didWell: string[]
  missing: string[]
  improve: string[]
}

function stripTags(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

function unique(items: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    const text = item.replace(/\s+/g, " ").trim()
    const key = text.toLowerCase()
    if (text.length < 2 || seen.has(key)) continue
    seen.add(key)
    out.push(text)
  }
  return out
}

function parseRubricBullet(item: string): ParsedRubricItem {
  const dash = item.match(/^(.{2,90}?)\s+[—–-]\s+(met|partially met|not met|exceeds expectations|exceeds)\b\.?\s*([\s\S]*)$/i)
  const colon = item.match(/^([^:]{2,90}):\s*(met|partially met|not met|exceeds expectations|exceeds|not_met|partial)\b\.?\s*([\s\S]*)$/i)
  const match = dash || colon
  if (!match) return { title: item, level: null, note: "" }
  return {
    title: match[1].trim(),
    level: match[2].replace(/_/g, " ").toLowerCase(),
    note: match[3].replace(/\s+/g, " ").trim(),
  }
}

/** Turn stored grader text into one score, one rubric, and the three student notes. */
export function parseProjectEvaluation(raw: string): ParsedProjectEvaluation {
  const empty: ParsedProjectEvaluation = { score: null, reason: null, rubric: [], didWell: [], missing: [], improve: [] }
  const text = stripTags(raw || "")
  if (!text) return empty

  const chunks = text.split(/(?=^Score:\s*[\d.])/im).map((chunk) => chunk.trim()).filter(Boolean)
  const kept: string[] = []
  for (const chunk of chunks.length ? chunks : [text]) {
    const key = chunk.replace(/\s+/g, " ").slice(0, 240).toLowerCase()
    const existing = kept.findIndex((item) => item.replace(/\s+/g, " ").slice(0, 240).toLowerCase() === key)
    if (existing >= 0) {
      if (chunk.length > kept[existing].length) kept[existing] = chunk
      continue
    }
    kept.push(chunk)
  }
  const source = kept.sort((a, b) => b.length - a.length)[0] || text
  const scoreMatch = source.match(/Score:\s*([\d.]+\s*\/\s*[\d.]+)/i)

  let section: "preamble" | "reason" | "rubric" | "well" | "missing" | "improve" = "preamble"
  const buckets: Record<typeof section, string[]> = {
    preamble: [],
    reason: [],
    rubric: [],
    well: [],
    missing: [],
    improve: [],
  }
  for (const line of source.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || /^score:/i.test(trimmed)) continue
    const why = trimmed.match(/^why this score:\s*(.*)$/i)
    if (why) {
      if (why[1]) buckets.reason.push(why[1])
      section = "reason"
      continue
    }
    const heading = trimmed.match(/^(rubric|what you did well|what's missing|whats missing|how to improve)\s*$/i)
    if (heading) {
      const name = heading[1].toLowerCase()
      section = name.startsWith("rubric") ? "rubric" : name.startsWith("what you") ? "well" : name.startsWith("how") ? "improve" : "missing"
      continue
    }
    buckets[section].push(trimmed)
  }

  const rubric = unique(
    buckets.rubric.filter((line) => line.startsWith("-")).map((line) => line.replace(/^-\s+/, "")),
  ).map(parseRubricBullet)
  const spill = buckets.rubric.filter((line) => !line.startsWith("-"))
  const bullets = (lines: string[]) => unique(lines.map((line) => line.replace(/^-\s+/, "")).filter((line) => !line.endsWith(":")))

  return {
    score: scoreMatch ? scoreMatch[1].replace(/\s+/g, " ") : null,
    reason: unique([...buckets.reason, ...buckets.preamble.filter((line) => !line.startsWith("-"))]).join(" ") || null,
    rubric,
    didWell: bullets(buckets.well),
    missing: bullets(buckets.missing),
    improve: unique([...bullets(buckets.improve), ...spill]),
  }
}
