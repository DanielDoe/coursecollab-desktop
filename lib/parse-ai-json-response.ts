/**
 * Robust JSON extraction for vision / rubric AI graders.
 * Handles markdown fences, truncated JSON, and LaTeX backslashes in feedback strings.
 */

function tryParseJson(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/** LaTeX in model output uses `\omega` etc. — invalid as bare JSON escapes. */
function sanitizeInvalidJsonEscapes(text: string): string {
  return text.replace(/\\(?!["\\/bfnrtu])/g, "\\\\")
}

function extractJsonBlob(raw: string): string {
  let text = raw.trim()
  text = text.replace(/^[\s\S]*?```(?:json)?\s*/i, "").replace(/\s*```[\s\S]*$/i, "").trim()

  const fenced = raw.trim().match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    text = fenced[1].trim()
  }

  const start = text.indexOf("{")
  if (start < 0) return text
  return text.slice(start)
}

function repairTruncatedJson(json: string): string {
  let repaired = json.trim()
  const openBraces = (repaired.match(/\{/g) || []).length
  const closeBraces = (repaired.match(/\}/g) || []).length
  const openBrackets = (repaired.match(/\[/g) || []).length
  const closeBrackets = (repaired.match(/\]/g) || []).length

  if (openBrackets > closeBrackets) {
    const lastChar = repaired.slice(-1)
    if (!/["\]}\s,]/.test(lastChar)) repaired += '"'
    for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += "]"
  }
  for (let i = 0; i < openBraces - closeBraces; i++) repaired += "}"

  return repaired
}

function unescapeJsonString(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
}

function extractJsonStringField(raw: string, field: string): string | null {
  const closed = raw.match(
    new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "s"),
  )
  if (closed?.[1]) return unescapeJsonString(closed[1]).trim()

  const unclosed = raw.match(
    new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`, "s"),
  )
  if (unclosed?.[1]) return unescapeJsonString(unclosed[1]).trim()

  return null
}

function extractVisionGradingFields(raw: string): Record<string, unknown> | null {
  const feedback = extractJsonStringField(raw, "feedback")
  if (!feedback) return null

  const result: Record<string, unknown> = { feedback }

  const rubric: Record<string, number> = {}
  for (const key of ["setup", "method", "calculations", "final_answer"] as const) {
    const match = raw.match(new RegExp(`"${key}"\\s*:\\s*([\\d.]+)`))
    if (match) rubric[key] = parseFloat(match[1])
  }
  if (Object.keys(rubric).length > 0) {
    result.rubricScores = rubric
  }

  const uploadPct = raw.match(/"uploadScorePercent"\s*:\s*(\d+)/)
  if (uploadPct) result.uploadScorePercent = parseInt(uploadPct[1], 10)

  const uploadEarned = raw.match(/"uploadPointsEarned"\s*:\s*([\d.]+)/)
  if (uploadEarned) result.uploadPointsEarned = parseFloat(uploadEarned[1])

  for (const field of ["canAutoGrade", "requiresManualReview"] as const) {
    const match = raw.match(new RegExp(`"${field}"\\s*:\\s*(true|false)`, "i"))
    if (match) result[field] = match[1].toLowerCase() === "true"
  }

  const confidence = raw.match(/"confidence"\s*:\s*"(high|medium|low)"/i)
  if (confidence) result.confidence = confidence[1].toLowerCase()

  const strengths = raw.match(/"strengths"\s*:\s*\[([\s\S]*?)\]/)
  if (strengths?.[1]) {
    const items = [...strengths[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) =>
      unescapeJsonString(m[1]),
    )
    if (items.length) result.strengths = items
  }

  const improvements = raw.match(/"improvements"\s*:\s*\[([\s\S]*?)\]/)
  if (improvements?.[1]) {
    const items = [...improvements[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) =>
      unescapeJsonString(m[1]),
    )
    if (items.length) result.improvements = items
  }

  return result
}

export function parseAiJsonResponse(raw: string, logTag = "[AI JSON]"): Record<string, unknown> | null {
  if (!raw?.trim()) return null

  const blob = extractJsonBlob(raw)
  const attempts = [
    blob,
    sanitizeInvalidJsonEscapes(blob),
    repairTruncatedJson(blob),
    repairTruncatedJson(sanitizeInvalidJsonEscapes(blob)),
  ]

  for (const candidate of attempts) {
    const parsed = tryParseJson(candidate)
    if (parsed) return parsed
  }

  const fallback = extractVisionGradingFields(raw)
  if (fallback) {
    console.warn(logTag, "Used regex fallback to parse AI JSON response")
    return fallback
  }

  console.warn(logTag, "Failed to parse AI JSON (first 400 chars):", raw.slice(0, 400))
  return null
}
