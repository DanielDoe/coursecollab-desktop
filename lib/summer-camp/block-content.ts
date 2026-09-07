/** Normalize block JSON from API (jsonb may arrive as object or string). */
export function normalizeBlockContent(raw: unknown): Record<string, unknown> {
  if (raw == null) return {}
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {}
    } catch {
      return {}
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  return {}
}

export function normalizeCampModuleBlock<T extends { content: unknown }>(block: T): T & { content: Record<string, unknown> } {
  return { ...block, content: normalizeBlockContent(block.content) }
}
