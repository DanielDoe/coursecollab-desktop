export type CoraArtifactKind = "note" | "code" | "equation" | "flowchart"

export type CoraSessionMessageSummary = {
  id: string
  role: "student" | "ai"
  preview: string
  content: string
  timestamp: Date
  isBookmarked?: boolean
}

export type CoraSessionArtifact = {
  id: string
  kind: CoraArtifactKind
  title: string
  preview: string
  content: string
  messageId: string
  createdAt: Date
}

export type CoraSavedConversationSummary = {
  id: string
  title: string
  messageCount: number
  lastUpdated: Date
  preview?: string
  isCurrent?: boolean
  archivedAt?: Date | null
  capabilityId?: string
}

export type CoraWorkspaceSessionSnapshot = {
  messages: CoraSessionMessageSummary[]
  artifacts: CoraSessionArtifact[]
  savedConversations: CoraSavedConversationSummary[]
  archivedConversations?: CoraSavedConversationSummary[]
}

export type CoraWorkspaceSessionController = {
  scrollToMessage: (messageId: string) => void
  getExportMessages: () => import("@/lib/cora/workspace-actions").CoraWorkspaceActionMessage[]
  loadSavedConversation: (conversationId: string) => void
  saveCurrentConversation: () => void
  startNewConversation: () => void
  archiveConversation?: (conversationId: string) => void
  restoreConversation?: (conversationId: string) => void
  deleteConversation?: (conversationId: string) => void
  renameConversation?: (conversationId: string, title: string) => void
}

export interface CoraSessionMessageSource {
  id: string
  role: "student" | "ai"
  content: string
  timestamp: Date
  isBookmarked?: boolean
  lessonBlock?: {
    definition: string
    whyItMatters: string
    example: string
    visualExplanation: string
    quizQuestion: string
    nextStep: string
  }
}

const SKIP_IDS = new Set(["welcome", "typing"])

function previewText(text: string, max = 72): string {
  const flat = text.replace(/\s+/g, " ").trim()
  if (flat.length <= max) return flat
  return `${flat.slice(0, max - 1)}…`
}

function extractCodeBlocks(content: string): Array<{ lang: string; code: string }> {
  const blocks: Array<{ lang: string; code: string }> = []
  const re = /```(\w*)\n?([\s\S]*?)```/g
  let match: RegExpExecArray | null
  while ((match = re.exec(content)) !== null) {
    const lang = match[1]?.trim() || "text"
    const code = match[2]?.trim()
    if (code) blocks.push({ lang, code })
  }
  return blocks
}

function extractEquations(content: string): string[] {
  const found = new Set<string>()
  const patterns = [
    /\$\$([\s\S]+?)\$\$/g,
    /\\\[([\s\S]+?)\\\]/g,
    /\\\(([\s\S]+?)\\\)/g,
  ]
  for (const re of patterns) {
    let match: RegExpExecArray | null
    while ((match = re.exec(content)) !== null) {
      const eq = match[1]?.trim()
      if (eq && eq.length > 1) found.add(eq)
    }
  }
  return [...found]
}

export function summarizeSessionMessages(messages: CoraSessionMessageSource[]): CoraSessionMessageSummary[] {
  return messages
    .filter((m) => !SKIP_IDS.has(m.id))
    .map((m) => ({
      id: m.id,
      role: m.role,
      preview: previewText(m.content || "(attachment)"),
      content: m.content || "",
      timestamp: m.timestamp,
      isBookmarked: m.isBookmarked,
    }))
}

export function extractSessionArtifacts(messages: CoraSessionMessageSource[]): CoraSessionArtifact[] {
  const artifacts: CoraSessionArtifact[] = []

  for (const msg of messages) {
    if (SKIP_IDS.has(msg.id)) continue

    if (msg.isBookmarked) {
      artifacts.push({
        id: `pin-${msg.id}`,
        kind: "note",
        title: msg.role === "student" ? "Pinned question" : "Pinned reply",
        preview: previewText(msg.content, 56),
        content: msg.content,
        messageId: msg.id,
        createdAt: msg.timestamp,
      })
    }

    if (msg.lessonBlock) {
      const lb = msg.lessonBlock
      const body = [lb.definition, lb.whyItMatters, lb.example, lb.visualExplanation]
        .filter(Boolean)
        .join("\n\n")
      artifacts.push({
        id: `lesson-${msg.id}`,
        kind: "note",
        title: "Micro-lesson",
        preview: previewText(lb.definition || body, 56),
        content: body,
        messageId: msg.id,
        createdAt: msg.timestamp,
      })
    }

    for (const [index, block] of extractCodeBlocks(msg.content).entries()) {
      const kind: CoraArtifactKind =
        block.lang === "mermaid" ? "flowchart" : block.lang === "cpp" || block.lang === "c" ? "code" : "code"
      artifacts.push({
        id: `code-${msg.id}-${index}`,
        kind,
        title: kind === "flowchart" ? "Flowchart" : `${block.lang || "Code"} snippet`,
        preview: previewText(block.code, 48),
        content: block.code,
        messageId: msg.id,
        createdAt: msg.timestamp,
      })
    }

    for (const [index, eq] of extractEquations(msg.content).entries()) {
      artifacts.push({
        id: `eq-${msg.id}-${index}`,
        kind: "equation",
        title: "Equation",
        preview: previewText(eq, 40),
        content: eq,
        messageId: msg.id,
        createdAt: msg.timestamp,
      })
    }
  }

  return artifacts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

export function buildWorkspaceSessionSnapshot(
  messages: CoraSessionMessageSource[],
  savedConversations: CoraSavedConversationSummary[] = [],
): CoraWorkspaceSessionSnapshot {
  return {
    messages: summarizeSessionMessages(messages),
    artifacts: extractSessionArtifacts(messages),
    savedConversations,
  }
}

export const ARTIFACT_KIND_META: Record<
  CoraArtifactKind,
  { label: string; emptyHint: string }
> = {
  note: { label: "Study notes", emptyHint: "Bookmark a reply or ask for a micro-lesson" },
  code: { label: "Code snippets", emptyHint: "Code blocks from Cora replies appear here" },
  equation: { label: "Equations", emptyHint: "LaTeX from replies is collected automatically" },
  flowchart: { label: "Flowcharts", emptyHint: "Mermaid diagrams from replies show up here" },
}
