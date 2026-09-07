export type CoraMessageVersion = {
  content: string
  importedQuestion?: unknown
  importedQuestionLabel?: string
  assistantContent?: string
}

type VersionedUserMessage = {
  role: "student" | "ai" | string
  content: string
  versions?: CoraMessageVersion[]
  activeVersionIndex?: number
  importedQuestion?: unknown
  importedQuestionLabel?: string
}

export function getUserMessageVersions(message: VersionedUserMessage): CoraMessageVersion[] {
  if (message.role !== "student") return []
  if (message.versions?.length) return message.versions
  if (!message.content.trim() && !message.importedQuestion) return []
  return [
    {
      content: message.content,
      importedQuestion: message.importedQuestion,
      importedQuestionLabel: message.importedQuestionLabel,
    },
  ]
}

export function getActiveUserVersionIndex(message: VersionedUserMessage): number {
  const versions = getUserMessageVersions(message)
  if (versions.length === 0) return 0
  const idx = message.activeVersionIndex ?? versions.length - 1
  return Math.min(Math.max(idx, 0), versions.length - 1)
}

export function getActiveUserVersion(message: VersionedUserMessage): CoraMessageVersion {
  const versions = getUserMessageVersions(message)
  return versions[getActiveUserVersionIndex(message)] ?? { content: message.content }
}

export function userMessageHasMultipleVersions(message: VersionedUserMessage): boolean {
  return getUserMessageVersions(message).length > 1
}

export function saveAssistantOnActiveVersion<T extends VersionedUserMessage>(
  message: T,
  assistantContent: string,
): T {
  if (message.role !== "student") return message
  const versions = getUserMessageVersions(message).map((v) => ({ ...v }))
  const idx = getActiveUserVersionIndex(message)
  versions[idx] = { ...versions[idx], assistantContent }
  return { ...message, versions, activeVersionIndex: idx }
}

export function appendUserMessageVersion<T extends VersionedUserMessage>(
  message: T,
  next: Pick<CoraMessageVersion, "content" | "importedQuestion" | "importedQuestionLabel">,
): T {
  const versions = getUserMessageVersions(message).map((v) => ({ ...v }))
  versions.push({
    content: next.content,
    importedQuestion: next.importedQuestion,
    importedQuestionLabel: next.importedQuestionLabel,
  })
  const activeVersionIndex = versions.length - 1
  return {
    ...message,
    versions,
    activeVersionIndex,
    content: next.content,
    importedQuestion: next.importedQuestion as T["importedQuestion"],
    importedQuestionLabel: next.importedQuestionLabel,
  }
}

export function applyUserMessageVersion<T extends VersionedUserMessage>(
  message: T,
  versionIndex: number,
): T {
  const versions = getUserMessageVersions(message)
  const idx = Math.min(Math.max(versionIndex, 0), versions.length - 1)
  const ver = versions[idx]!
  return {
    ...message,
    versions: message.versions?.length ? message.versions : versions,
    activeVersionIndex: idx,
    content: ver.content,
    importedQuestion: ver.importedQuestion as T["importedQuestion"],
    importedQuestionLabel: ver.importedQuestionLabel,
  }
}

export function rebuildThreadAfterVersionChange<T extends VersionedUserMessage & { id: string }>(
  messages: T[],
  userIndex: number,
  updatedUser: T,
  makeAssistant: (content: string, versionIndex: number) => T,
): T[] {
  const ver = getActiveUserVersion(updatedUser)
  const next: T[] = messages.slice(0, userIndex).concat(updatedUser)
  if (ver.assistantContent?.trim()) {
    next.push(makeAssistant(ver.assistantContent, updatedUser.activeVersionIndex ?? 0))
  }
  return next
}
