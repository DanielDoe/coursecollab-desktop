export type ClassroomPromptItem = {
  text: string
  label?: string
  children?: ClassroomPromptItem[]
}

export type ClassroomPromptBlock =
  | { type: "markdown"; title: string | null; body: string }
  | { type: "prose"; paragraphs: string[] }
  | { type: "list"; title: string; items: ClassroomPromptItem[] }
  | { type: "inputs"; title: string; items: { name: string; detail?: string }[] }
  | { type: "chips"; title: string; items: string[] }
  | { type: "example"; input: string; output: string; variants?: { caption: string; output: string }[] }
  | { type: "note"; body: string }
  | { type: "callout"; title: string; body: string }

function splitList(value: string): string[] {
  return value
    .replace(/[.:]$/, "")
    .split(/\s*,\s*|\s+\band\b\s+/i)
    .map((item) => item.replace(/^(a|an|the|their|your)\s+/i, "").trim())
    .filter((item) => item.length > 1 && item.length < 80)
}

function extractInputs(text: string): string[] {
  const take = text.match(/\btake\s+(.+?)\s+as input\b/i)
  if (take) return splitList(take[1] ?? "")
  const asks = text.match(
    /\basks?(?:\s+the\s+(?:user|student|operator))?\s+(?:to\s+)?enter\s+(.+?)(?:\.|,\s+then|\s+and\s+(?:determines|calculates|display))/i,
  )
  if (asks) return splitList(asks[1] ?? "")
  return []
}

function extractFormula(text: string): string | null {
  const labeled = text.match(/\bformula\s*:\s*([^\n.]+)/i)
  if (labeled?.[1]) return labeled[1].trim()
  const equation = text.match(/\b([A-Za-z][A-Za-z ]{0,16}=\s*[^.\n]{3,80})/)
  const body = equation?.[1]?.trim()
  if (!body || !/[+\-*/()]/.test(body)) return null
  return body
}

function stripFormula(text: string): string {
  return text
    .replace(/\s*(?:,\s*)?(?:using|with)\s+the\s+formula\s*:\s*[^.]+\.?/i, ".")
    .replace(/\s*formula\s*:\s*[^.]+\.?/i, ".")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .replace(/\.{2,}/g, ".")
    .trim()
}

/** Put inline rules, samples, and prompts back on their own lines. */
export function normalizeClassroomPrompt(text: string): string {
  let next = String(text ?? "")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
  next = next.replace(/([^\n\s])[ \t]+-[ \t]+/g, "$1\n- ")
  next = next.replace(/([^\n\s])[ \t]+[•●][ \t]+/g, "$1\n• ")
  next = next.replace(/(?<=[.:])[ \t]+(\d{1,2})\.[ \t]+(?=[A-Z])/g, "\n$1. ")
  const headers = [
    "sample input:",
    "expected output:",
    "use the following rules:",
    "apply these additional rules:",
    "apply these rules carefully:",
    "apply these rules:",
    "apply the following rules:",
    "ask the user to enter:",
    "ask the student to enter:",
    "ask the operator to enter:",
  ]
  for (const header of headers) {
    const escaped = header.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    next = next.replace(new RegExp(`([^\\n])\\s+(${escaped})`, "gi"), "$1\n$2")
  }
  next = next.replace(/(?<!\d\.)\s+(use a switch statement\b[^\n:]{0,90}:)/gi, "\n$1")
  next = next.replace(/([^\n])\s+(the program must\b)/gi, "$1\n$2")
  next = next.replace(/^(sample input:|expected output:)\s+(.+)$/gim, "$1\n$2")
  return next
}

function bulletOf(line: string): { indent: number; text: string } | null {
  const match = line.match(/^(\s*)(?:[-*•●]|\d+\.)\s+(.*)$/)
  if (!match) return null
  return { indent: match[1]?.length ?? 0, text: (match[2] ?? "").trim() }
}

function asLabelValue(text: string): ClassroomPromptItem {
  const cleaned = text.trim()
  const menu = cleaned.match(/^(\d+|[A-Za-z])\s*(?:→|->)\s*([^:]{1,40}):\s*(.{1,32})$/)
  if (menu?.[1] && menu[2] && menu[3]) {
    return { label: `${menu[1]} · ${menu[2].trim()}`, text: menu[3].trim() }
  }
  const arrow = cleaned.match(/^(.{2,72}?)\s*(?:→|->)\s*(.{1,64})$/)
  if (arrow?.[1] && arrow[2] && !arrow[2].includes("→") && !arrow[1].includes("→")) {
    return { label: arrow[1].trim(), text: arrow[2].trim() }
  }
  if (cleaned.endsWith(":")) return { text: cleaned.slice(0, -1).trim() }
  const index = cleaned.indexOf(":")
  if (index <= 0) return { text: cleaned }
  const label = cleaned.slice(0, index).trim()
  const value = cleaned.slice(index + 1).trim()
  if (!label || !value || label.length > 72 || value.length > 56 || value.includes(". ")) {
    return { text: cleaned }
  }
  return { label, text: value }
}

type Kind = "prose" | "list" | "inputs" | "sample" | "expected" | "note" | "task"

function headerKind(line: string): { kind: Kind; title: string } | null {
  const trimmed = line.trim()
  if (/^sample input:?$/i.test(trimmed)) return { kind: "sample", title: "Sample input" }
  if (/^expected output:?$/i.test(trimmed)) return { kind: "expected", title: "Expected output" }
  if (/^ask the (?:user|student|operator) to enter:?$/i.test(trimmed)) {
    return { kind: "inputs", title: trimmed.replace(/:$/, "") }
  }
  if (/^(?:use the following rules|apply (?:these|the following)(?: additional)? rules(?: carefully)?):?$/i.test(trimmed)) {
    return { kind: "list", title: trimmed.replace(/:$/, "") }
  }
  if (/^use a switch statement\b.+:$/i.test(trimmed)) {
    return { kind: "list", title: trimmed.replace(/:$/, "") }
  }
  if (/^rules:?$/i.test(trimmed)) return { kind: "list", title: "Rules" }
  if (/^inputs:?$/i.test(trimmed)) return { kind: "inputs", title: "Inputs" }
  if (/^requirements:?$/i.test(trimmed)) return { kind: "list", title: "Requirements" }
  if (/^task:?$/i.test(trimmed)) return { kind: "task", title: "Task" }
  if (/^in main\(\):?$/i.test(trimmed)) return { kind: "list", title: "In main()" }
  if (/^(?:⚠️\s*)?must\b/i.test(trimmed)) return { kind: "note", title: trimmed.replace(/^⚠️\s*/, "") }
  if (/^the program must\b/i.test(trimmed)) return { kind: "note", title: trimmed }
  return null
}

function parseInputItem(text: string): { name: string; detail?: string } {
  const index = text.indexOf(":")
  if (index > 0 && index < 48) {
    const name = text.slice(0, index).trim()
    const detail = text.slice(index + 1).trim()
    if (name && detail) return { name, detail }
  }
  return { name: text.replace(/\.$/, "").trim() }
}

function pushItem(items: ClassroomPromptItem[], indent: number, text: string, baseIndent: number) {
  const item = asLabelValue(text)
  if (indent > baseIndent && items.length > 0) {
    const parent = items[items.length - 1]!
    parent.children = parent.children ?? []
    parent.children.push(item)
    return
  }
  items.push(item)
}

function structurePlain(raw: string): ClassroomPromptBlock[] {
  const normalized = normalizeClassroomPrompt(raw)
  const formula = extractFormula(normalized)
  const lines = normalized.split("\n")
  const blocks: ClassroomPromptBlock[] = []
  let kind: Kind = "prose"
  let title = ""
  let prose: string[] = []
  let items: ClassroomPromptItem[] = []
  let ioLines: string[] = []
  let baseIndent = 0
  let sawStructure = false

  function flush() {
    if (kind === "prose") {
      const paragraph = stripFormula(prose.join(" ").replace(/\s+/g, " "))
      if (paragraph) {
        if (!sawStructure) {
          const last = blocks[blocks.length - 1]
          if (last?.type === "prose") last.paragraphs.push(paragraph)
          else blocks.push({ type: "prose", paragraphs: [paragraph] })
        } else {
          blocks.push({ type: "note", body: paragraph })
        }
      }
      prose = []
      return
    }
    if (kind === "list" && items.length > 0) {
      blocks.push({ type: "list", title, items })
      sawStructure = true
    }
    if (kind === "inputs" && items.length > 0) {
      blocks.push({
        type: "inputs",
        title,
        items: items.map((item) => parseInputItem(item.label ? `${item.label}: ${item.text}` : item.text)),
      })
      sawStructure = true
    }
    if ((kind === "sample" || kind === "expected") && ioLines.length > 0) {
      const body = ioLines.join("\n").trim()
      const last = blocks[blocks.length - 1]
      if (kind === "expected" && last?.type === "example" && !last.output) {
        last.output = body
      } else if (kind === "sample") {
        blocks.push({ type: "example", input: body, output: "" })
      } else {
        blocks.push({ type: "example", input: "", output: body })
      }
      sawStructure = true
    }
    if (kind === "note" && title.trim()) {
      blocks.push({ type: "note", body: title.trim() })
      sawStructure = true
    }
    if (kind === "task") {
      if (items.length > 0) {
        blocks.push({ type: "list", title: "Task", items })
        sawStructure = true
      } else {
        const body = prose.join(" ").replace(/\s+/g, " ").trim()
        if (body) {
          blocks.push({ type: "note", body })
          sawStructure = true
        }
      }
      prose = []
    }
    items = []
    ioLines = []
    title = ""
    kind = "prose"
  }

  for (const line of lines) {
    if (!line.trim()) {
      if (kind === "prose" && prose.length > 0) flush()
      else if (kind === "sample" || kind === "expected" || kind === "task") flush()
      continue
    }
    if (/^scenario:?$/i.test(line.trim())) continue
    const header = headerKind(line)
    const bullet = bulletOf(line)
    if (header && !bullet) {
      flush()
      kind = header.kind
      title = header.kind === "note" ? header.title : header.title
      if (header.kind === "note") flush()
      continue
    }
    if (bullet && (kind === "list" || kind === "inputs" || kind === "prose" || kind === "task")) {
      if (kind === "prose" || kind === "task") {
        const wasTask = kind === "task"
        flush()
        let heading = wasTask ? "Task" : "Details"
        const last = blocks[blocks.length - 1]
        if (!wasTask && last?.type === "prose") {
          const paragraph = last.paragraphs[last.paragraphs.length - 1] ?? ""
          if (/:\s*$/.test(paragraph) && paragraph.length < 120) {
            last.paragraphs.pop()
            if (last.paragraphs.length === 0) blocks.pop()
            heading = paragraph.replace(/:\s*$/, "")
          }
        }
        kind = "list"
        title = heading
        baseIndent = bullet.indent
      }
      if (items.length === 0) baseIndent = bullet.indent
      pushItem(items, bullet.indent, bullet.text, baseIndent)
      continue
    }
    if (kind === "sample" || kind === "expected") {
      ioLines.push(line.trim())
      continue
    }
    if (kind === "list" || kind === "inputs") {
      flush()
      prose.push(line.trim())
      continue
    }
    if (kind === "task") {
      prose.push(line.trim())
      continue
    }
    if (kind === "prose") prose.push(line.trim())
  }
  flush()

  const hasInputs = blocks.some((block) => block.type === "inputs")
  if (!hasInputs) {
    const chips = extractInputs(normalized)
    if (chips.length > 0) blocks.push({ type: "chips", title: "Read from the user", items: chips })
  }
  if (formula) blocks.push({ type: "callout", title: "Formula", body: formula })
  return blocks.filter((block) => block.type !== "example" || block.input || block.output)
}

function fencedPieces(body: string): { caption: string; code: string }[] {
  const pieces: { caption: string; code: string }[] = []
  const pattern = /```[^\n]*\n([\s\S]*?)```/g
  let last = 0
  for (const match of body.matchAll(pattern)) {
    const caption = body.slice(last, match.index ?? 0).replace(/\*\*/g, "").trim()
    pieces.push({ caption, code: (match[1] ?? "").trim() })
    last = (match.index ?? 0) + match[0].length
  }
  if (pieces.length === 0 && body.trim()) pieces.push({ caption: "", code: body.trim() })
  return pieces
}

function withoutFences(body: string): { text: string; codes: string[] } {
  const codes: string[] = []
  const text = body.replace(/```[^\n]*\n([\s\S]*?)```/g, (_full, code: string) => {
    codes.push(code.trim())
    return "\n"
  })
  return { text, codes }
}

function structureMarkdown(raw: string): ClassroomPromptBlock[] {
  const matches = [...raw.matchAll(/^(#{1,3})\s+(.+?)\s*$/gm)]
  const blocks: ClassroomPromptBlock[] = []
  const firstAt = matches[0]?.index ?? 0
  const intro = raw.slice(0, firstAt).trim()
  if (intro) blocks.push(...structurePlain(intro))
  matches.forEach((match, index) => {
    const start = (match.index ?? 0) + match[0].length
    const end = matches[index + 1]?.index ?? raw.length
    const title = match[2]?.trim() ?? null
    const body = raw.slice(start, end).trim()
    const label = (title ?? "").toLowerCase()
    if (label.includes("sample input") || label === "input") {
      const piece = fencedPieces(body)[0]
      blocks.push({ type: "example", input: piece?.code ?? "", output: "" })
      return
    }
    if (label.includes("expected output") || label.includes("sample output") || label === "output") {
      const pieces = fencedPieces(body).filter((piece) => piece.code)
      const last = blocks[blocks.length - 1]
      const first = pieces[0]
      const variants = pieces.slice(1).map((piece) => ({
        caption: piece.caption.replace(/:\s*$/, ""),
        output: piece.code,
      }))
      if (last?.type === "example" && !last.output && first) {
        last.output = first.code
        if (variants.length > 0) last.variants = variants
      } else if (first) {
        blocks.push({ type: "example", input: "", output: first.code, variants: variants.length ? variants : undefined })
      }
      return
    }
    const stripped = withoutFences(body)
    const inner = structurePlain(stripped.text)
    for (const block of inner) {
      if (block.type === "list" && block.title === "Details" && title) {
        blocks.push({ ...block, title })
      } else {
        blocks.push(block)
      }
    }
    for (const code of stripped.codes) {
      if (code) blocks.push({ type: "callout", title: "Code", body: code })
    }
  })
  return blocks.filter((block) => block.type !== "example" || block.input || block.output)
}

/** Turn a classroom prompt into labeled sections. Markdown headings stay intact. */
export function structureClassroomPrompt(text: string): ClassroomPromptBlock[] {
  const raw = String(text ?? "").replace(/\\n/g, "\n").trim()
  if (!raw) return []
  if (/^#{1,3}\s+/m.test(raw)) return structureMarkdown(raw)
  return structurePlain(raw)
}
