/** Quick reactions shown on hover bar (Teams-style). */
export const DM_QUICK_REACTIONS = ["👍", "❤️", "😆", "😮", "😢"] as const

/** Extended picker when user taps "+" on the hover bar. */
export const DM_MORE_REACTIONS = ["🎉", "👏", "🔥", "💯", "🤔", "👀", "🙏", "✅"] as const

/** UI presets only — any valid emoji from the keyboard is accepted server-side. */
export const DM_ALLOWED_REACTIONS = new Set<string>([
  ...DM_QUICK_REACTIONS,
  ...DM_MORE_REACTIONS,
])

export function normalizeMessageReactionEmoji(raw: string): string {
  return raw.normalize("NFC").trim()
}

/** Accept a single emoji grapheme (incl. ZWJ sequences / skin tones). */
export function isValidMessageReactionEmoji(raw: string): boolean {
  const emoji = normalizeMessageReactionEmoji(raw)
  if (!emoji || emoji.length > 64) return false

  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" })
    const segments = [...segmenter.segment(emoji)].map((part) => part.segment)
    if (segments.length !== 1) return false
    return /\p{Extended_Pictographic}/u.test(segments[0])
  }

  return /\p{Extended_Pictographic}/u.test(emoji)
}
