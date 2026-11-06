/** Typed Cora UI payloads. Do not render fake Markdown buttons. */

export type CoraUiAction = {
  label: string
  route?: string
  actionId?: string
}

export type CoraVerifierFlag = {
  kind: "ambiguity" | "duplicate" | "leaked_answer" | "bloom"
  message: string
}

export type CoraCheckpointOptionPayload = {
  id: string
  label: string
  correct: boolean
  feedback?: string
}

export type CoraWalkthroughStepPayload = {
  id: string
  title: string
  explanation: string
  equation?: string
  code?: string
  hint?: string
  /** Set when a hint would reveal a live assessment answer. The hint text is omitted. */
  hintBlocked?: boolean
  expectedAnswer?: string
  checkpoint?: {
    id: string
    prompt: string
    options: CoraCheckpointOptionPayload[]
  }
}

export type CoraQuestionPreviewItem = {
  id: string
  stem: string
  choices: string[]
  answer: string
  bloom?: string
  distractorNote?: string
  topic?: string
  flags?: CoraVerifierFlag[]
}

export type CoraQuestionPreviewData = {
  items: CoraQuestionPreviewItem[]
}

export type CoraAssessmentPreviewData = {
  title: string
  topics: string[]
  itemCount: number
  questionIds?: number[]
}

export type CoraAnalyticsPoint = {
  label: string
  value: number
}

export type CoraAnalyticsData = {
  finding: string
  series: CoraAnalyticsPoint[]
  misconceptions?: string[]
  reasoning?: string
}

export type CoraProgressChip = {
  label: string
  value: string
}

export type CoraProgressAction = {
  label: string
  route: "practice" | "flashcards" | "calendar" | string
}

export type CoraProgressData = {
  chips: CoraProgressChip[]
  actions?: CoraProgressAction[]
}

export type CoraCodePatchData = {
  diff: string
  issues?: string[]
}

export type CoraLecturePackData = {
  title: string
  deck: Array<{ front: string; back: string }>
  glossary: Array<{ term: string; definition: string }>
  practice: CoraQuestionPreviewItem[]
}

export type CoraUiPayload =
  | { type: "text_response"; message: string }
  | {
      type: "confirmation"
      message: string
      actionId: string
      preview: Record<string, unknown>
      actions: CoraUiAction[]
    }
  | {
      type: "created_resource"
      message: string
      resource: { type: string; id: string | number; title?: string }
      actions?: CoraUiAction[]
    }
  | { type: "walkthrough"; title: string; objective?: string; steps: CoraWalkthroughStepPayload[] }
  | { type: "assessment_preview"; message: string; count: number; data: CoraAssessmentPreviewData }
  | { type: "question_preview"; message: string; count: number; data: CoraQuestionPreviewData }
  | { type: "analytics"; message: string; data: CoraAnalyticsData }
  | { type: "progress_summary"; message: string; data: CoraProgressData }
  | { type: "code_patch"; message: string; data: CoraCodePatchData }
  | { type: "lecture_pack"; message: string; data: CoraLecturePackData }
  | { type: "error"; message: string; code?: string }
  | { type: "permission_denied"; message: string }
  | { type: "insufficient_credits"; message: string; needed?: number; available?: number }

const BLOOM = ["remember", "understand", "apply", "analyze", "evaluate", "create"]

export function coraUiFromProposals(
  message: string,
  proposals?: Array<{ actionId: string; preview?: Record<string, unknown> }> | null,
): CoraUiPayload | undefined {
  if (!proposals?.length) return undefined
  const first = proposals[0]!
  return {
    type: "confirmation",
    message,
    actionId: first.actionId,
    preview: first.preview ?? {},
    actions: proposals.map((p) => ({ label: "Confirm", actionId: p.actionId })),
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeAnswer(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

export function flagQuestionItems(items: CoraQuestionPreviewItem[]): CoraQuestionPreviewItem[] {
  const stems = new Map<string, number>()
  for (const item of items) {
    const key = normalizeAnswer(item.stem)
    if (!key) continue
    stems.set(key, (stems.get(key) ?? 0) + 1)
  }

  return items.map((item) => {
    const flags: CoraVerifierFlag[] = [...(item.flags ?? [])]
    const stem = item.stem.trim()
    const answer = item.answer.trim()
    if (stem.length < 12 || /\b(something|etc\.?|always|never)\b/i.test(stem)) {
      flags.push({ kind: "ambiguity", message: "Stem is vague or too short to stand alone." })
    }
    if (answer.length > 2 && normalizeAnswer(stem).includes(normalizeAnswer(answer))) {
      flags.push({ kind: "leaked_answer", message: "The answer text appears in the stem." })
    }
    const bloom = text(item.bloom).toLowerCase()
    if (!bloom || !BLOOM.includes(bloom)) {
      flags.push({ kind: "bloom", message: "Bloom level is missing or not one of the six levels." })
    }
    if ((stems.get(normalizeAnswer(stem)) ?? 0) > 1) {
      flags.push({ kind: "duplicate", message: "Another item in this draft uses the same stem." })
    }
    const seen = new Set<string>()
    const unique = flags.filter((flag) => {
      const key = `${flag.kind}:${flag.message}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    return unique.length ? { ...item, flags: unique } : { ...item, flags: undefined }
  })
}

function parseCheckpoint(raw: unknown) {
  const row = asRecord(raw)
  if (!row) return undefined
  const options = Array.isArray(row.options)
    ? row.options.flatMap((option, index) => {
        const rec = asRecord(option)
        if (!rec) return []
        const label = text(rec.label)
        if (!label) return []
        return [
          {
            id: text(rec.id) || `opt-${index + 1}`,
            label,
            correct: rec.correct === true,
            ...(text(rec.feedback) ? { feedback: text(rec.feedback) } : {}),
          },
        ]
      })
    : []
  if (!options.length) return undefined
  return {
    id: text(row.id) || "checkpoint",
    prompt: text(row.prompt) || "Check this step",
    options,
  }
}

function parseWalkthroughSteps(raw: unknown, blockLeaks: boolean): CoraWalkthroughStepPayload[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((step, index) => {
    const row = asRecord(step)
    if (!row) return []
    const title = text(row.title) || `Step ${index + 1}`
    const explanation = text(row.explanation)
    if (!explanation && !text(row.equation) && !text(row.code)) return []
    const expected = text(row.expectedAnswer)
    const hint = text(row.hint)
    const leaks =
      blockLeaks &&
      expected.length >= 2 &&
      hint.length > 0 &&
      normalizeAnswer(hint).includes(normalizeAnswer(expected))
    const checkpoint = parseCheckpoint(row.checkpoint)
    return [
      {
        id: text(row.id) || `step-${index + 1}`,
        title,
        explanation: explanation || title,
        ...(text(row.equation) ? { equation: text(row.equation) } : {}),
        ...(text(row.code) ? { code: text(row.code) } : {}),
        ...(leaks ? { hintBlocked: true } : hint ? { hint } : {}),
        ...(expected ? { expectedAnswer: expected } : {}),
        ...(checkpoint ? { checkpoint } : {}),
      },
    ]
  })
}

function parseQuestionItem(raw: unknown, index: number): CoraQuestionPreviewItem | null {
  const row = asRecord(raw)
  if (!row) return null
  const stem = text(row.stem ?? row.question_text ?? row.prompt)
  if (!stem) return null
  const choices = Array.isArray(row.choices)
    ? row.choices.map((choice) => text(choice)).filter(Boolean)
    : Array.isArray(row.options)
      ? row.options.map((choice) => text(choice)).filter(Boolean)
      : []
  const answerRaw = row.answer ?? row.correct_answer
  const answer = Array.isArray(answerRaw) ? answerRaw.map((part) => text(part)).filter(Boolean).join(", ") : text(answerRaw)
  return {
    id: text(row.id ?? row.draftId) || `q-${index + 1}`,
    stem,
    choices,
    answer,
    ...(text(row.bloom) ? { bloom: text(row.bloom) } : {}),
    ...(text(row.distractorNote ?? row.hint) ? { distractorNote: text(row.distractorNote ?? row.hint) } : {}),
    ...(text(row.topic) ? { topic: text(row.topic) } : {}),
  }
}

function parseAnalytics(raw: unknown, fallbackMessage: string): CoraAnalyticsData | null {
  const row = asRecord(raw)
  if (!row) return null
  const series = Array.isArray(row.series)
    ? row.series.flatMap((point) => {
        const rec = asRecord(point)
        if (!rec) return []
        const label = text(rec.label)
        const value = Number(rec.value ?? rec.count)
        if (!label || !Number.isFinite(value)) return []
        return [{ label, value }]
      })
    : []
  if (!series.length) return null
  const misconceptions = Array.isArray(row.misconceptions)
    ? row.misconceptions.map((item) => text(item)).filter(Boolean)
    : []
  return {
    finding: text(row.finding) || fallbackMessage || "Finding",
    series,
    ...(misconceptions.length ? { misconceptions } : {}),
    ...(text(row.reasoning) ? { reasoning: text(row.reasoning) } : {}),
  }
}

function parseProgress(raw: unknown): CoraProgressData | null {
  const row = asRecord(raw)
  if (!row) return null
  const chips = Array.isArray(row.chips)
    ? row.chips.flatMap((chip) => {
        const rec = asRecord(chip)
        if (!rec) return []
        const label = text(rec.label)
        const value = text(rec.value)
        if (!label || !value) return []
        return [{ label, value }]
      })
    : []
  if (!chips.length) return null
  const actions = Array.isArray(row.actions)
    ? row.actions.flatMap((action) => {
        const rec = asRecord(action)
        if (!rec) return []
        const label = text(rec.label)
        const route = text(rec.route)
        if (!label || !route) return []
        return [{ label, route }]
      })
    : []
  return { chips, ...(actions.length ? { actions } : {}) }
}

function parseLecturePack(raw: unknown, message: string): CoraLecturePackData | null {
  const row = asRecord(raw)
  if (!row) return null
  const deck = Array.isArray(row.deck)
    ? row.deck.flatMap((card) => {
        const rec = asRecord(card)
        if (!rec) return []
        const front = text(rec.front)
        const back = text(rec.back)
        if (!front || !back) return []
        return [{ front, back }]
      })
    : []
  const glossary = Array.isArray(row.glossary)
    ? row.glossary.flatMap((entry) => {
        const rec = asRecord(entry)
        if (!rec) return []
        const term = text(rec.term)
        const definition = text(rec.definition)
        if (!term || !definition) return []
        return [{ term, definition }]
      })
    : []
  const practice = Array.isArray(row.practice)
    ? flagQuestionItems(
        row.practice.flatMap((item, index) => {
          const parsed = parseQuestionItem(item, index)
          return parsed ? [parsed] : []
        }),
      )
    : []
  if (!deck.length && !glossary.length && !practice.length) return null
  return { title: text(row.title) || message || "Lecture pack", deck, glossary, practice }
}

function payloadFromObject(raw: Record<string, unknown>, blockLeaks: boolean): CoraUiPayload | null {
  const type = text(raw.type)
  const message = text(raw.message)
  if (type === "walkthrough") {
    const steps = parseWalkthroughSteps(raw.steps, blockLeaks)
    if (!steps.length) return null
    return {
      type: "walkthrough",
      title: text(raw.title) || "Walkthrough",
      ...(text(raw.objective) ? { objective: text(raw.objective) } : {}),
      steps,
    }
  }
  if (type === "question_preview") {
    const source = Array.isArray(raw.data)
      ? raw.data
      : Array.isArray(asRecord(raw.data)?.items)
        ? (asRecord(raw.data)?.items as unknown[])
        : []
    const items = flagQuestionItems(
      source.flatMap((item, index) => {
        const parsed = parseQuestionItem(item, index)
        return parsed ? [parsed] : []
      }),
    )
    if (!items.length) return null
    return {
      type: "question_preview",
      message: message || `${items.length} question${items.length === 1 ? "" : "s"} ready to review.`,
      count: items.length,
      data: { items },
    }
  }
  if (type === "assessment_preview") {
    const data = asRecord(raw.data)
    const topics = Array.isArray(data?.topics) ? data.topics.map((topic) => text(topic)).filter(Boolean) : []
    const itemCount = Number(data?.itemCount ?? raw.count)
    if (!Number.isFinite(itemCount) || itemCount < 1) return null
    const questionIds = Array.isArray(data?.questionIds)
      ? data.questionIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
      : []
    return {
      type: "assessment_preview",
      message: message || "Assessment outline",
      count: itemCount,
      data: {
        title: text(data?.title) || "Assessment",
        topics,
        itemCount,
        ...(questionIds.length ? { questionIds } : {}),
      },
    }
  }
  if (type === "analytics") {
    const data = parseAnalytics(raw.data, message)
    if (!data) return null
    return { type: "analytics", message: message || data.finding, data }
  }
  if (type === "progress_summary") {
    const data = parseProgress(raw.data)
    if (!data) return null
    return { type: "progress_summary", message: message || "Progress", data }
  }
  if (type === "code_patch") {
    const data = asRecord(raw.data)
    const diff = text(data?.diff ?? raw.diff)
    if (!diff) return null
    const issues = Array.isArray(data?.issues) ? data.issues.map((issue) => text(issue)).filter(Boolean) : []
    return { type: "code_patch", message: message || "Proposed code change", data: { diff, ...(issues.length ? { issues } : {}) } }
  }
  if (type === "lecture_pack") {
    const data = parseLecturePack(raw.data ?? raw, message)
    if (!data) return null
    return { type: "lecture_pack", message: message || data.title, data }
  }
  return null
}

function sliceBalancedObject(source: string, start: number): string | null {
  if (source[start] !== "{") return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < source.length; i += 1) {
    const char = source[i]
    if (inString) {
      if (escaped) escaped = false
      else if (char === "\\") escaped = true
      else if (char === "\"") inString = false
      continue
    }
    if (char === "\"") inString = true
    else if (char === "{") depth += 1
    else if (char === "}") {
      depth -= 1
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  return null
}

function extractJsonObject(message: string): { prose: string; raw: Record<string, unknown> } | null {
  const fenceAt = message.search(/```(?:json)?/i)
  const searchFrom = fenceAt >= 0 ? message.indexOf("{", fenceAt) : message.indexOf("{")
  if (searchFrom < 0) return null
  const jsonText = sliceBalancedObject(message, searchFrom)
  if (!jsonText) return null
  try {
    const parsed = JSON.parse(jsonText) as unknown
    const raw = asRecord(parsed)
    if (!raw || !text(raw.type)) return null
    const fenceEnd = fenceAt >= 0 ? message.indexOf("```", searchFrom + jsonText.length) : -1
    const removeTo = fenceEnd >= 0 ? fenceEnd + 3 : searchFrom + jsonText.length
    const prose = `${message.slice(0, fenceAt >= 0 ? fenceAt : searchFrom)}${message.slice(removeTo)}`.trim()
    return { prose, raw }
  } catch {
    return null
  }
}

function extractDiffFence(message: string): { prose: string; diff: string } | null {
  const fence = message.match(/```diff\s*([\s\S]*?)```/i)
  if (!fence?.[1]?.trim()) return null
  return { prose: message.replace(fence[0], "").trim(), diff: fence[1].trim() }
}

export function questionPreviewFromDrafts(
  draftsJson: string,
  verificationIssues?: string[],
): CoraUiPayload | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(draftsJson)
  } catch {
    return null
  }
  if (!Array.isArray(parsed)) return null
  let items = flagQuestionItems(
    parsed.flatMap((item, index) => {
      const row = parseQuestionItem(item, index)
      return row ? [row] : []
    }),
  )
  const extra = (verificationIssues ?? []).map((issue) => issue.trim()).filter(Boolean)
  if (extra.length && items.length) {
    items = items.map((item, index) =>
      index === 0
        ? {
            ...item,
            flags: [
              ...(item.flags ?? []),
              ...extra.map((message) => ({ kind: "ambiguity" as const, message })),
            ],
          }
        : item,
    )
    items = flagQuestionItems(items)
  }
  if (!items.length) return null
  return {
    type: "question_preview",
    message: `${items.length} draft${items.length === 1 ? "" : "s"} ready. Accept one item at a time.`,
    count: items.length,
    data: { items },
  }
}

export function applyUnifiedDiff(source: string, diff: string): string | null {
  const hunks = diff.split(/^@@/m).slice(1)
  if (!hunks.length) return null
  const lines = source.split("\n")
  let cursor = 0
  const next: string[] = []
  for (const hunk of hunks) {
    const header = hunk.match(/^\s*-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s*@@/)
    if (!header) return null
    const start = Math.max(0, Number(header[1]) - 1)
    next.push(...lines.slice(cursor, start))
    cursor = start
    const body = hunk.slice(header[0].length).split("\n").slice(1)
    for (const line of body) {
      if (!line || line.startsWith("\\")) continue
      const marker = line[0]
      const textLine = line.slice(1)
      if (marker === " ") {
        next.push(lines[cursor] ?? textLine)
        cursor += 1
      } else if (marker === "-") {
        cursor += 1
      } else if (marker === "+") {
        next.push(textLine)
      }
    }
  }
  next.push(...lines.slice(cursor))
  const applied = next.join("\n")
  return applied === source ? null : applied
}

export function verifyCodePatch(diff: string): string[] {
  const issues: string[] = []
  const removedChecks = diff.split("\n").filter((line) => /^\-(?!\-\-)\s*(assert|expect|CHECK)\b/.test(line))
  if (removedChecks.length) issues.push("This diff removes a check or assertion.")
  if (/\+\s*.*\b(the answer is|correct answer)\b/i.test(diff)) {
    issues.push("This diff writes an answer into the buffer.")
  }
  return issues
}

/**
 * Course-object contract for every Cora chat route.
 * Signed proposals stay on `proposals`. This returns a renderable object when the
 * model or a tool produced one, and shortens the bubble to the sentence around it.
 */
export function resolveCoraChatUi(input: {
  message: string
  questionDraftsJson?: string | null
  verificationIssues?: string[]
  blockAnswerLeaks?: boolean
}): { reply: string; ui?: CoraUiPayload } {
  const fromDrafts = input.questionDraftsJson
    ? questionPreviewFromDrafts(input.questionDraftsJson, input.verificationIssues)
    : null
  if (fromDrafts && fromDrafts.type === "question_preview") {
    const sentence = input.message.split("\n").map((line) => line.trim()).find((line) => line && !line.startsWith("```"))
    return { reply: sentence || fromDrafts.message, ui: fromDrafts }
  }

  const extracted = extractJsonObject(input.message)
  if (extracted) {
    const ui = payloadFromObject(extracted.raw, input.blockAnswerLeaks === true)
    if (ui) {
      if (ui.type === "code_patch") {
        const issues = verifyCodePatch(ui.data.diff)
        if (issues.length) ui.data.issues = [...new Set([...(ui.data.issues ?? []), ...issues])]
      }
      const reply =
        extracted.prose ||
        ("message" in ui && ui.message ? ui.message : "") ||
        (ui.type === "walkthrough" ? ui.title : "Here is the course object.")
      return { reply, ui }
    }
  }

  const diff = extractDiffFence(input.message)
  if (diff) {
    const issues = verifyCodePatch(diff.diff)
    return {
      reply: diff.prose || "Proposed a change against the open buffer.",
      ui: { type: "code_patch", message: "Proposed code change", data: { diff: diff.diff, ...(issues.length ? { issues } : {}) } },
    }
  }

  return { reply: input.message }
}

export function courseObjectPromptAppendix(kind: "walkthrough" | "checkpoint" | "code_patch" | "analytics" | "lecture_pack"): string {
  const shared = "Write one short sentence, then a single ```json fence. Do not invent buttons or say the object was saved."
  switch (kind) {
    case "walkthrough":
      return `\n\nThe attachment is a course object. ${shared} Use {"type":"walkthrough","title":"","objective":"","steps":[{"id":"1","title":"","explanation":"","equation":"","code":"","hint":"","checkpoint":{"id":"c1","prompt":"","options":[{"id":"a","label":"","correct":false}]}}]}.`
    case "checkpoint":
      return `\n\nQuiz as a course object, one checkpoint only. ${shared} Use {"type":"walkthrough","title":"","steps":[{"id":"1","title":"","explanation":"","hint":"","expectedAnswer":"","checkpoint":{"id":"c1","prompt":"","options":[{"id":"a","label":"","correct":true}]}}]}. The hint must not contain the answer.`
    case "code_patch":
      return `\n\nPropose the edit as a course object. ${shared} Use {"type":"code_patch","message":"","data":{"diff":"unified diff against the open buffer"}} or a \`\`\`diff fence. Do not claim the editor changed.`
    case "analytics":
      return `\n\nEnd the analysis as a chart object. ${shared} Use {"type":"analytics","message":"one finding","data":{"finding":"","series":[{"label":"","value":1}],"misconceptions":[""],"reasoning":""}}. Put the long reasoning only in data.reasoning.`
    case "lecture_pack":
      return `\n\nSplit the lecture into objects. ${shared} Use {"type":"lecture_pack","message":"","data":{"title":"","deck":[{"front":"","back":""}],"glossary":[{"term":"","definition":""}],"practice":[{"stem":"","choices":[],"answer":"","bloom":"apply"}]}}.`
  }
}

export function followUpsForCoraUi(
  ui: CoraUiPayload | undefined,
  portal: "faculty" | "student",
  surface: "chat" | "codebench" = "chat",
): string[] {
  if (
    surface === "codebench" &&
    (!ui || ui.type === "text_response" || ui.type === "confirmation" || ui.type === "error")
  ) {
    return ["Propose a diff against my open code", "Explain the next issue without rewriting the file"]
  }
  switch (ui?.type) {
    case "walkthrough":
      return ["Check the step I just tried", "Give a hint that does not reveal the answer", "Show only the next step"]
    case "question_preview":
      return portal === "faculty"
        ? ["Revise this stem for clarity", "Write one harder follow-up item", "Check this item for a leaked answer"]
        : ["Quiz me with one checkpoint on this", "Explain the idea without giving the answer"]
    case "analytics":
      return ["Explain the main misconception", "Draft one reteach question for the weakest result"]
    case "progress_summary":
      return ["Quiz me on my weakest topic", "Make a short practice set from these topics"]
    case "code_patch":
      return ["Explain this diff line by line", "Propose a smaller change if the verifier flagged it"]
    case "lecture_pack":
      return ["Quiz me on this lecture", "Turn the glossary into flashcards I can save"]
    case "assessment_preview":
      return ["Flag ambiguous items before I publish", "Shorten this to a five-question draft"]
    default:
      return portal === "faculty"
        ? ["Turn that into a draft I can confirm", "Continue with the next step"]
        : ["Give me one checkpoint on this", "Continue with the next step"]
  }
}
