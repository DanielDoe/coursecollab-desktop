const MAX_SUMMARY_CHARS = 320
const MAX_INPUT_CHARS = 4_000

const KEYWORDS =
  /\b(due|deadline|submit|exam|quiz|homework|recommendation|letter|approve|review|class|cancel|required|must|please|remember|important|attendance|final|midterm|updated|request)\b/i

function truncate(value: string, max = MAX_SUMMARY_CHARS): string {
  const trimmed = value.trim()
  if (trimmed.length <= max) return trimmed
  const cut = trimmed.slice(0, max)
  const lastSpace = cut.lastIndexOf(" ")
  const base = (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()
  return `${base}…`
}

export function fallbackNotificationSummary(params: {
  title: string
  message: string
  type?: string | null
}): string {
  const title = params.title.trim()
  const message = params.message.trim()
  const plain = message.slice(0, MAX_INPUT_CHARS)

  if (!plain) {
    return truncate(title || "Course notification")
  }

  const sentences = plain
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12)

  const priority = sentences.filter((s) => KEYWORDS.test(s))
  let summary = ""
  if (priority.length >= 2) {
    summary = `${priority[0]} ${priority[1]}`
  } else if (priority.length === 1) {
    summary = priority[0]
  } else if (sentences.length >= 2) {
    summary = `${sentences[0]} ${sentences[1]}`
  } else {
    summary = sentences[0] ?? plain
  }

  if (!summary.toLowerCase().includes(title.toLowerCase().slice(0, 12)) && title) {
    summary = `${title}. ${summary}`
  }

  return truncate(summary)
}

export { MAX_SUMMARY_CHARS, MAX_INPUT_CHARS, truncate }
