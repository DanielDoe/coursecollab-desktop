import { sql } from "@/lib/db"

const OPTIONAL_QUIZ_QUESTION_COLUMNS = [
  "circuit_spec",
  "subquestions",
  "question_media",
  "solution_upload_config",
] as const

let columnCache: Set<string> | null = null

/** Cached set of `quiz_questions` column names (for DBs missing newer migrations). */
export async function getQuizQuestionsColumns(): Promise<Set<string>> {
  if (columnCache) return columnCache
  const rows = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quiz_questions'
  `
  columnCache = new Set(
    (rows as { column_name: string }[]).map((r) => String(r.column_name).toLowerCase()),
  )
  return columnCache
}

/** SQL select fragment: column name or `NULL::jsonb AS alias` when migration not applied. */
export function quizQuestionJsonbSelect(
  columns: Set<string>,
  name: (typeof OPTIONAL_QUIZ_QUESTION_COLUMNS)[number],
  tableAlias = "",
): string {
  const prefix = tableAlias ? `${tableAlias}.` : ""
  return columns.has(name) ? `${prefix}${name}` : `NULL::jsonb AS ${name}`
}

export async function buildQuizQuestionSelectExtras(tableAlias = ""): Promise<string> {
  const columns = await getQuizQuestionsColumns()
  return OPTIONAL_QUIZ_QUESTION_COLUMNS.map((name) =>
    quizQuestionJsonbSelect(columns, name, tableAlias),
  ).join(",\n        ")
}
