const FORBIDDEN_PATTERNS = [
  /\bDROP\b/i,
  /\bDELETE\b/i,
  /\bUPDATE\b/i,
  /\bALTER\b/i,
  /\bTRUNCATE\b/i,
  /\bCREATE\b/i,
  /\bGRANT\b/i,
  /\bREVOKE\b/i,
  /\bEXECUTE\b/i,
  /\bCOPY\b/i,
]

/** Strip SQL comments and quoted literals so `;` inside strings is not counted as a statement break. */
function stripQuotedLiteralsForValidation(sql: string): string {
  let out = sql.replace(/\$[a-zA-Z_]*\$[\s\S]*?\$[a-zA-Z_]*\$/g, " ")
  // JSONB string literals like '"text"'::jsonb
  out = out.replace(/'(?:''|[^'])*'::jsonb/gi, " ")
  out = out.replace(/'(?:''|[^'])*'/g, " ")
  out = out.replace(/--[^\n\r]*/g, " ")
  out = out.replace(/\/\*[\s\S]*?\*\//g, " ")
  return out
}

export function validateQuestionBankInsertSql(raw: string): { ok: true; sql: string } | { ok: false; error: string } {
  let sql = raw.trim().replace(/;+\s*$/g, "")
  if (!sql) {
    return { ok: false, error: "SQL is empty." }
  }

  const strippedForValidation = stripQuotedLiteralsForValidation(sql)
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(strippedForValidation)) {
      return { ok: false, error: "Only INSERT INTO question_bank is allowed (no DDL/DML)." }
    }
  }

  const normalized = sql.replace(/\s+/g, " ").trim()
  const upper = normalized.toUpperCase()
  if (!upper.startsWith("INSERT INTO QUESTION_BANK")) {
    return { ok: false, error: "Statement must start with INSERT INTO question_bank." }
  }

  const semicolonCount = (stripQuotedLiteralsForValidation(sql).match(/;/g) || []).length
  if (semicolonCount > 0) {
    return { ok: false, error: "Only one SQL statement is allowed (omit trailing semicolons inside literals)." }
  }

  if (!/\bRETURNING\b/i.test(sql)) {
    sql = `${sql}\nRETURNING id`
  }

  return { ok: true, sql: sql.endsWith(";") ? sql : `${sql};` }
}

export function injectCourseIdIntoQuestionBankSql(sql: string, courseId: number): string {
  const cid = Math.trunc(Number(courseId))
  if (!Number.isFinite(cid) || cid < 1) {
    throw new Error("Invalid course id")
  }
  return sql.replace(/\{\{COURSE_ID\}\}/g, String(cid))
}
