import { sql } from "@/lib/db"
import { isStrictIntegrityAssessment } from "@/lib/antiCheatConfig"

/**
 * New quizzes / mid-semesters / finals start in Strict Mode.
 * Homework is stored with every integrity flag off.
 */
export async function applyDefaultIntegrityFlagsForNewAssessment(
  quizId: number,
  assessmentType?: string | null,
): Promise<void> {
  const on = isStrictIntegrityAssessment(assessmentType)
  await sql`
    UPDATE quizzes
    SET
      strict_mode_enabled = ${on},
      block_copy_paste = ${on},
      track_tab_switches = ${on},
      warn_on_tab_switch = ${on},
      auto_submit_on_violations = ${on},
      track_gemini_window = ${on},
      require_fullscreen = ${on}
    WHERE id = ${quizId}
  `
}
