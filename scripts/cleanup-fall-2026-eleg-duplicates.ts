/**
 * Consolidate Fall 2026 ELEG duplicate sessions + align announcements to canonical courses.
 *
 *   npx tsx scripts/cleanup-fall-2026-eleg-duplicates.ts
 *   CONFIRM=yes npx tsx scripts/cleanup-fall-2026-eleg-duplicates.ts
 */
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

import { sql } from "@/lib/db"
import {
  FALL_2026_ELEG_SESSION_CODES,
  getFall2026ElegTermId,
  loadFall2026ElegCanonicalSessions,
} from "@/lib/eleg-fall-2026-student-scope"

async function countSessionRefs(sessionId: number): Promise<number> {
  const rows = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM students WHERE session_id = ${sessionId} AND deleted_at IS NULL) AS students,
      (SELECT COUNT(*)::int FROM course_syllabi WHERE session_id = ${sessionId}) AS syllabi,
      (SELECT COUNT(*)::int FROM groups WHERE session_id = ${sessionId}) AS groups,
      (SELECT COUNT(*)::int FROM schedule_adjustment_requests WHERE section_id = ${sessionId}) AS schedule
  `
  const r = rows[0] as { students: number; syllabi: number; groups: number; schedule: number }
  return r.students + r.syllabi + r.groups + r.schedule
}

async function main() {
  const confirm = process.env.CONFIRM === "yes"
  const fallTermId = await getFall2026ElegTermId(sql)
  const canonical = await loadFall2026ElegCanonicalSessions(sql)

  console.log("[cleanup] Fall term:", fallTermId)
  console.log("[cleanup] Canonical sessions:")
  for (const s of canonical) {
    console.log(`  ${s.session_code} → session ${s.session_id}, course ${s.course_id}, students ${s.student_count}`)
  }

  const canonicalByCode = new Map(canonical.map((s) => [s.session_code, s]))
  const canonicalIds = canonical.map((s) => s.session_id)
  const canonicalCourseIds = [...new Set(canonical.map((s) => s.course_id))]

  const duplicateSessions =
    canonicalIds.length === 0
      ? []
      : ((await sql`
    SELECT sess.id, TRIM(sess.code) AS code, sess.course_id, c.instructor_id,
      (SELECT COUNT(*)::int FROM students s WHERE s.session_id = sess.id AND s.deleted_at IS NULL) AS students
    FROM sessions sess
    INNER JOIN courses c ON c.id = sess.course_id
    WHERE TRIM(sess.code) = ANY(${FALL_2026_ELEG_SESSION_CODES})
      AND sess.academic_term_id = ${fallTermId}
      AND NOT (sess.id = ANY(${canonicalIds}))
    ORDER BY sess.code, sess.id
  `) as { id: number; code: string; course_id: number; instructor_id: number; students: number }[])

  console.log("[cleanup] Duplicate sessions to remove after merge:")
  for (const d of duplicateSessions) {
    console.log(`  session ${d.id} ${d.code} course ${d.course_id} instructor ${d.instructor_id} students ${d.students}`)
  }

  const orphanAnnouncements =
    canonicalCourseIds.length === 0
      ? []
      : ((await sql`
    SELECT id, title, course_id, target_session
    FROM announcements
    WHERE target_session = ANY(${FALL_2026_ELEG_SESSION_CODES})
      AND NOT (course_id = ANY(${canonicalCourseIds}))
    ORDER BY target_session, id
  `) as { id: number; title: string; course_id: number; target_session: string }[])

  console.log("[cleanup] Announcements on non-canonical courses:", orphanAnnouncements.length)
  for (const a of orphanAnnouncements) {
    const target = canonicalByCode.get(String(a.target_session).trim())
    console.log(`  #${a.id} ${a.title} · ${a.target_session} course ${a.course_id} → ${target?.course_id ?? "?"}`)
  }

  if (!confirm) {
    console.log("\nDRY RUN — pass CONFIRM=yes to apply.")
    return
  }

  let announcementsMoved = 0
  for (const a of orphanAnnouncements) {
    const target = canonicalByCode.get(String(a.target_session).trim())
    if (!target) continue

    const dupe = await sql`
      SELECT id FROM announcements
      WHERE title = ${a.title}
        AND course_id = ${target.course_id}
        AND target_session = ${a.target_session}
        AND id <> ${a.id}
      LIMIT 1
    `
    if (dupe.length > 0) {
      await sql`DELETE FROM announcement_reads WHERE announcement_id = ${a.id}`
      await sql`DELETE FROM announcement_views WHERE announcement_id = ${a.id}`
      await sql`DELETE FROM announcement_reactions WHERE announcement_id = ${a.id}`
      await sql`DELETE FROM announcement_comments WHERE announcement_id = ${a.id}`
      await sql`DELETE FROM announcements WHERE id = ${a.id}`
      console.log(`[announcement] removed duplicate #${a.id} (kept #${Number((dupe[0] as { id: number }).id)})`)
      continue
    }

    await sql`
      UPDATE announcements
      SET course_id = ${target.course_id}, updated_at = NOW()
      WHERE id = ${a.id}
    `
    announcementsMoved++
    console.log(`[announcement] moved #${a.id} → course ${target.course_id}`)
  }

  let studentsMerged = 0
  let studentsMoved = 0
  let studentsSoftDeleted = 0

  for (const dup of duplicateSessions) {
    const target = canonicalByCode.get(dup.code)
    if (!target) continue

    const dupStudents = (await sql`
      SELECT id, email, student_id, full_name
      FROM students
      WHERE session_id = ${dup.id}
        AND deleted_at IS NULL
    `) as { id: number; email: string | null; student_id: string; full_name: string }[]

    for (const row of dupStudents) {
      const email = row.email?.trim().toLowerCase() ?? ""
      if (email) {
        const onCanonical = await sql`
          SELECT id FROM students
          WHERE session_id = ${target.session_id}
            AND deleted_at IS NULL
            AND LOWER(TRIM(email)) = ${email}
          LIMIT 1
        `
        if (onCanonical.length > 0) {
          await sql`
            UPDATE students
            SET deleted_at = NOW()
            WHERE id = ${row.id}
          `
          studentsSoftDeleted++
          continue
        }
      }

      await sql`
        UPDATE students
        SET
          session_id = ${target.session_id},
          course_id = ${target.course_id},
          section = ${target.session_code}
        WHERE id = ${row.id}
      `
      studentsMoved++
    }

    studentsMerged += dupStudents.length
  }

  let sessionsDeleted = 0
  for (const dup of duplicateSessions) {
    const refs = await countSessionRefs(dup.id)
    if (refs > 0) {
      console.warn(`[session] skip delete ${dup.id} — ${refs} refs remain`)
      continue
    }
    await sql`DELETE FROM sessions WHERE id = ${dup.id}`
    sessionsDeleted++
    console.log(`[session] deleted orphan ${dup.id} (${dup.code})`)
  }

  const afterCanonical = await loadFall2026ElegCanonicalSessions(sql)
  console.log("[cleanup] Done:", {
    announcementsMoved,
    studentsMerged,
    studentsMoved,
    studentsSoftDeleted,
    sessionsDeleted,
    canonicalAfter: afterCanonical,
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
