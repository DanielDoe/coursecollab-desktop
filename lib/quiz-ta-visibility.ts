import { sql } from "@/lib/db"
import { ensureQuizSessionTaVisibleColumn } from "@/lib/ensure-quiz-session-ta-visible"
import { loadInstructorActor } from "@/lib/instructor-actor-scope"

/** True when the actor is a TA and at least one section grants TA visibility for this quiz. */
export async function taCanViewQuizContent(actorId: number, quizId: number): Promise<boolean> {
  const actor = await loadInstructorActor(actorId)
  if (!actor || actor.role !== "ta") return true

  await ensureQuizSessionTaVisibleColumn()
  const rows = await sql`
    SELECT qsa.ta_visible
    FROM quiz_session_access qsa
    WHERE qsa.quiz_id = ${quizId}
  `
  if (rows.length === 0) return false
  return (rows as { ta_visible: boolean }[]).some((r) => r.ta_visible === true)
}
