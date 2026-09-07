import { matchPlatformEntry, formatCapabilitiesHelp } from "@/lib/cora/platform-catalog"
import type { CoraPlatformTab } from "@/lib/cora/platform-nav"

export type CoraWorkspaceActionMessage = {
  id: string
  role: "student" | "ai"
  content: string
  timestamp: string | Date
}

export type CoraWorkspaceActionIntent =
  | { type: "export_note"; title?: string }
  | { type: "create_flashcards"; topic: string; cardCount?: number }
  | { type: "create_note"; topic: string; title?: string }
  | { type: "search_platform"; query: string }
  | { type: "navigate"; href: string; label: string }
  | { type: "open_cora_tab"; tab: CoraPlatformTab; toolId?: string; label: string }
  | { type: "create_practice_quiz"; topic: string; count?: number; difficulty?: string }
  | { type: "list_capabilities" }

const EXPORT_PATTERNS = [
  /^\/save_note(?:\s+(.+))?$/i,
  /^\/export(?:\s+chat)?(?:\s+to\s+notes?)?$/i,
  /^(?:save|export)\s+(?:this\s+)?(?:chat|conversation)(?:\s+to\s+(?:my\s+)?notes?)?\.?$/i,
  /^(?:add|save)\s+(?:this\s+)?(?:to\s+)?(?:my\s+)?notes?\.?$/i,
]

const FLASHCARD_PATTERNS = [
  /^\/flashcards?\s+(.+)$/i,
  /^(?:create|make|generate)\s+(?:me\s+)?flashcards?\s+(?:on|about|for)\s+(.+)$/i,
  /^(?:create|make|generate)\s+(?:a\s+)?flashcard\s+deck\s+(?:on|about|for)\s+(.+)$/i,
]

const NOTE_PATTERNS = [
  /^\/note\s+(.+)$/i,
  /^(?:create|make|write)\s+(?:me\s+)?(?:study\s+)?notes?\s+(?:on|about|for)\s+(.+)$/i,
  /^(?:summarize|summary\s+of)\s+(.+?)(?:\s+as\s+notes?)?\.?$/i,
]

const SEARCH_PATTERNS = [
  /^\/search\s+(.+)$/i,
  /^(?:search|find|look\s+for)\s+(?:for\s+)?(.+?)(?:\s+on\s+(?:the\s+)?(?:platform|coursecollab|app))?\.?$/i,
  /^where\s+(?:is|are)\s+(?:my\s+)?(.+?)\??$/i,
]

const NAVIGATE_PATTERNS = [
  /^\/go\s+(.+)$/i,
  /^(?:go\s+to|open|take\s+me\s+to|show\s+me|navigate\s+to)\s+(?:the\s+)?(.+?)\.?$/i,
]

const PRACTICE_QUIZ_PATTERNS = [
  /^\/quiz(?:\s+(.+))?$/i,
  /^(?:create|make|generate|start)\s+(?:a\s+)?(?:practice\s+)?quiz(?:\s+(?:on|about|for)\s+(.+))?$/i,
  /^(?:practice|drill)\s+(?:on|questions\s+(?:on|for|about))\s+(.+)$/i,
  /^(?:start|begin)\s+(?:a\s+)?(?:practice\s+)?(?:session|quiz)\s+(?:on|for|about)\s+(.+)$/i,
]

const CORA_TAB_PATTERNS = [
  /^\/cora(?:\s+(.+))?$/i,
  /^(?:open|switch\s+to|go\s+to)\s+cora\s+(.+?)(?:\s+tab)?\.?$/i,
  /^(?:open|switch\s+to)\s+(workspace|study\s*plan|tools|solve|learn|code|insights|preferences|home)\s*(?:tab)?\.?$/i,
]

const HELP_PATTERNS = [/^\/help$/i, /^\/capabilities$/i, /^what\s+can\s+you\s+do\??$/i]

const CORA_TAB_ALIASES: Record<string, CoraPlatformTab> = {
  home: "home",
  workspace: "workspace",
  solve: "solve",
  learn: "learn",
  code: "code",
  insights: "insights",
  "study plan": "study-plan",
  "study-plan": "study-plan",
  studyplan: "study-plan",
  tools: "tools",
  preferences: "preferences",
  settings: "preferences",
}

function parseQuizModifiers(text: string): { count?: number; difficulty?: string } {
  const countMatch = text.match(/(\d+)\s+-?\s*question/i)
  const diffMatch = text.match(/\b(easy|medium|hard|mixed)\b/i)
  return {
    count: countMatch ? Number(countMatch[1]) : undefined,
    difficulty: diffMatch?.[1]?.toLowerCase(),
  }
}

function resolveCoraTab(raw: string): { tab: CoraPlatformTab; label: string } | null {
  const normalized = raw.trim().toLowerCase().replace(/\s+tab$/, "")
  const tab = CORA_TAB_ALIASES[normalized] ?? CORA_TAB_ALIASES[normalized.replace(/\s+/g, " ")]
  if (tab) return { tab, label: `Cora ${normalized}` }
  return null
}

function resolveNavigate(raw: string): { href: string; label: string } | null {
  const entry = matchPlatformEntry(raw, 50)
  if (entry?.href) return { href: entry.href, label: entry.label }
  return null
}

function resolveCoraTabIntent(raw: string): CoraWorkspaceActionIntent | null {
  const fromAlias = resolveCoraTab(raw)
  if (fromAlias) {
    const entry = matchPlatformEntry(raw, 40)
    return {
      type: "open_cora_tab",
      tab: fromAlias.tab,
      toolId: entry?.toolId,
      label: fromAlias.label,
    }
  }

  const entry = matchPlatformEntry(raw, 50)
  if (entry?.tab) {
    return {
      type: "open_cora_tab",
      tab: entry.tab,
      toolId: entry.toolId,
      label: entry.label,
    }
  }
  return null
}

export function detectWorkspaceAction(text: string): CoraWorkspaceActionIntent | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  for (const re of HELP_PATTERNS) {
    if (re.test(trimmed)) return { type: "list_capabilities" }
  }

  for (const re of EXPORT_PATTERNS) {
    const m = trimmed.match(re)
    if (m) return { type: "export_note", title: m[1]?.trim() || undefined }
  }

  for (const re of FLASHCARD_PATTERNS) {
    const m = trimmed.match(re)
    if (m?.[1]) {
      return { type: "create_flashcards", topic: m[1].trim().replace(/\.$/, "") }
    }
  }

  for (const re of NOTE_PATTERNS) {
    const m = trimmed.match(re)
    if (m?.[1]) {
      const topic = m[1].trim().replace(/\.$/, "")
      return { type: "create_note", topic, title: `Cora: ${topic.slice(0, 60)}` }
    }
  }

  for (const re of SEARCH_PATTERNS) {
    const m = trimmed.match(re)
    if (m?.[1]) {
      const query = m[1].trim().replace(/\.$/, "")
      if (query.length >= 2) return { type: "search_platform", query }
    }
  }

  for (const re of PRACTICE_QUIZ_PATTERNS) {
    const m = trimmed.match(re)
    if (m) {
      const topic = (m[1] ?? "").trim().replace(/\.$/, "")
      const mods = parseQuizModifiers(trimmed)
      if (topic) return { type: "create_practice_quiz", topic, ...mods }
    }
  }

  for (const re of CORA_TAB_PATTERNS) {
    const m = trimmed.match(re)
    if (m) {
      const raw = (m[1] ?? m[0].replace(/^(?:open|switch\s+to)\s+/i, "")).trim()
      const intent = resolveCoraTabIntent(raw)
      if (intent) return intent
    }
  }

  for (const re of NAVIGATE_PATTERNS) {
    const m = trimmed.match(re)
    if (m?.[1]) {
      const target = m[1].trim().replace(/\.$/, "")
      const coraIntent = resolveCoraTabIntent(target)
      if (coraIntent) return coraIntent
      const nav = resolveNavigate(target)
      if (nav) return { type: "navigate", ...nav }
      return { type: "search_platform", query: target }
    }
  }

  return null
}

export function formatCapabilitiesHelpText(): string {
  return formatCapabilitiesHelp()
}

export function formatChatAsNoteMarkdown(
  messages: CoraWorkspaceActionMessage[],
  title = "Cora workspace chat",
): { title: string; bodyText: string } {
  const lines: string[] = [
    `# ${title}`,
    "",
    `_Exported from Cora workspace on ${new Date().toLocaleString()}_`,
    "",
  ]

  for (const msg of messages) {
    if (msg.id === "welcome" || msg.id === "typing") continue
    const when =
      msg.timestamp instanceof Date
        ? msg.timestamp.toLocaleString()
        : new Date(msg.timestamp).toLocaleString()
    const speaker = msg.role === "student" ? "You" : "Cora"
    lines.push(`## ${speaker} · ${when}`, "", msg.content.trim(), "")
  }

  return { title, bodyText: lines.join("\n").trim() }
}
