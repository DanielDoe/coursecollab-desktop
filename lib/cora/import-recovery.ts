/** Restore imported course questions on hydrated Cora conversations (web). */

import type { CoraImportableItem } from "@/lib/cora/question-import-types"
import type { CoraProblemContext } from "@/lib/cora/types"
import { getActiveUserVersionIndex } from "@/lib/cora/message-versions"

const GENERIC_IMPORT_OPENER =
  /^Help me work through this (?:imported )?question(?:\s*:\s*(.+?))?\.?\s*$/i

const AUTO_MATCH_MIN_SCORE = 70
const AUTO_MATCH_MIN_GAP = 18

type VersionedMsg = {
  id: string
  role: "student" | "ai" | string
  content: string
  importedQuestion?: CoraProblemContext | unknown
  importedQuestionLabel?: string
  versions?: Array<{
    content: string
    importedQuestion?: unknown
    importedQuestionLabel?: string
  }>
}

type ConversationLike<T extends VersionedMsg> = {
  id: string
  title: string
  messages: T[]
}

export function parseGenericImportTitle(content: string): string | null {
  const match = content.trim().match(GENERIC_IMPORT_OPENER)
  if (!match) return null
  return match[1]?.trim() || null
}

export function isGenericImportOpener(content: string): boolean {
  return GENERIC_IMPORT_OPENER.test(content.trim())
}

function normalizeMatchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s$=+\-*/().]/g, "")
    .trim()
}

export function attachImportedQuestionToMessage<T extends VersionedMsg>(
  message: T,
  problem: CoraProblemContext,
  label: string,
): T {
  const importedQuestionLabel = label.trim() || problem.title?.trim() || problem.topic?.trim() || "Imported question"

  if (!message.versions?.length) {
    return {
      ...message,
      importedQuestion: problem,
      importedQuestionLabel,
    }
  }

  const activeIndex = getActiveUserVersionIndex(message)
  const versions = message.versions.map((version, index) =>
    index === activeIndex
      ? {
          ...version,
          importedQuestion: problem,
          importedQuestionLabel,
        }
      : version,
  )

  return {
    ...message,
    versions,
    activeVersionIndex: activeIndex,
    importedQuestion: problem,
    importedQuestionLabel,
  }
}

function scoreCatalogItem(
  item: CoraImportableItem,
  hints: {
    title?: string | null
    userContent?: string
    assistantContent?: string
    threadTitle?: string
  },
): number {
  let score = 0
  const labelNorm = normalizeMatchText(item.label)
  const previewNorm = normalizeMatchText(item.preview)

  if (hints.title) {
    const titleNorm = normalizeMatchText(hints.title)
    if (titleNorm && labelNorm === titleNorm) score += 100
    if (titleNorm && labelNorm.includes(titleNorm)) score += 85
    if (titleNorm && previewNorm.includes(titleNorm)) score += 75
  }

  if (hints.threadTitle) {
    const threadNorm = normalizeMatchText(hints.threadTitle)
    if (threadNorm && labelNorm === threadNorm) score += 95
    if (threadNorm && labelNorm.includes(threadNorm)) score += 80
  }

  if (hints.assistantContent) {
    const assistantNorm = normalizeMatchText(hints.assistantContent)
    if (previewNorm.length >= 24) {
      const previewSlice = previewNorm.slice(0, Math.min(80, previewNorm.length))
      if (assistantNorm.includes(previewSlice)) score += 72
    }
    if (labelNorm.length >= 8 && assistantNorm.includes(labelNorm)) score += 48
  }

  if (hints.userContent && !isGenericImportOpener(hints.userContent)) {
    const userNorm = normalizeMatchText(hints.userContent)
    if (previewNorm.length >= 24 && userNorm.length >= 12) {
      const previewSlice = previewNorm.slice(0, Math.min(48, previewNorm.length))
      if (userNorm.includes(previewSlice) || previewNorm.includes(userNorm.slice(0, 48))) {
        score += 36
      }
    }
  }

  return score
}

function pickCatalogMatch(
  catalog: CoraImportableItem[],
  hints: {
    title?: string | null
    userContent?: string
    assistantContent?: string
    threadTitle?: string
  },
): CoraImportableItem | null {
  const scored = catalog
    .map((item) => ({ item, score: scoreCatalogItem(item, hints) }))
    .filter((entry) => entry.score >= AUTO_MATCH_MIN_SCORE)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) return null
  if (scored.length === 1) return scored[0]!.item

  const best = scored[0]!
  const second = scored[1]!
  if (best.score - second.score < AUTO_MATCH_MIN_GAP) return null
  return best.item
}

function readEmbeddedImportedProblem(message: VersionedMsg): CoraProblemContext | undefined {
  if (message.importedQuestion && typeof message.importedQuestion === "object") {
    return message.importedQuestion as CoraProblemContext
  }
  for (const version of message.versions ?? []) {
    if (version.importedQuestion && typeof version.importedQuestion === "object") {
      return version.importedQuestion as CoraProblemContext
    }
  }
  return undefined
}

function messageNeedsImportRecovery(
  message: VersionedMsg,
  context?: { isFirstUser?: boolean; nextAssistant?: VersionedMsg },
): boolean {
  if (message.role !== "student") return false
  if (message.importedQuestion) return false
  if (readEmbeddedImportedProblem(message)) return true
  if (isGenericImportOpener(message.content)) return true
  if (message.versions?.some((version) => version.importedQuestion)) return true
  if (context?.isFirstUser && context.nextAssistant?.content.trim()) return true
  return false
}

async function fetchCatalog(studentId: string): Promise<CoraImportableItem[]> {
  const headers = { "x-student-id": studentId }
  const sourcesRes = await fetch("/api/cora/question-import?level=sources", { headers })
  if (!sourcesRes.ok) return []
  const sourcesData = await sourcesRes.json()
  const sources = (sourcesData.sources ?? []) as Array<{ key: string; locked?: boolean }>
  const items: CoraImportableItem[] = []

  for (const source of sources) {
    const containersRes = await fetch(
      `/api/cora/question-import?level=containers&sourceKey=${encodeURIComponent(source.key)}`,
      { headers },
    )
    if (!containersRes.ok) continue
    const containersData = await containersRes.json()
    const containers = (containersData.containers ?? []) as Array<{ id: string; locked?: boolean }>
    for (const container of containers) {
      if (container.locked) continue
      const itemsRes = await fetch(
        `/api/cora/question-import?level=questions&sourceKey=${encodeURIComponent(source.key)}&containerId=${encodeURIComponent(container.id)}`,
        { headers },
      )
      if (!itemsRes.ok) continue
      const itemsData = await itemsRes.json()
      items.push(...((itemsData.items ?? []) as CoraImportableItem[]))
    }
  }

  return items
}

async function resolveItem(
  studentId: string,
  item: CoraImportableItem,
): Promise<CoraProblemContext | null> {
  const res = await fetch("/api/cora/question-import", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-student-id": studentId,
    },
    body: JSON.stringify({
      source: item.source,
      questionId: item.questionId,
      quizId: item.quizId,
      bankQuestionId: item.bankQuestionId,
      lectureId: item.lectureId,
      classroomSubmissionId: item.classroomSubmissionId,
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return (data.problem as CoraProblemContext) ?? null
}

export async function restoreImportedQuestionsInConversations<T extends VersionedMsg>(
  studentId: string,
  conversations: ConversationLike<T>[],
): Promise<{ conversations: ConversationLike<T>[]; changed: boolean; restoredCount: number }> {
  const needsWork = conversations.some((conv) =>
    conv.messages.some((message, index) => {
      if (message.role !== "student") return false
      const isFirstUser = !conv.messages.slice(0, index).some((entry) => entry.role === "student")
      const nextAssistant =
        conv.messages[index + 1]?.role === "ai" ? conv.messages[index + 1] : undefined
      return messageNeedsImportRecovery(message, { isFirstUser, nextAssistant })
    }),
  )

  if (!needsWork) {
    return { conversations, changed: false, restoredCount: 0 }
  }

  let catalog: CoraImportableItem[] = []
  try {
    catalog = await fetchCatalog(studentId)
  } catch {
    catalog = []
  }

  let changed = false
  let restoredCount = 0
  const nextConversations = conversations.map((conv) => {
    let convChanged = false
    const nextMessages = conv.messages.map((message, index) => {
      const isFirstUser = !conv.messages.slice(0, index).some((entry) => entry.role === "student")
      const nextAssistant =
        conv.messages[index + 1]?.role === "ai" ? conv.messages[index + 1] : undefined
      if (!messageNeedsImportRecovery(message, { isFirstUser, nextAssistant })) return message

      const embedded = readEmbeddedImportedProblem(message)
      if (embedded) {
        convChanged = true
        restoredCount += 1
        return attachImportedQuestionToMessage(
          message,
          embedded,
          message.importedQuestionLabel ?? embedded.title ?? embedded.topic ?? "Imported question",
        )
      }

      return message
    })

    if (convChanged) {
      changed = true
      return { ...conv, messages: nextMessages }
    }
    return conv
  })

  // Async catalog rematch for remaining generic openers
  const rematched: ConversationLike<T>[] = []
  for (const conv of nextConversations) {
    const messages: T[] = []
    let convChanged = false

    for (let index = 0; index < conv.messages.length; index += 1) {
      const message = conv.messages[index]!
      const isFirstUser = !conv.messages.slice(0, index).some((entry) => entry.role === "student")
      const nextAssistant =
        conv.messages[index + 1]?.role === "ai" ? conv.messages[index + 1] : undefined

      if (
        message.role !== "student" ||
        message.importedQuestion ||
        !messageNeedsImportRecovery(message, { isFirstUser, nextAssistant }) ||
        catalog.length === 0
      ) {
        messages.push(message)
        continue
      }

      const title = parseGenericImportTitle(message.content)
      const match = pickCatalogMatch(catalog, {
        title,
        userContent: message.content,
        assistantContent: nextAssistant?.content,
        threadTitle: conv.title,
      })

      if (!match) {
        messages.push(message)
        continue
      }

      const problem = await resolveItem(studentId, match)
      if (!problem) {
        messages.push(message)
        continue
      }

      messages.push(attachImportedQuestionToMessage(message, problem, match.label))
      convChanged = true
      restoredCount += 1
    }

    if (convChanged) {
      changed = true
      rematched.push({ ...conv, messages })
    } else {
      rematched.push(conv)
    }
  }

  return { conversations: rematched, changed, restoredCount }
}
