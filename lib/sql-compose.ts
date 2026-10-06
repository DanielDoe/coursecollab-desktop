export type SqlFragment = {
  __sqlFragment: true
  text: string
  params: unknown[]
}

export function isSqlFragment(value: unknown): value is SqlFragment {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { __sqlFragment?: boolean }).__sqlFragment === true &&
      typeof (value as { text?: unknown }).text === "string" &&
      Array.isArray((value as { params?: unknown }).params),
  )
}

function isUnsafeFragment(value: unknown): value is { __unsafe: true; __sql: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { __unsafe?: boolean }).__unsafe === true &&
      typeof (value as { __sql?: unknown }).__sql === "string",
  )
}

/** Renumber $1..$n so a nested snippet can be spliced after the parent’s parameters. */
export function renumberSqlPlaceholders(sqlText: string, offset: number): string {
  if (!offset) return sqlText
  const nums = [...sqlText.matchAll(/\$(\d+)/g)].map((match) => Number(match[1]))
  const max = nums.reduce((hi, n) => Math.max(hi, n), 0)
  let out = sqlText
  for (let n = max; n >= 1; n -= 1) {
    out = out.replace(new RegExp(`\\$${n}(?!\\d)`, "g"), `$${n + offset}`)
  }
  return out
}

/**
 * Turn a tagged-template call into SQL text plus parameters.
 * Nested `sql` snippets and `sql.unsafe` fragments are spliced in, not bound as values.
 */
export function composeSql(strings: TemplateStringsArray, values: unknown[]): SqlFragment {
  let text = strings[0] ?? ""
  const params: unknown[] = []
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i]
    const tail = strings[i + 1] ?? ""
    if (isSqlFragment(value)) {
      text += renumberSqlPlaceholders(value.text, params.length) + tail
      params.push(...value.params)
    } else if (isUnsafeFragment(value)) {
      text += value.__sql + tail
    } else {
      params.push(value)
      text += `$${params.length}${tail}`
    }
  }
  return { __sqlFragment: true, text, params }
}

/**
 * ADD CONSTRAINT / CREATE POLICY / CREATE INDEX are retried on every request.
 * Postgres 42710 / 42P07 means that object is already there, which is the goal.
 */
export function isAlreadyAppliedSchemaDdl(code: string | undefined, query: string): boolean {
  if (code !== "42710" && code !== "42P07") return false
  const normalized = query.replace(/\s+/g, " ").toUpperCase()
  return (
    /\bADD CONSTRAINT\b/.test(normalized) ||
    /\bCREATE POLICY\b/.test(normalized) ||
    /\bCREATE INDEX\b/.test(normalized) ||
    /\bCREATE UNIQUE INDEX\b/.test(normalized)
  )
}
