/** First + last name initials (e.g. "Ayden Dean Edwards" → "AE"). */
export function initialsFromName(name: string, fallback = "?"): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return fallback
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase()
}
