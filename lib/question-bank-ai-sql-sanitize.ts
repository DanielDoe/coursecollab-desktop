/**
 * Fixes common AI mistakes in generated question_bank INSERT SQL:
 * - Dollar-quoted JSON blobs without ::jsonb cast
 * - Dollar-quoted plain text in JSONB columns (e.g. correct_answer rubric lines)
 */
function jsonbLiteralFromParsed(parsed: unknown): string {
  const json = JSON.stringify(parsed)
  return `'${json.replace(/'/g, "''")}'::jsonb`
}

function jsonbStringLiteralFromText(text: string): string {
  return `'${JSON.stringify(text).replace(/'/g, "''")}'::jsonb`
}

function tryParseJson(inner: string): unknown | null {
  const trimmed = inner.trim()
  if (!(trimmed.startsWith("[") || trimmed.startsWith("{"))) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

export function sanitizeAiGeneratedQuestionBankSql(sql: string): string {
  let out = sql.replace(/\$([a-zA-Z_]*)\$([\s\S]*?)\$\1\$/g, (full, _tag, inner, offset, whole) => {
    const after = whole.slice(offset + full.length, offset + full.length + 24)
    if (/^\s*::jsonb/i.test(after)) return full

    const parsed = tryParseJson(inner)
    if (parsed !== null) return jsonbLiteralFromParsed(parsed)

    return full
  })

  // After options JSONB, correct_answer is often a dollar-quoted rubric string (must be JSONB string).
  out = out.replace(
    /('(?:\[\]|\[[\s\S]*?\])'::jsonb,\s*)\$([a-zA-Z_]*)\$([\s\S]*?)\$\2\$/g,
    (_match, prefix, _tag, inner) => {
      const parsed = tryParseJson(inner)
      if (parsed !== null) return `${prefix}${jsonbLiteralFromParsed(parsed)}`
      return `${prefix}${jsonbStringLiteralFromText(inner)}`
    },
  )

  return out
}
