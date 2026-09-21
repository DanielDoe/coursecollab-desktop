/**
 * Quizzes / mid-semesters / finals: Strict Mode (fullscreen, tabs, copy/paste, browser tools).
 * Homework: always exempt.
 *
 *   npx tsx scripts/enable-graded-quiz-anti-cheat.ts
 *   DRY_RUN=1 npx tsx scripts/enable-graded-quiz-anti-cheat.ts
 */
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

import { sql } from "@/lib/db"

const DRY_RUN = /^(1|true|yes)$/i.test(String(process.env.DRY_RUN ?? ""))

async function main() {
  const homeworkPreview = await sql`
    SELECT id, title, assessment_type
    FROM quizzes
    WHERE deleted_at IS NULL
      AND LOWER(TRIM(COALESCE(assessment_type, ''))) = 'homework'
      AND (
        COALESCE(strict_mode_enabled, false) = true
        OR COALESCE(block_copy_paste, false) = true
        OR COALESCE(track_tab_switches, false) = true
        OR COALESCE(warn_on_tab_switch, false) = true
        OR COALESCE(auto_submit_on_violations, false) = true
        OR COALESCE(track_gemini_window, false) = true
        OR COALESCE(require_fullscreen, false) = true
      )
    ORDER BY id
  `
  console.log(`Found ${homeworkPreview.length} homework assessment(s) with integrity flags on`)
  for (const row of homeworkPreview) {
    console.log(`  #${row.id} [${row.assessment_type}] ${row.title}`)
  }

  if (!DRY_RUN && homeworkPreview.length > 0) {
    const exempted = await sql`
      UPDATE quizzes
      SET
        strict_mode_enabled = false,
        block_copy_paste = false,
        track_tab_switches = false,
        warn_on_tab_switch = false,
        auto_submit_on_violations = false,
        track_gemini_window = false,
        require_fullscreen = false
      WHERE deleted_at IS NULL
        AND LOWER(TRIM(COALESCE(assessment_type, ''))) = 'homework'
      RETURNING id
    `
    console.log(`Exempted ${exempted.length} homework assessment(s)`)
  }

  if (DRY_RUN) return

  const restored = await sql`
    UPDATE quizzes
    SET
      strict_mode_enabled = false,
      block_copy_paste = false,
      track_tab_switches = false,
      warn_on_tab_switch = false,
      auto_submit_on_violations = false,
      track_gemini_window = false,
      require_fullscreen = false
    WHERE deleted_at IS NULL
      AND title ILIKE '%no anti-cheat%'
    RETURNING id, title
  `
  if (restored.length > 0) {
    console.log(`Restored ${restored.length} explicit no-anti-cheat assessment(s)`)
  }

  const suiteUpdated = await sql`
    UPDATE quizzes
    SET
      strict_mode_enabled = true,
      block_copy_paste = true,
      track_tab_switches = true,
      warn_on_tab_switch = true,
      auto_submit_on_violations = true,
      track_gemini_window = true,
      require_fullscreen = true
    WHERE deleted_at IS NULL
      AND LOWER(TRIM(COALESCE(assessment_type, 'quiz'))) IN (
        'quiz', 'mid_semester', 'mid-semester', 'midsem', 'final', 'finals'
      )
      AND title NOT ILIKE '%no anti-cheat%'
      AND (
        COALESCE(strict_mode_enabled, false) = false
        OR COALESCE(block_copy_paste, false) = false
        OR COALESCE(track_tab_switches, false) = false
        OR COALESCE(warn_on_tab_switch, false) = false
        OR COALESCE(auto_submit_on_violations, false) = false
        OR COALESCE(track_gemini_window, false) = false
        OR COALESCE(require_fullscreen, false) = false
      )
    RETURNING id
  `
  console.log(`Applied Strict Mode to ${suiteUpdated.length} quiz/mid-semester/final assessment(s)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
