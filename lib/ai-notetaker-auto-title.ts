/** Titles we replace automatically after transcription when the student never edited them. */
const DEFAULT_NOTETAKER_TITLES = new Set([
  "New voice lecture",
  "New uploaded lecture",
  "Untitled lecture",
])

/** Stable titles like "New note 42" (assigned on create). */
const NEW_NOTE_TITLE_RE = /^New note \d+$/i

export function isNewNoteNumberedTitle(title: string | null | undefined): boolean {
  if (!title) return false
  return NEW_NOTE_TITLE_RE.test(title.trim())
}

export function isDefaultNotetakerTitle(title: string | null | undefined): boolean {
  if (!title) return true
  return DEFAULT_NOTETAKER_TITLES.has(title.trim())
}

/**
 * Breadcrumb / tab title: never show a long auto-transcript line. Prefer "New note {id}" until the student
 * picks a reasonably short display name.
 */
export function notetakerNavigationTitle(
  noteId: number,
  draftTitle: string,
  storedTitle: string | null | undefined,
): string {
  const raw = (draftTitle.trim() || storedTitle?.trim() || "").slice(0, 200)
  if (isNewNoteNumberedTitle(raw)) return raw.trim()
  if (raw.length > 0 && raw.length <= 56) return raw
  return `New note ${noteId}`
}

/** First substantive line of transcript, capped for DB title column. */
export function suggestedTitleFromTranscript(transcript: string): string {
  const lines = transcript
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  const first = lines[0] || "Lecture notes"
  const cleaned = first.replace(/^#+\s*/, "").replace(/\*+/g, "").trim()
  const clipped = cleaned.slice(0, 200)
  return clipped || "Lecture notes"
}
