import { sql } from "@/lib/db"
import { instructorCanAccessCourse } from "@/lib/instructor-actor-scope"
import {
  buildInstructorOwnedCourseScopeSqlFragment,
  getPlaygroundSessionsScopeColumns,
} from "@/lib/instructor-default-courses"
import { generateUniquePlaygroundPasscode } from "@/lib/playground-passcode"
import { getPlaygroundPolicyForCourse } from "@/lib/playground-policy-settings.server"
import { PLAYGROUND_ALLOWED_QUESTION_TYPES } from "@/lib/playground-question-utils"

export async function createPlaygroundClassroomSession(params: {
  instructorId: number
  courseId: number
  courseCode?: string | null
  topics: string[]
  questionCount?: number
  durationSec?: number
  allowedSessionIds?: number[] | null
}): Promise<{
  sessionId: number
  sessionCode: string | null
  joinPasscode: string | null
  href: string
}> {
  const topics = (params.topics ?? []).map((t) => String(t).trim()).filter(Boolean)
  if (topics.length === 0) {
    throw new Error("At least one question-bank topic is required.")
  }

  const allowed = await instructorCanAccessCourse(params.instructorId, params.courseId)
  if (!allowed) throw new Error("Instructor cannot create playground sessions for this course.")

  const policy = await getPlaygroundPolicyForCourse(params.courseId)
  const questionCount = Number(params.questionCount) || policy.default_question_count
  const durationSec = Number(params.durationSec) || policy.default_duration_sec

  if (questionCount < 1 || questionCount > policy.max_questions_per_session) {
    throw new Error(`Question count must be between 1 and ${policy.max_questions_per_session}.`)
  }
  if (durationSec < policy.min_duration_sec || durationSec > policy.max_duration_sec) {
    throw new Error(
      `Duration must be between ${policy.min_duration_sec} and ${policy.max_duration_sec} seconds.`,
    )
  }

  const allowedSessions =
    params.allowedSessionIds?.filter((id) => Number.isFinite(id) && id > 0) ?? null
  if (policy.require_session_restriction && (!allowedSessions || allowedSessions.length === 0)) {
    throw new Error("Select at least one class section for this playground session.")
  }

  const playgroundCols = await getPlaygroundSessionsScopeColumns()
  const joinPasscode = await generateUniquePlaygroundPasscode()

  const newSession = playgroundCols.hasCourseId && playgroundCols.hasInstructorId
    ? ((await sql`
        INSERT INTO playground_sessions (
          mode, duration_sec, is_active, selected_topics, question_count,
          current_question_index, allowed_sessions, course_id, instructor_id,
          join_passcode, game_started, lobby_opened_at
        )
        VALUES (
          'CLASSROOM', ${durationSec}, true, ${topics}, ${questionCount},
          0, ${allowedSessions}, ${params.courseId}, ${params.instructorId},
          ${joinPasscode}, false, CURRENT_TIMESTAMP
        )
        RETURNING id, session_code, join_passcode
      `) as { id: number; session_code: string | null; join_passcode: string | null }[])
    : ((await sql`
        INSERT INTO playground_sessions (
          mode, duration_sec, is_active, selected_topics, question_count,
          current_question_index, allowed_sessions, join_passcode, game_started, lobby_opened_at
        )
        VALUES (
          'CLASSROOM', ${durationSec}, true, ${topics}, ${questionCount},
          0, ${allowedSessions}, ${joinPasscode}, false, CURRENT_TIMESTAMP
        )
        RETURNING id, session_code, join_passcode
      `) as { id: number; session_code: string | null; join_passcode: string | null }[])

  const session = newSession[0]
  if (!session?.id) throw new Error("Failed to create playground session.")

  const qbScope = buildInstructorOwnedCourseScopeSqlFragment(
    "qb",
    "course_id",
    params.courseId,
    params.instructorId,
    { scopeCourseCode: params.courseCode ?? undefined },
  )

  const availableQuestions = (await sql`
    SELECT qb.id
    FROM question_bank qb
    WHERE qb.question_type = ANY(${[...PLAYGROUND_ALLOWED_QUESTION_TYPES]})
      AND qb.topic = ANY(${topics})
      AND qb.deleted_at IS NULL
      AND (${qbScope})
    ORDER BY RANDOM()
    LIMIT ${questionCount}
  `) as { id: number }[]

  if (availableQuestions.length === 0) {
    await sql`DELETE FROM playground_sessions WHERE id = ${session.id}`
    throw new Error(
      "No MCQ or True/False questions found for these topics in your course question bank.",
    )
  }

  for (let i = 0; i < availableQuestions.length; i++) {
    await sql`
      INSERT INTO playground_questions (session_id, bank_question_id, question_order)
      VALUES (${session.id}, ${availableQuestions[i]!.id}, ${i + 1})
      ON CONFLICT (session_id, question_order) DO NOTHING
    `
  }

  return {
    sessionId: Number(session.id),
    sessionCode: session.session_code ?? null,
    joinPasscode: session.join_passcode ?? null,
    href: "/module/playground",
  }
}
