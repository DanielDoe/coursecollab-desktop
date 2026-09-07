import { getSQL } from "@/lib/db"

type Sql = ReturnType<typeof getSQL>

/**
 * Review ELEG 1304 often cloned quizzes from live ELEG (no decks) and skipped
 * later flashcard clones. Copy published ECE review decks+cards onto the ELEG
 * course when that course has none.
 */
export async function ensureElegReviewFlashcardsFromEce(params: {
  sql: Sql
  elegCourseId: number
  eceCourseId: number
  elegSession?: string | null
}): Promise<{ copied: number; skipped: boolean }> {
  const { sql, elegCourseId, eceCourseId, elegSession } = params
  if (!Number.isFinite(elegCourseId) || !Number.isFinite(eceCourseId)) {
    return { copied: 0, skipped: true }
  }

  const existing = (await sql`
    SELECT COUNT(*)::int AS count
    FROM flashcard_decks
    WHERE course_id = ${elegCourseId}
      AND deleted_at IS NULL
      AND deck_kind = 'course'
      AND COALESCE(is_published, true) IS NOT DISTINCT FROM TRUE
  `) as { count: number }[]
  if (Number(existing[0]?.count ?? 0) > 0) {
    return { copied: 0, skipped: true }
  }

  const srcDecks = (await sql`
    SELECT id
    FROM flashcard_decks
    WHERE course_id = ${eceCourseId}
      AND deleted_at IS NULL
      AND student_id IS NULL
      AND deck_kind = 'course'
      AND COALESCE(is_published, true) IS NOT DISTINCT FROM TRUE
    ORDER BY id ASC
  `) as { id: number }[]

  const destSession = elegSession?.trim() || null
  let copied = 0

  for (const { id: oldDeckId } of srcDecks) {
    const inserted = (await sql`
      INSERT INTO flashcard_decks (
        title, description, deck_kind, course_id, session, instructor_id, topic,
        show_in_practice_hub, is_published, card_count, require_mcq_validation, cards_before_quiz
      )
      SELECT
        title, description, deck_kind, ${elegCourseId}, ${destSession}, instructor_id, topic,
        show_in_practice_hub, is_published, card_count, require_mcq_validation, cards_before_quiz
      FROM flashcard_decks
      WHERE id = ${oldDeckId}
      RETURNING id
    `) as { id: number }[]
    const newDeckId = inserted[0]?.id
    if (!newDeckId) continue

    await sql`
      INSERT INTO flashcard_cards (
        deck_id, front_text, back_text, sort_order, custom_distractors, difficulty
      )
      SELECT
        ${newDeckId}, front_text, back_text, sort_order, custom_distractors, difficulty
      FROM flashcard_cards
      WHERE deck_id = ${oldDeckId} AND deleted_at IS NULL
    `
    copied += 1
  }

  return { copied, skipped: false }
}
