/**
 * Match login / password-reset / account checks to `students`:
 * - PVAMU `student_id`, Canvas `sis_user_id` (trimmed)
 * - Canvas-style `p` + digits (also tries digits-only for `student_id` / `sis_user_id`)
 * - `sis_login_id` (case-insensitive), e.g. `mlawson13`
 * When both id columns hold the same value, one row still matches. DEMO001 only matches `student_id`.
 */
function loginIdentifierVariantsForSql(rawInput: string | undefined): {
  idEquals: string[]
  sisLoginLower: string
} {
  const idInput = String(rawInput ?? "").trim()
  if (!idInput) return { idEquals: [], sisLoginLower: "" }

  const idEquals = new Set<string>([idInput])
  const pDigits = idInput.match(/^p(\d+)$/i)
  if (pDigits) idEquals.add(pDigits[1])

  return { idEquals: [...idEquals], sisLoginLower: idInput.toLowerCase() }
}

export async function findStudentsByLoginIdentifier(
  sqlExec: (fragments: TemplateStringsArray, ...params: unknown[]) => Promise<unknown[]>,
  rawInput: string | undefined,
): Promise<unknown[]> {
  const idInput = String(rawInput ?? "").trim()
  if (!idInput) return []

  if (idInput === "DEMO001") {
    return sqlExec`SELECT * FROM students WHERE student_id = 'DEMO001'`
  }

  const { idEquals, sisLoginLower } = loginIdentifierVariantsForSql(idInput)
  if (idEquals.length === 0) return []

  return sqlExec`
    SELECT * FROM students
    WHERE TRIM(student_id::text) = ANY(${idEquals}::text[])
       OR TRIM(COALESCE(sis_user_id::text, '')) = ANY(${idEquals}::text[])
       OR (
         NULLIF(TRIM(LOWER(COALESCE(sis_login_id, ''))), '') IS NOT NULL
         AND TRIM(LOWER(COALESCE(sis_login_id, ''))) = ${sisLoginLower}
       )
    LIMIT 2
  `
}
