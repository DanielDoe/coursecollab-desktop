#!/usr/bin/env node
/**
 * Extend active ELEG1301P02 classroom point assignments by 3 days (Central end-of-day)
 * and backfill timing boosters on existing submissions for those assignments.
 *
 * Run: node scripts/extend-eleg1301p02-classroom-due-dates.mjs
 * Dry run: DRY_RUN=1 node scripts/extend-eleg1301p02-classroom-due-dates.mjs
 */
import { dirname, join } from "path"
import { fileURLToPath } from "url"
import { loadEnvFromProjectRoot, createScriptPgClient, getDatabaseUrl } from "./lib/script-db.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, "..")
const SESSION = "ELEG1301P02"
const DRY_RUN = /^(1|true|yes)$/i.test(String(process.env.DRY_RUN ?? ""))

loadEnvFromProjectRoot(projectRoot)

function timingBoosterSinceOpened(openedAt, submittedAt) {
  const openMs = new Date(openedAt).getTime()
  const atMs = new Date(submittedAt).getTime()
  if (!Number.isFinite(openMs) || !Number.isFinite(atMs)) return 1
  const hours = (atMs - openMs) / (1000 * 60 * 60)
  if (hours < 0) return 3
  if (hours <= 24) return 3
  if (hours <= 48) return 2
  return 1
}

function applyBoosterBackfill(storedPoints, storedBooster, nextBooster) {
  const baseCap = 2.5
  const stored = Number(storedPoints) || 0
  const looksUnboosted = stored > 0 && stored <= baseCap + 0.01
  const base = looksUnboosted
    ? stored
    : Math.max(1, Number(storedBooster) || 1) > 1
      ? stored / Math.max(1, Number(storedBooster) || 1)
      : stored
  const nextPoints = Number.parseFloat(
    (Math.min(baseCap, base > 0 ? base : baseCap) * Math.max(1, nextBooster)).toFixed(2),
  )
  const points = Math.max(stored, nextPoints)
  const booster = Math.max(Math.max(1, Number(storedBooster) || 1), nextBooster)
  return { points, booster, changed: points > stored + 0.001 || booster !== Math.max(1, Number(storedBooster) || 1) }
}

async function main() {
  getDatabaseUrl()
  const client = await createScriptPgClient()

  try {
    const active = await client.query(
      `
      SELECT id, title, created_at, due_at, duration_hours
      FROM classroom_point_submissions cps
      WHERE TRIM(cps.session) = $1
        AND COALESCE(cps.hidden_from_students, false) = false
        AND (
          CASE
            WHEN cps.due_at IS NOT NULL THEN cps.due_at > NOW()
            WHEN cps.duration_hours IS NULL THEN true
            ELSE (cps.created_at + ((cps.duration_hours + 72) * INTERVAL '1 hour')) > NOW()
          END
        )
      ORDER BY id
      `,
      [SESSION],
    )

    console.log(`Found ${active.rows.length} active assignments for ${SESSION}`)
    if (active.rows.length === 0) return

    const ids = active.rows.map((r) => r.id)
    const dueRes = await client.query(
      `
      SELECT (
        (DATE_TRUNC('day', NOW() AT TIME ZONE 'America/Chicago') + INTERVAL '3 days')
        AT TIME ZONE 'America/Chicago'
        + INTERVAL '23 hours 59 minutes 59 seconds'
      ) AS due_at
      `,
    )
    const dueAt = dueRes.rows[0].due_at
    console.log(`New due_at (Central end of day +3): ${dueAt}`)

    if (!DRY_RUN) {
      await client.query(
        `
        UPDATE classroom_point_submissions
        SET
          due_at = $2,
          duration_hours = NULL,
          created_at = NOW()
        WHERE id = ANY($1::int[])
        `,
        [ids, dueAt],
      )
      console.log(`Updated due dates + reopened timing window for ids: ${ids.join(", ")}`)
    } else {
      console.log("[DRY_RUN] Would update assignment ids:", ids.join(", "))
    }

    const points = await client.query(
      `
      SELECT
        cp.id,
        cp.points,
        cp.point_booster,
        cp.created_at AS submitted_at,
        cps.created_at AS opened_at,
        cps.title
      FROM classroom_points cp
      INNER JOIN classroom_point_submissions cps ON cps.id = cp.submission_id
      INNER JOIN students s ON s.id = cp.student_id
      INNER JOIN sessions sess ON sess.id = s.session_id
      WHERE cp.submission_id = ANY($1::int[])
        AND TRIM(sess.code) = $2
      ORDER BY cp.id
      `,
      [ids, SESSION],
    )

    let boosterUpdates = 0
    for (const row of points.rows) {
      const nextBooster = timingBoosterSinceOpened(row.opened_at, row.submitted_at)
      const { points: nextPoints, booster, changed } = applyBoosterBackfill(
        row.points,
        row.point_booster,
        nextBooster,
      )
      if (!changed) continue
      boosterUpdates++
      console.log(
        `  cp#${row.id} ${row.title}: booster ${row.point_booster ?? 1}→${booster}, points ${row.points}→${nextPoints}`,
      )
      if (!DRY_RUN) {
        await client.query(`UPDATE classroom_points SET points = $2, point_booster = $3 WHERE id = $1`, [
          row.id,
          nextPoints,
          booster,
        ])
      }
    }

    console.log(
      DRY_RUN
        ? `[DRY_RUN] Would backfill boosters on ${boosterUpdates} submission(s).`
        : `Backfilled boosters on ${boosterUpdates} submission(s).`,
    )
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
