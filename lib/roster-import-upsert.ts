/**
 * Canvas / roster CSV import: update existing enrollments when PVAMU ID changes.
 * Matches students in the target session by Canvas ID (`student_id`), `sis_user_id`,
 * and `sis_login_id` only — not email, since many students use Gmail while the roster
 * implies `{sis_login}@pvamu.edu`.
 *
 * On update, existing `email` is kept unless the import row includes an explicit `email`.
 */

export type RosterImportRow = {
  student_id: string
  /** True when student_id was derived from email (Canvas Analytics has no Canvas user id). */
  student_id_inferred?: boolean
  full_name: string
  sis_user_id?: string | null
  sis_login_id?: string | null
  email?: string | null
  canvas_section?: string | null
}

export type RosterUpsertOutcome =
  | { result: "added" }
  | { result: "updated" }
  | { result: "skipped"; reason: string }

type SqlFn = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>
}

async function quizAttemptCount(sql: SqlFn, internalStudentId: number): Promise<number> {
  const r = (await sql`
    SELECT COUNT(*)::int AS c FROM quiz_attempts WHERE student_id = ${internalStudentId}
  `) as { c: number }[]
  return r[0]?.c ?? 0
}

function normStr(v: unknown): string {
  return String(v ?? "").trim()
}

/**
 * Upsert one roster row for a session. Does not overwrite existing password_hash on update.
 */
export async function upsertStudentFromRosterRow(
  sql: SqlFn,
  sessionId: number,
  sessionCode: string,
  row: RosterImportRow,
  passwordHash: string,
): Promise<RosterUpsertOutcome> {
  const sid = normStr(row.student_id)
  const fullName = normStr(row.full_name)
  if (!sid || !fullName) {
    return { result: "skipped", reason: "missing student_id or full_name" }
  }

  const sisLoginRaw = normStr(row.sis_login_id)
  const sisUserTrimmed = normStr(row.sis_user_id)
  const sisUser = sisUserTrimmed || null
  const canvasSec = normStr(row.canvas_section) || null
  const emailFromCsv = normStr(row.email) || null
  const defaultPvamuEmail = sisLoginRaw ? `${sisLoginRaw.toLowerCase()}@pvamu.edu` : null
  const emailForInsert = emailFromCsv || defaultPvamuEmail

  const matches = (await sql`
    SELECT id, student_id::text AS student_id
    FROM students
    WHERE session_id = ${sessionId}
      AND (
        TRIM(student_id::text) = ${sid}
        OR (
          TRIM(COALESCE(${sisUserTrimmed}, '')) <> ''
          AND TRIM(COALESCE(sis_user_id::text, '')) = TRIM(${sisUserTrimmed})
        )
        OR (
          TRIM(COALESCE(${sisLoginRaw}, '')) <> ''
          AND TRIM(LOWER(COALESCE(sis_login_id, ''))) = TRIM(LOWER(${sisLoginRaw}))
        )
      )
    ORDER BY id ASC
  `) as { id: number; student_id: string }[]

  let matchId: number | null = null
  if (matches.length === 0) {
    const byGlobalSid = (await sql`
      SELECT id FROM students WHERE TRIM(student_id::text) = ${sid} ORDER BY id ASC LIMIT 2
    `) as { id: number }[]
    if (byGlobalSid.length === 1) {
      matchId = byGlobalSid[0].id
    } else if (byGlobalSid.length > 1) {
      return { result: "skipped", reason: `multiple global rows for student_id ${sid}` }
    }
  } else if (matches.length === 1) {
    matchId = matches[0].id
  } else {
    let best = matches[0]
    let bestC = await quizAttemptCount(sql, best.id)
    for (let i = 1; i < matches.length; i++) {
      const c = await quizAttemptCount(sql, matches[i].id)
      if (c > bestC || (c === bestC && matches[i].id < best.id)) {
        best = matches[i]
        bestC = c
      }
    }
    matchId = best.id
  }

  if (matchId != null) {
    const othersSameSessionSameNewSid = (await sql`
      SELECT id FROM students
      WHERE session_id = ${sessionId}
        AND TRIM(student_id::text) = ${sid}
        AND id != ${matchId}
    `) as { id: number }[]

    for (const o of othersSameSessionSameNewSid) {
      const c = await quizAttemptCount(sql, o.id)
      if (c > 0) {
        return {
          result: "skipped",
          reason: `duplicate student_id ${sid} in session: id ${o.id} has attempts; resolve manually`,
        }
      }
      await sql`DELETE FROM students WHERE id = ${o.id}`
    }

    const loginForCol = sisLoginRaw || null

    if (emailFromCsv) {
      await sql`
        UPDATE students SET
          student_id = ${sid},
          full_name = ${fullName},
          section = ${sessionCode},
          session_id = ${sessionId},
          email = ${emailFromCsv},
          sis_user_id = COALESCE(${sisUser}, sis_user_id),
          sis_login_id = COALESCE(${loginForCol}, sis_login_id),
          canvas_section = COALESCE(${canvasSec}, canvas_section)
        WHERE id = ${matchId}
      `
    } else {
      await sql`
        UPDATE students SET
          student_id = ${sid},
          full_name = ${fullName},
          section = ${sessionCode},
          session_id = ${sessionId},
          sis_user_id = COALESCE(${sisUser}, sis_user_id),
          sis_login_id = COALESCE(${loginForCol}, sis_login_id),
          canvas_section = COALESCE(${canvasSec}, canvas_section)
        WHERE id = ${matchId}
      `
    }

    return { result: "updated" }
  }

  await sql`
    INSERT INTO students (
      student_id,
      full_name,
      section,
      session_id,
      password_hash,
      has_changed_password,
      email,
      sis_user_id,
      sis_login_id,
      canvas_section
    )
    VALUES (
      ${sid},
      ${fullName},
      ${sessionCode},
      ${sessionId},
      ${passwordHash},
      false,
      ${emailForInsert},
      ${sisUser},
      ${sisLoginRaw || null},
      ${canvasSec}
    )
    ON CONFLICT (student_id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      section = EXCLUDED.section,
      session_id = EXCLUDED.session_id,
      email = COALESCE(NULLIF(TRIM(students.email), ''), EXCLUDED.email),
      sis_user_id = COALESCE(EXCLUDED.sis_user_id, students.sis_user_id),
      sis_login_id = COALESCE(EXCLUDED.sis_login_id, students.sis_login_id),
      canvas_section = COALESCE(EXCLUDED.canvas_section, students.canvas_section),
      password_hash = COALESCE(students.password_hash, EXCLUDED.password_hash)
  `

  return { result: "added" }
}

type ExistingRosterRow = {
  id: number
  student_id: string
  sis_user_id: string | null
  sis_login_id: string | null
  email: string | null
  attempts: number
}

function key(v: string | null | undefined): string {
  return String(v ?? "").trim().toLowerCase()
}

function matchExisting(
  row: ReturnType<typeof normalizeImportRow>,
  sessionRows: ExistingRosterRow[],
  globalBySid: Map<string, ExistingRosterRow[]>,
): ExistingRosterRow | "ambiguous" | null {
  const sessionHits = sessionRows.filter((s) => {
    if (key(s.student_id) === key(row.sid)) return true
    if (row.sisUser && key(s.sis_user_id) === key(row.sisUser)) return true
    if (row.sisLogin && key(s.sis_login_id) === key(row.sisLogin)) return true
    if (row.emailFromCsv && key(s.email) === key(row.emailFromCsv)) return true
    if (row.sisLogin && key(s.email).startsWith(`${key(row.sisLogin)}@`)) return true
    return false
  })
  if (sessionHits.length === 1) return sessionHits[0]
  if (sessionHits.length > 1) {
    const withAttempts = sessionHits.filter((s) => s.attempts > 0)
    if (withAttempts.length > 1) return "ambiguous"
    return [...sessionHits].sort((a, b) => b.attempts - a.attempts || a.id - b.id)[0]
  }
  const global = globalBySid.get(key(row.sid)) ?? []
  if (global.length === 1) return global[0]
  if (global.length > 1) return "ambiguous"
  return null
}

function normalizeImportRow(row: RosterImportRow) {
  const sid = normStr(row.student_id)
  const fullName = normStr(row.full_name)
  const sisLogin = normStr(row.sis_login_id)
  const sisUser = normStr(row.sis_user_id)
  const emailFromCsv = normStr(row.email)
  const defaultPvamuEmail = sisLogin ? `${sisLogin.toLowerCase()}@pvamu.edu` : null
  return {
    sid,
    sidInferred: Boolean(row.student_id_inferred) || sid.includes("@"),
    fullName,
    sisLogin,
    sisUser: sisUser || null,
    canvasSec: normStr(row.canvas_section) || null,
    emailFromCsv: emailFromCsv || null,
    emailForInsert: emailFromCsv || defaultPvamuEmail,
  }
}

function textCol(values: (string | null | undefined)[]): string[] {
  return values.map((v) => (v == null ? "" : String(v)))
}

export type RosterBatchSummary = { added: number; updated: number; skipped: number; total: number }

/** Load existing rows once, then bulk update + bulk insert. */
export async function upsertStudentsFromRosterRows(
  sql: SqlFn,
  sessionId: number,
  sessionCode: string,
  rows: RosterImportRow[],
  passwordHash: string,
): Promise<RosterBatchSummary> {
  const summary: RosterBatchSummary = { added: 0, updated: 0, skipped: 0, total: rows.length }
  const prepared = rows.map(normalizeImportRow).filter((r) => {
    if (!r.sid || !r.fullName) {
      summary.skipped += 1
      return false
    }
    return true
  })
  if (prepared.length === 0) return summary

  const seen = new Set<string>()
  const unique = prepared.filter((r) => {
    const k = key(r.sid)
    if (seen.has(k)) {
      summary.skipped += 1
      return false
    }
    seen.add(k)
    return true
  })

  const sessionRows = (await sql`
    SELECT
      s.id,
      s.student_id::text AS student_id,
      s.sis_user_id::text AS sis_user_id,
      s.sis_login_id,
      s.email,
      COALESCE((SELECT COUNT(*)::int FROM quiz_attempts q WHERE q.student_id = s.id), 0) AS attempts
    FROM students s
    WHERE s.session_id = ${sessionId}
  `) as ExistingRosterRow[]

  const sids = unique.map((r) => r.sid)
  const globalRows = (await sql`
    SELECT
      s.id,
      s.student_id::text AS student_id,
      s.sis_user_id::text AS sis_user_id,
      s.sis_login_id,
      s.email,
      COALESCE((SELECT COUNT(*)::int FROM quiz_attempts q WHERE q.student_id = s.id), 0) AS attempts
    FROM students s
    WHERE TRIM(s.student_id::text) = ANY(${sids}::text[])
  `) as ExistingRosterRow[]

  const globalBySid = new Map<string, ExistingRosterRow[]>()
  for (const g of globalRows) {
    const k = key(g.student_id)
    const list = globalBySid.get(k) ?? []
    list.push(g)
    globalBySid.set(k, list)
  }

  const toUpdate: { id: number; row: ReturnType<typeof normalizeImportRow> }[] = []
  const toInsert: ReturnType<typeof normalizeImportRow>[] = []
  for (const row of unique) {
    const match = matchExisting(row, sessionRows, globalBySid)
    if (match === "ambiguous") {
      summary.skipped += 1
      continue
    }
    if (match) toUpdate.push({ id: match.id, row })
    else toInsert.push(row)
  }

  if (toUpdate.length > 0) {
    const ids = toUpdate.map((u) => u.id)
    const studentIds = textCol(toUpdate.map((u) => u.row.sid))
    const keepExistingSid = toUpdate.map((u) => u.row.sidInferred)
    const names = textCol(toUpdate.map((u) => u.row.fullName))
    const emails = textCol(toUpdate.map((u) => u.row.emailFromCsv))
    const sisUsers = textCol(toUpdate.map((u) => u.row.sisUser))
    const sisLogins = textCol(toUpdate.map((u) => u.row.sisLogin || null))
    const sections = textCol(toUpdate.map((u) => u.row.canvasSec))
    await sql`
      UPDATE students AS s SET
        student_id = CASE WHEN v.keep_existing_sid THEN s.student_id ELSE v.student_id END,
        full_name = v.full_name,
        section = ${sessionCode},
        session_id = ${sessionId},
        email = COALESCE(NULLIF(TRIM(v.email), ''), s.email),
        sis_user_id = COALESCE(NULLIF(TRIM(v.sis_user_id), ''), s.sis_user_id),
        sis_login_id = COALESCE(NULLIF(TRIM(v.sis_login_id), ''), s.sis_login_id),
        canvas_section = COALESCE(NULLIF(TRIM(v.canvas_section), ''), s.canvas_section)
      FROM (
        SELECT
          unnest(${ids}::int[]) AS id,
          unnest(${studentIds}::text[]) AS student_id,
          unnest(${keepExistingSid}::boolean[]) AS keep_existing_sid,
          unnest(${names}::text[]) AS full_name,
          unnest(${emails}::text[]) AS email,
          unnest(${sisUsers}::text[]) AS sis_user_id,
          unnest(${sisLogins}::text[]) AS sis_login_id,
          unnest(${sections}::text[]) AS canvas_section
      ) AS v
      WHERE s.id = v.id
    `
    summary.updated += toUpdate.length
  }

  if (toInsert.length > 0) {
    const studentIds = textCol(toInsert.map((r) => r.sid))
    const names = textCol(toInsert.map((r) => r.fullName))
    const emails = textCol(toInsert.map((r) => r.emailForInsert))
    const sisUsers = textCol(toInsert.map((r) => r.sisUser))
    const sisLogins = textCol(toInsert.map((r) => r.sisLogin || null))
    const sections = textCol(toInsert.map((r) => r.canvasSec))
    const passwords = toInsert.map(() => passwordHash)
    await sql`
      INSERT INTO students (
        student_id, full_name, section, session_id, password_hash, has_changed_password,
        email, sis_user_id, sis_login_id, canvas_section
      )
      SELECT
        v.student_id,
        v.full_name,
        ${sessionCode},
        ${sessionId},
        v.password_hash,
        false,
        NULLIF(TRIM(v.email), ''),
        NULLIF(TRIM(v.sis_user_id), ''),
        NULLIF(TRIM(v.sis_login_id), ''),
        NULLIF(TRIM(v.canvas_section), '')
      FROM (
        SELECT
          unnest(${studentIds}::text[]) AS student_id,
          unnest(${names}::text[]) AS full_name,
          unnest(${emails}::text[]) AS email,
          unnest(${sisUsers}::text[]) AS sis_user_id,
          unnest(${sisLogins}::text[]) AS sis_login_id,
          unnest(${sections}::text[]) AS canvas_section,
          unnest(${passwords}::text[]) AS password_hash
      ) AS v
      ON CONFLICT (student_id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        section = EXCLUDED.section,
        session_id = EXCLUDED.session_id,
        email = COALESCE(NULLIF(TRIM(students.email), ''), EXCLUDED.email),
        sis_user_id = COALESCE(EXCLUDED.sis_user_id, students.sis_user_id),
        sis_login_id = COALESCE(EXCLUDED.sis_login_id, students.sis_login_id),
        canvas_section = COALESCE(EXCLUDED.canvas_section, students.canvas_section),
        password_hash = COALESCE(students.password_hash, EXCLUDED.password_hash)
    `
    summary.added += toInsert.length
  }

  return summary
}
