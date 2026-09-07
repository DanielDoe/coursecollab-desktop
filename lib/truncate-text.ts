/** Truncate for nav labels; keeps full string available via title attribute. */
export function truncateNavLabel(text: string, maxLen = 52): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxLen) return trimmed
  return `${trimmed.slice(0, maxLen - 1).trimEnd()}…`
}
